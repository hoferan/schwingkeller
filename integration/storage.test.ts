import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, signInAsAdmin } from '../test-support/local-stack';
import { INT_STORAGE_DIR, PHOTO_BUCKET } from './support';

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
