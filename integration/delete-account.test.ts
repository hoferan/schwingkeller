import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { anonClient, signInAsAdmin } from '../test-support/local-stack';
import {
  INT_STORAGE_DIR,
  PHOTO_BUCKET,
  approvedEditor,
  expectNotAuthorized,
  profileOf,
  signInAs,
  signUpApplicant,
} from './support';

// delete_account from 0013. Every account deleted here is a throwaway from signUpApplicant or
// approvedEditor. The shared local accounts must survive: the stack only recreates them on a fresh
// `docker compose up`.

let admin: SupabaseClient;
let bksv: SupabaseClient;
let emmental: SupabaseClient;
let adminId: string;

const idOf = async (client: SupabaseClient): Promise<string> => {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(`reading the signed-in user failed: ${error.message}`);
  return data.user.id;
};

beforeAll(async () => {
  [admin, bksv, emmental] = await Promise.all([
    signInAs('esv'),
    signInAs('bksv'),
    signInAs('emmental'),
  ]);
  adminId = await idOf(admin);
});

const isLast = async (target_id: string): Promise<boolean> => {
  const { data, error } = await admin.rpc('is_last_super_admin', { target_id });
  if (error) throw new Error(`is_last_super_admin failed: ${error.message}`);
  return data;
};

// Gone: the super-admin, who sees every profile, no longer finds it, and the password no longer
// signs in.
const expectGone = async (account: { id: string; email: string; password: string }) => {
  await expect(profileOf(admin, account.id)).rejects.toThrow(/is not visible/);
  await expect(signInAsAdmin(account.email, account.password)).rejects.toThrow(/sign-in failed/);
};

const expectUnchanged = async (id: string, act: () => Promise<void>): Promise<void> => {
  const before = await profileOf(admin, id);
  await act();
  expect(await profileOf(admin, id)).toEqual(before);
};

const expectError = (
  result: { error: PostgrestError | null },
  code: string,
  message: string,
): void => {
  expect(result.error?.code ?? '(no error)', result.error?.message).toBe(code);
  expect(result.error?.message).toBe(message);
};

// No second super-admin may outlive the test that made it. Deletes it, or suspends it if that
// fails; does nothing if it is gone already.
const retireSuperAdmin = async (id: string): Promise<void> => {
  const { data, error } = await admin.from('profiles').select('status').eq('id', id).maybeSingle();
  if (error) throw new Error(`reading super-admin ${id} failed: ${error.message}`);
  if (!data) return;
  if ((await admin.rpc('delete_account', { target_id: id })).error === null) return;
  if (data.status !== 'approved') return;
  const { error: suspendError } = await admin.rpc('suspend_editor', { target_id: id });
  if (suspendError) throw new Error(`suspending super-admin ${id} failed: ${suspendError.message}`);
};

describe('deleting your own account', () => {
  it('removes an approved editor and their profile', async () => {
    const editor = await approvedEditor(bksv, 'emmental');
    const { error } = await editor.client.rpc('delete_account');
    expect(error).toBeNull();
    await expectGone(editor);
  });

  it('works for a pending account', async () => {
    const applicant = await signUpApplicant('emmental');
    const { error } = await applicant.client.rpc('delete_account');
    expect(error).toBeNull();
    await expectGone(applicant);
  });

  it('refuses a second call from the deleted session', async () => {
    const applicant = await signUpApplicant('emmental');
    const bystander = await signUpApplicant('emmental');
    expect((await applicant.client.rpc('delete_account')).error).toBeNull();

    // The access token still verifies, but the account behind it is gone.
    expectNotAuthorized(await applicant.client.rpc('delete_account'));
    await expectUnchanged(bystander.id, async () => {
      expectNotAuthorized(
        await applicant.client.rpc('delete_account', { target_id: bystander.id }),
      );
    });
  });

  it('frees the email for a new sign-up', async () => {
    const first = await signUpApplicant('emmental');
    expect((await first.client.rpc('delete_account')).error).toBeNull();

    const second = await signUpApplicant('emmental', first.email);
    expect(second.id).not.toBe(first.id);
    expect(await profileOf(admin, second.id)).toMatchObject({
      email: first.email,
      status: 'pending',
      requested_association_id: 'emmental',
      scope_association_id: null,
    });
  });

  it('refuses the last super-admin, who can still sign in', async () => {
    // If another super-admin were around, the call below would delete the shared admin.
    if (!(await isLast(adminId))) {
      throw new Error('the local admin is not the last super-admin; refusing to run this test');
    }
    expectError(await admin.rpc('delete_account'), 'P0001', 'cannot delete the last super-admin');

    const again = await signInAs('esv');
    expect(await profileOf(again, adminId)).toMatchObject({
      status: 'approved',
      scope_association_id: 'esv',
    });
  });
});

describe("deleting someone else's account", () => {
  it('refuses an editor', async () => {
    const target = await signUpApplicant('emmental');
    await expectUnchanged(target.id, async () => {
      expectNotAuthorized(await emmental.rpc('delete_account', { target_id: target.id }));
    });
  });

  it('refuses a Teilverband editor for an account below it', async () => {
    // bksv manages this account through the editor RPCs, but deleting is for super-admins.
    const target = await approvedEditor(bksv, 'emmental');
    await expectUnchanged(target.id, async () => {
      expectNotAuthorized(await bksv.rpc('delete_account', { target_id: target.id }));
    });
  });

  it('answers not authorized for an unknown id when not a super-admin', async () => {
    expectNotAuthorized(await emmental.rpc('delete_account', { target_id: crypto.randomUUID() }));
  });

  it('lets the super-admin delete an account', async () => {
    const target = await approvedEditor(bksv, 'emmental');
    const { error } = await admin.rpc('delete_account', { target_id: target.id });
    expect(error).toBeNull();
    await expectGone(target);
  });

  it('tells the super-admin when the account does not exist', async () => {
    expectError(
      await admin.rpc('delete_account', { target_id: crypto.randomUUID() }),
      'P0002',
      'account not found',
    );
  });

  it('lets one super-admin delete another who is not the last', async () => {
    const second = await approvedEditor(admin, 'esv');
    try {
      expect(await isLast(adminId)).toBe(false);
      const { error } = await admin.rpc('delete_account', { target_id: second.id });
      expect(error).toBeNull();
      await expectGone(second);
      expect(await isLast(adminId)).toBe(true);
    } finally {
      await retireSuperAdmin(second.id);
    }
  });

  it('refuses anonymous callers', async () => {
    const { error } = await anonClient().rpc('delete_account');
    expect(error?.message ?? '(no error)').toMatch(/permission denied for function/);
  });
});

describe('uploaded photos', () => {
  // A 1x1 transparent PNG.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  it("keep an account's files after it is deleted", async () => {
    const editor = await approvedEditor(bksv, 'emmental');
    const path = `${INT_STORAGE_DIR}/${crypto.randomUUID()}.png`;
    try {
      const { error: uploadError } = await editor.client.storage
        .from(PHOTO_BUCKET)
        .upload(path, new Blob([PNG], { type: 'image/png' }), { contentType: 'image/png' });
      expect(uploadError).toBeNull();

      expect((await editor.client.rpc('delete_account')).error).toBeNull();
      await expectGone(editor);

      const { data } = anonClient().storage.from(PHOTO_BUCKET).getPublicUrl(path);
      expect((await fetch(data.publicUrl)).status).toBe(200);
    } finally {
      await admin.storage.from(PHOTO_BUCKET).remove([path]);
    }
  });
});
