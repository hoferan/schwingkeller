import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, deleteVenuesNamed } from '../test-support/local-stack';
import {
  INT_PREFIX,
  approvedEditor,
  expectNotAuthorized,
  newVenueRow,
  profileOf,
  signInAs,
  signUpApplicant,
} from './support';

// The editor RPCs from 0012. They never touch the shared local accounts (esv, bksv, emmental,
// pending): every target is a throwaway from signUpApplicant or approvedEditor. Nothing can delete
// those, so no test assumes a clean profiles table. "Unchanged" means the admin reads the same row
// before and after.

const RLS = /row-level security policy for table "venues"/;

let admin: SupabaseClient;
let bksv: SupabaseClient;
let emmental: SupabaseClient;
let pending: SupabaseClient;
let adminId: string;

const idOf = async (client: SupabaseClient): Promise<string> => {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(`reading the signed-in user failed: ${error.message}`);
  return data.user.id;
};

beforeAll(async () => {
  [admin, bksv, emmental, pending] = await Promise.all([
    signInAs('esv'),
    signInAs('bksv'),
    signInAs('emmental'),
    signInAs('pending'),
  ]);
  adminId = await idOf(admin);
});

afterEach(async () => {
  await deleteVenuesNamed(admin, INT_PREFIX);
});

// A refusal from the RPC's own checks on status, association or the last super-admin. The code
// rules out a missing function.
const expectRefused = (result: { error: PostgrestError | null }, message: RegExp): void => {
  expect(result.error?.code ?? '(no error)', result.error?.message).toBe('P0001');
  expect(result.error?.message).toMatch(message);
};

const expectUnchanged = async (id: string, act: () => Promise<void>): Promise<void> => {
  const before = await profileOf(admin, id);
  await act();
  expect(await profileOf(admin, id)).toEqual(before);
};

// Suspends a throwaway super-admin unless it is suspended already. No second super-admin may outlive
// the test that made it.
const retireSuperAdmin = async (id: string): Promise<void> => {
  if ((await profileOf(admin, id)).status !== 'approved') return;
  const { error } = await admin.rpc('suspend_editor', { target_id: id });
  if (error) throw new Error(`suspending super-admin ${id} failed: ${error.message}`);
};

const insertEmmentalVenue = (client: SupabaseClient, label: string) =>
  client.from('venues').insert({ ...newVenueRow(label), association_id: 'emmental' });

