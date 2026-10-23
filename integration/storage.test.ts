import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, signInAsAdmin } from '../test-support/local-stack';
import { INT_STORAGE_DIR, PHOTO_BUCKET, signInAs } from './support';

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const pngBlob = () => new Blob([PNG], { type: 'image/png' });

let admin: SupabaseClient;
const anon = anonClient();
const created: string[] = [];

beforeAll(async () => {
  admin = await signInAsAdmin(ADMIN.email, ADMIN.password);
});

afterEach(async () => {
  if (created.length > 0) await admin.storage.from(PHOTO_BUCKET).remove(created.splice(0));
});

describe('the venue-photos bucket', () => {
  it('takes an upload from the admin and serves it publicly', async () => {
    const path = `${INT_STORAGE_DIR}/${crypto.randomUUID()}.png`;
    const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, pngBlob(), { contentType: 'image/png' });
    expect(error).toBeNull();
    created.push(path);

    const { data } = anon.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    const response = await fetch(data.publicUrl);
    expect(response.status).toBe(200);
  });

  it('refuses an anonymous upload', async () => {
    const path = `${INT_STORAGE_DIR}/${crypto.randomUUID()}.png`;
    const { error } = await anon.storage.from(PHOTO_BUCKET).upload(path, pngBlob(), { contentType: 'image/png' });
    expect(error).not.toBeNull();
    if (!error) created.push(path);
  });

  it('lets the admin delete an upload', async () => {
    const path = `${INT_STORAGE_DIR}/${crypto.randomUUID()}.png`;
    await admin.storage.from(PHOTO_BUCKET).upload(path, pngBlob(), { contentType: 'image/png' });
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove([path]);
    expect(error).toBeNull();
    const { data } = await admin.storage.from(PHOTO_BUCKET).list(INT_STORAGE_DIR, { search: path.split('/')[1] });
    expect(data).toHaveLength(0);
  });
});

// Storage checks the content type the upload declares and never reads the bytes, so every case
// sends the same PNG. It serves the file under that type, which decides whether a browser could run
// it as a page.
describe('the venue-photos bucket by content type', () => {
  let emmental: SupabaseClient;

  beforeAll(async () => {
    emmental = await signInAs('emmental');
  });

  const upload = (contentType: string, ext: string) => {
    const path = `${INT_STORAGE_DIR}/${crypto.randomUUID()}.${ext}`;
    const body = new Blob([PNG], { type: contentType });
    return emmental.storage
      .from(PHOTO_BUCKET)
      .upload(path, body, { contentType })
      .then((result) => {
        if (!result.error) created.push(path);
        return result;
      });
  };

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif'],
    ['image/avif', 'avif'],
  ])('takes %s from an editor', async (contentType, ext) => {
    const { error } = await upload(contentType, ext);
    expect(error).toBeNull();
  });

  // HEIC and HEIF are left out on purpose: only Safari can show them.
  it.each([
    ['text/html', 'html'],
    ['image/svg+xml', 'svg'],
    ['application/octet-stream', 'bin'],
    ['image/heic', 'heic'],
  ])('refuses %s from an editor', async (contentType, ext) => {
    const { error } = await upload(contentType, ext);
    expect(error?.message ?? '(no error)').toMatch(/mime type .* is not supported/i);
    expect(error && 'statusCode' in error ? error.statusCode : '(no statusCode)').toBe('415');
  });
});

describe('the venue-photos bucket by uploader', () => {
  let bksv: SupabaseClient;
  let emmental: SupabaseClient;
  let pending: SupabaseClient;

  beforeAll(async () => {
    [bksv, emmental, pending] = await Promise.all([signInAs('bksv'), signInAs('emmental'), signInAs('pending')]);
  });

  const newPath = () => `${INT_STORAGE_DIR}/${crypto.randomUUID()}.png`;
  const upload = (client: SupabaseClient, path: string, upsert = false) =>
    client.storage.from(PHOTO_BUCKET).upload(path, pngBlob(), { contentType: 'image/png', upsert });
  const countAsAdmin = async (path: string) => {
    const { data } = await admin.storage.from(PHOTO_BUCKET).list(INT_STORAGE_DIR, { search: path.split('/')[1] });
    return data?.length ?? 0;
  };
  const bytesAsAdmin = async (path: string): Promise<Buffer> => {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(path);
    if (error) throw new Error(`downloading ${path} failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  };
  // storage-api answers a policy refusal with HTTP 400 and statusCode "403" in the body. Checking
  // both keeps a bad request or a missing bucket from passing for a refusal.
  const expectRlsRefusal = (error: Error | null) => {
    expect(error?.message ?? '(no error)').toMatch(/row-level security/);
    expect(error && 'statusCode' in error ? error.statusCode : '(no statusCode)').toBe('403');
  };

  it('takes an upload from an emmental editor', async () => {
    const path = newPath();
    const { error } = await upload(emmental, path);
    created.push(path);
    expect(error).toBeNull();
  });

  it('refuses an upload from the pending account', async () => {
    const path = newPath();
    const { error } = await upload(pending, path);
    if (!error) created.push(path);
    expectRlsRefusal(error);
  });

  it("keeps an emmental editor's file when a bksv editor deletes it", async () => {
    const path = newPath();
    expect((await upload(emmental, path)).error).toBeNull();
    created.push(path);
    const { error } = await bksv.storage.from(PHOTO_BUCKET).remove([path]);
    expect(error).toBeNull();
    expect(await countAsAdmin(path)).toBe(1);
  });

  it("refuses a bksv editor overwriting an emmental editor's file", async () => {
    const path = newPath();
    expect((await upload(emmental, path)).error).toBeNull();
    created.push(path);
    const other = new Blob([PNG, Buffer.from('bksv')], { type: 'image/png' });
    const { error } = await bksv.storage
      .from(PHOTO_BUCKET)
      .upload(path, other, { contentType: 'image/png', upsert: true });
    expectRlsRefusal(error);
    expect(await bytesAsAdmin(path)).toEqual(PNG);
  });

  it('lets the uploader delete their own file', async () => {
    const path = newPath();
    expect((await upload(emmental, path)).error).toBeNull();
    created.push(path);
    const { error } = await emmental.storage.from(PHOTO_BUCKET).remove([path]);
    expect(error).toBeNull();
    expect(await countAsAdmin(path)).toBe(0);
  });

  it("lets the super-admin delete an editor's file", async () => {
    const path = newPath();
    expect((await upload(emmental, path)).error).toBeNull();
    created.push(path);
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove([path]);
    expect(error).toBeNull();
    expect(await countAsAdmin(path)).toBe(0);
  });
});