describe('approve_editor', () => {
  it('lets a bksv editor approve an emmental applicant as emmental', async () => {
    const applicant = await signUpApplicant('emmental');
    const { error } = await bksv.rpc('approve_editor', {
      target_id: applicant.id,
      scope: 'emmental',
    });
    expect(error).toBeNull();
    expect(await profileOf(admin, applicant.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
    });
  });

  it.each(['bksv', 'luzern', 'esv'])('refuses a bksv editor granting %s', async (scope) => {
    const applicant = await signUpApplicant('emmental');
    await expectUnchanged(applicant.id, async () => {
      expectNotAuthorized(await bksv.rpc('approve_editor', { target_id: applicant.id, scope }));
    });
  });

  it('refuses a bksv editor approving a luzern applicant', async () => {
    const applicant = await signUpApplicant('luzern');
    await expectUnchanged(applicant.id, async () => {
      expectNotAuthorized(
        await bksv.rpc('approve_editor', { target_id: applicant.id, scope: 'emmental' }),
      );
    });
  });

  it('refuses a bksv editor an applicant with no requested Verband', async () => {
    // An unknown Verband at sign-up is stored as null, which leaves the applicant to super-admins.
    const applicant = await signUpApplicant('no-such-verband');
    await expectUnchanged(applicant.id, async () => {
      expectNotAuthorized(
        await bksv.rpc('approve_editor', { target_id: applicant.id, scope: 'emmental' }),
      );
    });
    const { error } = await admin.rpc('approve_editor', {
      target_id: applicant.id,
      scope: 'emmental',
    });
    expect(error).toBeNull();
    expect(await profileOf(admin, applicant.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
    });
  });

  it('lets the super-admin grant esv', async () => {
    const applicant = await signUpApplicant('esv');
    try {
      const { error } = await admin.rpc('approve_editor', {
        target_id: applicant.id,
        scope: 'esv',
      });
      expect(error).toBeNull();
      expect(await profileOf(admin, applicant.id)).toMatchObject({
        status: 'approved',
        scope_association_id: 'esv',
      });
    } finally {
      await retireSuperAdmin(applicant.id);
    }
  });

  it('refuses an unknown or null scope', async () => {
    const applicant = await signUpApplicant('emmental');
    await expectUnchanged(applicant.id, async () => {
      expectRefused(
        await admin.rpc('approve_editor', { target_id: applicant.id, scope: 'no-such-verband' }),
        /unknown association/,
      );
      expectNotAuthorized(
        await admin.rpc('approve_editor', { target_id: applicant.id, scope: null }),
      );
    });
  });

  it('approves a rejected applicant', async () => {
    const applicant = await signUpApplicant('emmental');
    expect((await bksv.rpc('reject_editor', { target_id: applicant.id })).error).toBeNull();
    const { error } = await bksv.rpc('approve_editor', {
      target_id: applicant.id,
      scope: 'emmental',
    });
    expect(error).toBeNull();
    expect(await profileOf(admin, applicant.id)).toMatchObject({ status: 'approved' });
  });

  it('refuses an account that is already approved', async () => {
    const editor = await approvedEditor(admin, 'emmental');
    await expectUnchanged(editor.id, async () => {
      expectRefused(
        await admin.rpc('approve_editor', { target_id: editor.id, scope: 'oberland' }),
        /cannot approve/,
      );
    });
  });

  it('refuses a target id with no profile', async () => {
    const target_id = crypto.randomUUID();
    expectNotAuthorized(await admin.rpc('approve_editor', { target_id, scope: 'emmental' }));
    expectNotAuthorized(await admin.rpc('set_editor_scope', { target_id, scope: 'emmental' }));
    expectNotAuthorized(await admin.rpc('reject_editor', { target_id }));
    expectNotAuthorized(await admin.rpc('suspend_editor', { target_id }));
    expectNotAuthorized(await admin.rpc('reactivate_editor', { target_id }));
  });
});

describe('set_editor_scope', () => {
  it('lets a bksv editor move an emmental editor to oberland', async () => {
    const editor = await approvedEditor(bksv, 'emmental');
    const { error } = await bksv.rpc('set_editor_scope', {
      target_id: editor.id,
      scope: 'oberland',
    });
    expect(error).toBeNull();
    expect(await profileOf(admin, editor.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'oberland',
    });
  });

  it('refuses a bksv editor moving an emmental editor to luzern', async () => {
    const editor = await approvedEditor(bksv, 'emmental');
    await expectUnchanged(editor.id, async () => {
      expectNotAuthorized(
        await bksv.rpc('set_editor_scope', { target_id: editor.id, scope: 'luzern' }),
      );
    });
  });

  it('refuses an unknown or null scope', async () => {
    const editor = await approvedEditor(admin, 'emmental');
    await expectUnchanged(editor.id, async () => {
      expectRefused(
        await admin.rpc('set_editor_scope', { target_id: editor.id, scope: 'no-such-verband' }),
        /unknown association/,
      );
      expectNotAuthorized(
        await admin.rpc('set_editor_scope', { target_id: editor.id, scope: null }),
      );
    });
  });

  it('refuses a pending target', async () => {
    const applicant = await signUpApplicant('emmental');
    await expectUnchanged(applicant.id, async () => {
      expectRefused(
        await bksv.rpc('set_editor_scope', { target_id: applicant.id, scope: 'oberland' }),
        /cannot change the scope/,
      );
    });
  });
});

describe('reject, suspend, reactivate', () => {
  it('rejects a pending applicant, and nothing else', async () => {
    const applicant = await signUpApplicant('emmental');
    expect((await bksv.rpc('reject_editor', { target_id: applicant.id })).error).toBeNull();
    expect(await profileOf(admin, applicant.id)).toMatchObject({ status: 'rejected' });
    await expectUnchanged(applicant.id, async () => {
      expectRefused(await bksv.rpc('reject_editor', { target_id: applicant.id }), /cannot reject/);
    });

    const editor = await approvedEditor(bksv, 'emmental');
    await expectUnchanged(editor.id, async () => {
      expectRefused(await bksv.rpc('reject_editor', { target_id: editor.id }), /cannot reject/);
    });
  });

  it('suspends an approved editor and reactivates a suspended one', async () => {
    const applicant = await signUpApplicant('emmental');
    await expectUnchanged(applicant.id, async () => {
      expectRefused(
        await bksv.rpc('suspend_editor', { target_id: applicant.id }),
        /cannot suspend/,
      );
      expectRefused(
        await bksv.rpc('reactivate_editor', { target_id: applicant.id }),
        /cannot reactivate/,
      );
    });

    const editor = await approvedEditor(bksv, 'emmental');
    await expectUnchanged(editor.id, async () => {
      expectRefused(
        await bksv.rpc('reactivate_editor', { target_id: editor.id }),
        /cannot reactivate/,
      );
    });

    expect((await bksv.rpc('suspend_editor', { target_id: editor.id })).error).toBeNull();
    expect(await profileOf(admin, editor.id)).toMatchObject({
      status: 'suspended',
      scope_association_id: 'emmental',
    });
    await expectUnchanged(editor.id, async () => {
      expectRefused(await bksv.rpc('suspend_editor', { target_id: editor.id }), /cannot suspend/);
    });

    expect((await bksv.rpc('reactivate_editor', { target_id: editor.id })).error).toBeNull();
    expect(await profileOf(admin, editor.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
    });
  });

  it('stops a suspended editor writing in the same session', async () => {
    const editor = await approvedEditor(bksv, 'emmental');
    expect((await insertEmmentalVenue(editor.client, 'before suspension')).error).toBeNull();
    expect((await bksv.rpc('suspend_editor', { target_id: editor.id })).error).toBeNull();
    // Same client and token: the policies read the profile live, not the JWT.
    const { error } = await insertEmmentalVenue(editor.client, 'after suspension');
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });

  it('stops a rejected applicant writing', async () => {
    const applicant = await signUpApplicant('emmental');
    expect((await bksv.rpc('reject_editor', { target_id: applicant.id })).error).toBeNull();
    const { error } = await insertEmmentalVenue(applicant.client, 'rejected');
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });
});

describe('who may act', () => {
  // Every RPC that acts on another account, called by `caller` on a pending applicant and an
  // approved editor, both in emmental.
  const refuseEverything = async (caller: SupabaseClient): Promise<void> => {
    const applicant = await signUpApplicant('emmental');
    const editor = await approvedEditor(bksv, 'emmental');
    await expectUnchanged(applicant.id, async () => {
      await expectUnchanged(editor.id, async () => {
        expectNotAuthorized(
          await caller.rpc('approve_editor', { target_id: applicant.id, scope: 'emmental' }),
        );
        expectNotAuthorized(await caller.rpc('reject_editor', { target_id: applicant.id }));
        expectNotAuthorized(await caller.rpc('suspend_editor', { target_id: editor.id }));
        expectNotAuthorized(await caller.rpc('reactivate_editor', { target_id: editor.id }));
        expectNotAuthorized(
          await caller.rpc('set_editor_scope', { target_id: editor.id, scope: 'emmental' }),
        );
      });
    });
  };

  it('refuses an emmental editor every RPC on an emmental applicant or editor', async () => {
    await refuseEverything(emmental);
  });

  it('refuses the pending account every RPC', async () => {
    await refuseEverything(pending);
  });

  it('refuses anyone acting on their own account', async () => {
    const bksvId = await idOf(bksv);
    // The super-admin may grant any node, so only the self check stands between it and its own row.
    await expectUnchanged(adminId, async () => {
      expectNotAuthorized(await admin.rpc('approve_editor', { target_id: adminId, scope: 'esv' }));
      expectNotAuthorized(
        await admin.rpc('set_editor_scope', { target_id: adminId, scope: 'bksv' }),
      );
      expectNotAuthorized(await admin.rpc('reject_editor', { target_id: adminId }));
      expectNotAuthorized(await admin.rpc('suspend_editor', { target_id: adminId }));
      expectNotAuthorized(await admin.rpc('reactivate_editor', { target_id: adminId }));
    });
    await expectUnchanged(bksvId, async () => {
      expectNotAuthorized(
        await bksv.rpc('set_editor_scope', { target_id: bksvId, scope: 'emmental' }),
      );
    });
  });

  it('refuses anonymous callers', async () => {
    const anon = anonClient();
    const target_id = crypto.randomUUID();
    const calls = [
      anon.rpc('approve_editor', { target_id, scope: 'emmental' }),
      anon.rpc('set_editor_scope', { target_id, scope: 'emmental' }),
      anon.rpc('reject_editor', { target_id }),
      anon.rpc('suspend_editor', { target_id }),
      anon.rpc('reactivate_editor', { target_id }),
      anon.rpc('request_review_again'),
      anon.rpc('is_last_super_admin', { target_id }),
    ];
    for (const { error } of await Promise.all(calls)) {
      expect(error?.message ?? '(no error)').toMatch(/permission denied for function/);
    }
  });
});

describe('request_review_again', () => {
  it('sends a rejected or suspended account back to pending, keeping its scope', async () => {
    const applicant = await signUpApplicant('emmental');
    expect((await bksv.rpc('reject_editor', { target_id: applicant.id })).error).toBeNull();
    expect((await applicant.client.rpc('request_review_again')).error).toBeNull();
    expect(await profileOf(admin, applicant.id)).toMatchObject({
      status: 'pending',
      requested_association_id: 'emmental',
      scope_association_id: null,
    });

    const editor = await approvedEditor(bksv, 'emmental');
    expect(
      (await bksv.rpc('set_editor_scope', { target_id: editor.id, scope: 'oberland' })).error,
    ).toBeNull();
    expect((await bksv.rpc('suspend_editor', { target_id: editor.id })).error).toBeNull();
    expect((await editor.client.rpc('request_review_again')).error).toBeNull();
    expect(await profileOf(admin, editor.id)).toMatchObject({
      status: 'pending',
      requested_association_id: 'emmental',
      scope_association_id: 'oberland',
    });
  });

  it('refuses a pending or approved caller', async () => {
    const applicant = await signUpApplicant('emmental');
    await expectUnchanged(applicant.id, async () => {
      expectRefused(await applicant.client.rpc('request_review_again'), /cannot request a review/);
    });
    const editor = await approvedEditor(bksv, 'emmental');
    await expectUnchanged(editor.id, async () => {
      expectRefused(await editor.client.rpc('request_review_again'), /cannot request a review/);
    });
  });
});

describe('the last super-admin', () => {
  const isLast = async (target_id: string): Promise<boolean> => {
    const { data, error } = await admin.rpc('is_last_super_admin', { target_id });
    if (error) throw new Error(`is_last_super_admin failed: ${error.message}`);
    return data;
  };

  it('reports the local admin as the last super-admin, until a second one is approved', async () => {
    expect(await isLast(adminId)).toBe(true);
    const second = await approvedEditor(admin, 'esv');
    try {
      expect(await isLast(adminId)).toBe(false);
      expect(await isLast(second.id)).toBe(false);
    } finally {
      await retireSuperAdmin(second.id);
    }
    expect(await isLast(adminId)).toBe(true);
    expect(await isLast(second.id)).toBe(false);
  });

  // Only a smoke test: without a pg_sleep injected into suspend_editor the two calls rarely overlap,
  // so a pass says little about the lock. The lock was checked by hand with such a pg_sleep.
  it('keeps one super-admin when two suspend each other at once', async ({ onTestFinished }) => {
    const second = await approvedEditor(admin, 'esv');
    // Puts the admin back first, then retires the second super-admin, whatever happens below. As a
    // hook, its error is reported next to the test's own instead of replacing it.
    onTestFinished(async () => {
      if ((await profileOf(admin, adminId)).status !== 'approved') {
        const { error } = await second.client.rpc('reactivate_editor', { target_id: adminId });
        if (error) {
          throw new Error(
            `reactivating the local admin failed: ${error.message}. Restart db-init ` +
              '(`docker compose up db-init`), whose local-accounts.sql approves the admin again; ' +
              `the next run's global setup then suspends the leftover super-admin ${second.id}.`,
          );
        }
      }
      await retireSuperAdmin(second.id);
    });

    const results = await Promise.allSettled([
      admin.rpc('suspend_editor', { target_id: second.id }),
      second.client.rpc('suspend_editor', { target_id: adminId }),
    ]);
    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.error === null);
    expect(succeeded).toHaveLength(1);

    // Each account can always read its own row.
    const statuses = [
      (await profileOf(admin, adminId)).status,
      (await profileOf(second.client, second.id)).status,
    ];
    expect(statuses.filter((s) => s === 'approved')).toHaveLength(1);
  });
});
