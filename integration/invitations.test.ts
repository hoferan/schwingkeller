import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, anonClient, createAuthUser } from '../test-support/local-stack';
import {
  approvedEditor,
  createInvitation,
  expectNotAuthorized,
  freshEmail,
  type Invitation,
  invitationRows,
  profileOf,
  signInAs,
  signUpApplicant,
  signUpWithInvitation,
} from './support';

// The invitation table and RPCs from 0015. Every address is a fresh int-… one, so no test depends
// on what another left behind. Expired and long-revoked invitations come from the local-only
// test_backdate_invitation, and rows the select policy hides are read through test_invitation_rows.

const GRANTED =
  'id, email, association_id, invited_by, created_at, expires_at, used_at, revoked_at';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

let esv: SupabaseClient;
let bksv: SupabaseClient;
let emmental: SupabaseClient;

beforeAll(async () => {
  [esv, bksv, emmental] = await Promise.all([
    signInAs('esv'),
    signInAs('bksv'),
    signInAs('emmental'),
  ]);
});

const invite = (client: SupabaseClient, scope: string, email = freshEmail()) =>
  client.rpc('create_invitation', { target_email: email, scope });

const userIdOf = async (client: SupabaseClient): Promise<string> => {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error(`reading the signed-in user failed: ${error?.message}`);
  return data.user.id;
};

// Refused by a missing grant, before any check inside the function runs.
const expectPermissionDenied = (result: { error: PostgrestError | null }): void => {
  expect(result.error?.code ?? '(no error)', result.error?.message).toBe('42501');
};

// A refusal from the RPC's own checks. The code rules out a missing function.
const expectRefused = (result: { error: PostgrestError | null }, message: string): void => {
  expect(result.error?.code ?? '(no error)', result.error?.message).toBe('P0001');
  expect(result.error?.message).toBe(message);
};

const backdate = async (id: string, by: string): Promise<void> => {
  const { error } = await esv.rpc('test_backdate_invitation', {
    invitation_id: id,
    by_interval: by,
  });
  if (error) throw new Error(`backdating invitation ${id} failed: ${error.message}`);
};

const revoke = async (client: SupabaseClient, id: string): Promise<void> => {
  const { error } = await client.rpc('revoke_invitation', { invitation_id: id });
  if (error) throw new Error(`revoking invitation ${id} failed: ${error.message}`);
};

const profilesWithEmail = async (email: string): Promise<unknown[]> => {
  const { data, error } = await esv.from('profiles').select('id').eq('email', email);
  if (error) throw new Error(`reading profiles of ${email} failed: ${error.message}`);
  return data;
};

describe('can_invite / create_invitation', () => {
  it.each(['bksv', 'emmental'])('lets a bksv editor invite for %s', async (scope) => {
    const { data, error } = await invite(bksv, scope);
    expect(error).toBeNull();
    expect(data).toMatch(TOKEN);
  });

  it('records the inviter and an expiry 7 days out', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const { data, error } = await bksv
      .from('invitations')
      .select('invited_by, created_at, expires_at')
      .eq('id', invitation.id)
      .single();
    expect(error).toBeNull();
    expect(data?.invited_by).toBe(await userIdOf(bksv));
    const week = Date.parse(data?.created_at) + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.parse(data?.expires_at) - week)).toBeLessThan(60_000);
  });

  it('lets an emmental editor invite for emmental', async () => {
    const { data, error } = await invite(emmental, 'emmental');
    expect(error).toBeNull();
    expect(data).toMatch(TOKEN);
  });

  it.each(['oberland', 'bksv'])('refuses an emmental editor inviting for %s', async (scope) => {
    expectNotAuthorized(await invite(emmental, scope));
  });

  it('refuses a suspended editor', async () => {
    const editor = await approvedEditor(esv, 'emmental');
    const { error } = await esv.rpc('suspend_editor', { target_id: editor.id });
    if (error) throw new Error(`suspending ${editor.email} failed: ${error.message}`);
    expectNotAuthorized(await invite(editor.client, 'emmental'));
  });

  it('names an unknown association', async () => {
    expectRefused(await invite(esv, 'no-such-verband'), 'unknown association: no-such-verband');
  });

  it('refuses a malformed address', async () => {
    expectRefused(await invite(bksv, 'emmental', 'not-an-email'), 'invalid email');
  });

  it('refuses an address that already has an account, whatever its case', async () => {
    expectRefused(
      await invite(bksv, 'emmental', ACCOUNTS.emmental.email.toUpperCase()),
      'email already has an account',
    );
  });

  it('stores the address trimmed and lower-cased', async () => {
    const id = crypto.randomUUID();
    const { error } = await invite(bksv, 'emmental', `  Int-${id}@Schwingkeller.LOCAL `);
    expect(error).toBeNull();
    const { data, error: readError } = await bksv
      .from('invitations')
      .select('email')
      .like('email', `%${id}%`);
    expect(readError).toBeNull();
    expect(data).toEqual([{ email: `int-${id}@schwingkeller.local` }]);
  });

  it('replaces the open invitation for the same address', async () => {
    const first = await createInvitation(bksv, 'emmental');
    const second = await createInvitation(bksv, 'emmental', first.email);
    const rows = await invitationRows(esv, first.email);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: first.id, revoked_at: expect.any(String) });
    expect(rows[1]).toMatchObject({ id: second.id, revoked_at: null, used_at: null });
  });

  it('refuses to replace a live invitation made at a higher level', async () => {
    const above = await createInvitation(esv, 'bksv');
    expectRefused(
      await invite(emmental, 'emmental', above.email),
      'an invitation for this email is open at a higher level',
    );
    expect(await invitationRows(esv, above.email)).toEqual([
      { id: above.id, used_at: null, used_by: null, revoked_at: null },
    ]);
  });

  it('replaces an expired invitation made at a higher level', async () => {
    const above = await createInvitation(esv, 'bksv');
    await backdate(above.id, '8 days');
    const { error } = await invite(emmental, 'emmental', above.email);
    expect(error).toBeNull();
    const rows = await invitationRows(esv, above.email);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === above.id)?.revoked_at).toEqual(expect.any(String));
  });
});

describe('purging old invitations', () => {
  // Each case prepares its own invitation first, because creating one purges as well. All the rows
  // are made before any is backdated, for the same reason.
  it.each<[string, () => Promise<() => Promise<unknown>>]>([
    ['an invitation is created', async () => () => createInvitation(bksv, 'emmental')],
    [
      'an invitation is revoked',
      async () => {
        const invitation = await createInvitation(bksv, 'emmental');
        return () => revoke(bksv, invitation.id);
      },
    ],
    [
      'an invitation is used',
      async () => {
        const invitation = await createInvitation(bksv, 'emmental');
        return () => signUpWithInvitation(invitation.email, invitation.token);
      },
    ],
  ])('deletes those revoked or expired over 30 days ago when %s', async (_when, prepare) => {
    const act = await prepare();
    const revoked = await createInvitation(bksv, 'emmental');
    const expired = await createInvitation(bksv, 'emmental');
    const recent = await createInvitation(bksv, 'emmental');
    const used = await createInvitation(bksv, 'emmental');
    await revoke(bksv, revoked.id);
    await signUpWithInvitation(used.email, used.token);
    await backdate(revoked.id, '31 days');
    await backdate(expired.id, '38 days');
    await backdate(recent.id, '20 days');
    await backdate(used.id, '38 days');

    await act();

    expect(await invitationRows(esv, revoked.email)).toEqual([]);
    expect(await invitationRows(esv, expired.email)).toEqual([]);
    expect(await invitationRows(esv, recent.email)).toHaveLength(1);
    expect(await invitationRows(esv, used.email)).toHaveLength(1);
  });
});

describe('revoke_invitation', () => {
  it('lets a bksv editor revoke one the ESV made for emmental', async () => {
    const invitation = await createInvitation(esv, 'emmental');
    const { error } = await bksv.rpc('revoke_invitation', { invitation_id: invitation.id });
    expect(error).toBeNull();
    expect((await invitationRows(esv, invitation.email))[0].revoked_at).toEqual(expect.any(String));
  });

  it('refuses an emmental editor one made for bksv', async () => {
    const invitation = await createInvitation(esv, 'bksv');
    expectNotAuthorized(await emmental.rpc('revoke_invitation', { invitation_id: invitation.id }));
    expect((await invitationRows(esv, invitation.email))[0].revoked_at).toBeNull();
  });

  it('refuses an id that does not exist', async () => {
    expectNotAuthorized(await esv.rpc('revoke_invitation', { invitation_id: crypto.randomUUID() }));
  });

  it('refuses one that is revoked already', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await revoke(bksv, invitation.id);
    expectRefused(
      await bksv.rpc('revoke_invitation', { invitation_id: invitation.id }),
      'cannot revoke an invitation that is revoked',
    );
  });

  it('refuses one that is used', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await signUpWithInvitation(invitation.email, invitation.token);
    expectRefused(
      await bksv.rpc('revoke_invitation', { invitation_id: invitation.id }),
      'cannot revoke an invitation that is used',
    );
  });

  it('revokes one that has expired', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await backdate(invitation.id, '8 days');
    const { error } = await bksv.rpc('revoke_invitation', { invitation_id: invitation.id });
    expect(error).toBeNull();
  });
});

describe('invitations visibility', () => {
  it('keeps the token hash from editors', async () => {
    const { error } = await bksv.from('invitations').select('*').limit(1);
    expect(error?.code ?? '(no error)', error?.message).toBe('42501');
  });

  it('shows a bksv editor an open emmental invitation', async () => {
    const invitation = await createInvitation(esv, 'emmental');
    const { data, error } = await bksv.from('invitations').select(GRANTED).eq('id', invitation.id);
    expect(error).toBeNull();
    expect(data).toEqual([
      expect.objectContaining({
        id: invitation.id,
        email: invitation.email,
        association_id: 'emmental',
      }),
    ]);
  });

  it('hides a bksv invitation from an emmental editor', async () => {
    const invitation = await createInvitation(esv, 'bksv');
    const { data, error } = await emmental
      .from('invitations')
      .select(GRANTED)
      .eq('id', invitation.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('hides a revoked invitation', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await revoke(bksv, invitation.id);
    const { data, error } = await bksv.from('invitations').select(GRANTED).eq('id', invitation.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('hides a used invitation', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await signUpWithInvitation(invitation.email, invitation.token);
    const { data, error } = await bksv.from('invitations').select(GRANTED).eq('id', invitation.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('gives anonymous callers nothing', async () => {
    const { error } = await anonClient().from('invitations').select('id').limit(1);
    expect(error?.code ?? '(no error)', error?.message).toBe('42501');
  });
});

describe('invitations guards', () => {
  it('refuses an editor writing the table directly', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    expectPermissionDenied(
      await bksv.from('invitations').insert({ email: freshEmail(), association_id: 'emmental' }),
    );
    expectPermissionDenied(
      await bksv
        .from('invitations')
        .update({ expires_at: new Date(Date.now() + 1e10).toISOString() })
        .eq('id', invitation.id),
    );
    expectPermissionDenied(await bksv.from('invitations').delete().eq('id', invitation.id));
    expect(await invitationRows(esv, invitation.email)).toEqual([
      { id: invitation.id, used_at: null, used_by: null, revoked_at: null },
    ]);
  });

  it('keeps invitation_token_hash from signed-in callers', async () => {
    expectPermissionDenied(await bksv.rpc('invitation_token_hash', { token: 'x' }));
  });

  it('keeps purge_stale_invitations from every client role', async () => {
    expectPermissionDenied(await bksv.rpc('purge_stale_invitations'));
    expectPermissionDenied(await anonClient().rpc('purge_stale_invitations'));
  });

  it('refuses anonymous callers the editor RPCs', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const anon = anonClient();
    expectPermissionDenied(
      await anon.rpc('create_invitation', { target_email: freshEmail(), scope: 'emmental' }),
    );
    expectPermissionDenied(await anon.rpc('revoke_invitation', { invitation_id: invitation.id }));
    expect((await invitationRows(esv, invitation.email))[0].revoked_at).toBeNull();
  });
});

describe('invitation_details', () => {
  const details = (client: SupabaseClient, token: string) =>
    client.rpc('invitation_details', { token });

  const expiresAt = async (id: string): Promise<string> => {
    const { data, error } = await esv
      .from('invitations')
      .select('expires_at')
      .eq('id', id)
      .single();
    if (error) throw new Error(`reading invitation ${id} failed: ${error.message}`);
    return data.expires_at as string;
  };

  it.each([
    ['anonymous', () => anonClient()],
    ['emmental', () => emmental],
  ])('returns a live invitation to %s', async (_who, client) => {
    const invitation = await createInvitation(bksv, 'emmental');
    const { data, error } = await details(client(), invitation.token);
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        email: invitation.email,
        association_id: 'emmental',
        expires_at: await expiresAt(invitation.id),
      },
    ]);
  });

  it('returns nothing for a missing or unknown token', async () => {
    const anon = anonClient();
    expect(await details(anon, '')).toMatchObject({ data: [], error: null });
    expect(await details(anon, 'A'.repeat(43))).toMatchObject({ data: [], error: null });
  });

  it('returns nothing for a used token', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await signUpWithInvitation(invitation.email, invitation.token);
    expect(await details(anonClient(), invitation.token)).toMatchObject({ data: [], error: null });
  });

  it('returns nothing for a revoked token', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await revoke(bksv, invitation.id);
    expect(await details(anonClient(), invitation.token)).toMatchObject({ data: [], error: null });
  });

  it('returns nothing for an expired token', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    await backdate(invitation.id, '8 days');
    expect(await details(anonClient(), invitation.token)).toMatchObject({ data: [], error: null });
  });

  it('returns nothing for a replaced token', async () => {
    const first = await createInvitation(bksv, 'emmental');
    await createInvitation(bksv, 'emmental', first.email);
    expect(await details(anonClient(), first.token)).toMatchObject({ data: [], error: null });
  });

  it('leaves the invitation as it was', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const before = await invitationRows(esv, invitation.email);
    const expiry = await expiresAt(invitation.id);
    await details(anonClient(), invitation.token);
    expect(await invitationRows(esv, invitation.email)).toEqual(before);
    expect(await expiresAt(invitation.id)).toBe(expiry);
  });
});

describe('consuming an invitation', () => {
  // The trigger refuses through the admin API as well: createAuthUser skips the sign-up hook, so
  // these cases reach consume_invitation whatever the hook would have said. GoTrue answers a
  // trigger exception with a 500.
  const PASSWORD = 'int-password';
  const createdWith = (email: string, invitation: unknown): Promise<string> =>
    createAuthUser(email, PASSWORD, { invitation });

  let bksvId: string;
  beforeAll(async () => {
    bksvId = await userIdOf(bksv);
  });

  it('approves the account with the invitation scope and marks the invitation used', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const editor = await signUpWithInvitation(invitation.email, invitation.token);
    expect(await profileOf(esv, editor.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
      requested_association_id: null,
      invited_by: bksvId,
    });
    const [row] = await invitationRows(esv, invitation.email);
    expect(row).toMatchObject({ used_at: expect.any(String), used_by: editor.id });
  });

  // The user_metadata claim of an access token, read without checking the signature.
  const metadataClaim = (accessToken: string): Record<string, unknown> => {
    const payload = accessToken.split('.')[1] ?? '';
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      user_metadata?: Record<string, unknown>;
    };
    if (!claims.user_metadata) throw new Error('the access token has no user_metadata claim');
    return claims.user_metadata;
  };

  // GoTrue copies the sign-up metadata into the identity and writes it back to the user later in the
  // same transaction, so the stored account is read back through getUser, not the signUp response.
  it('keeps the token and a requested node out of the account', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const client = anonClient();
    const { data: signedUp, error: signUpError } = await client.auth.signUp({
      email: invitation.email,
      password: PASSWORD,
      options: { data: { invitation: invitation.token, association: 'esv' } },
    });
    expect(signUpError).toBeNull();
    expect(signedUp.session).not.toBeNull();

    const { data, error } = await client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.user_metadata).not.toHaveProperty('invitation');
    expect(data.user?.user_metadata).not.toHaveProperty('association');
    expect(data.user?.identities).toHaveLength(1);
    expect(data.user?.identities?.[0].identity_data).not.toHaveProperty('invitation');
    expect(data.user?.identities?.[0].identity_data).not.toHaveProperty('association');
    expect(await profileOf(esv, data.user?.id ?? '')).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
      requested_association_id: null,
    });

    // The token from sign-up itself isn't checked: GoTrue signs it from the user it holds in memory,
    // which still has the request's metadata. The first refresh is built from the stripped row.
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    expect(refreshError).toBeNull();
    const reissued = metadataClaim(refreshed.session?.access_token ?? '');
    expect(reissued).not.toHaveProperty('invitation');
    expect(reissued).not.toHaveProperty('association');
  });

  it('matches the address whatever its case', async () => {
    const mixed = `Int-Case-${crypto.randomUUID()}@Schwingkeller.LOCAL`;
    const invitation = await createInvitation(bksv, 'emmental', mixed);
    const editor = await signUpWithInvitation(mixed.toLowerCase(), invitation.token);
    expect(await profileOf(esv, editor.id)).toMatchObject({ status: 'approved' });
  });

  // A used invitation's address always has an account, so the used token is tried with another one.
  it.each<[string, () => Promise<{ email: string; invitation: unknown }>]>([
    ['an unknown token', async () => ({ email: freshEmail(), invitation: 'A'.repeat(43) })],
    [
      'a used token',
      async () => {
        const used = await createInvitation(bksv, 'emmental');
        await signUpWithInvitation(used.email, used.token);
        return { email: freshEmail(), invitation: used.token };
      },
    ],
    [
      'a revoked token',
      async () => {
        const revoked = await createInvitation(bksv, 'emmental');
        await revoke(bksv, revoked.id);
        return { email: revoked.email, invitation: revoked.token };
      },
    ],
    [
      'an expired token',
      async () => {
        const expired = await createInvitation(bksv, 'emmental');
        await backdate(expired.id, '8 days');
        return { email: expired.email, invitation: expired.token };
      },
    ],
    ['an empty token', async () => ({ email: freshEmail(), invitation: '' })],
    ['a token that is not a string', async () => ({ email: freshEmail(), invitation: 42 })],
    [
      'a valid token for another address',
      async () => {
        const other = await createInvitation(bksv, 'emmental');
        return { email: freshEmail(), invitation: other.token };
      },
    ],
  ])('refuses the account for %s', async (_case, setup) => {
    const { email, invitation } = await setup();
    await expect(createdWith(email, invitation)).rejects.toThrow(/failed: 500/);
    expect(await profilesWithEmail(email)).toEqual([]);
  });

  it('accepts only the newer token of a replaced invitation', async () => {
    const first = await createInvitation(bksv, 'emmental');
    const second = await createInvitation(bksv, 'emmental', first.email);
    await expect(createdWith(first.email, first.token)).rejects.toThrow(/failed: 500/);
    const id = await createdWith(first.email, second.token);
    expect(await profileOf(esv, id)).toMatchObject({ status: 'approved' });
  });

  it('lets only one of two concurrent sign-ups use the token', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const results = await Promise.allSettled([
      signUpWithInvitation(invitation.email, invitation.token),
      signUpWithInvitation(invitation.email, invitation.token),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await invitationRows(esv, invitation.email);
    expect(rows).toHaveLength(1);
    expect(rows[0].used_at).toEqual(expect.any(String));
  });

  it('deletes the used invitation with the account, so the address can be invited again', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const editor = await signUpWithInvitation(invitation.email, invitation.token);
    const { error } = await editor.client.rpc('delete_account');
    expect(error).toBeNull();
    expect(await invitationRows(esv, invitation.email)).toEqual([]);

    const again = await createInvitation(bksv, 'emmental', invitation.email);
    const back = await signUpWithInvitation(again.email, again.token);
    expect(await profileOf(esv, back.id)).toMatchObject({ status: 'approved' });
  });

  // Inviting the address again replaces the first invitation; revoking it first gives the same row.
  it.each<[string, (first: Invitation) => Promise<void>]>([
    ['replaced', async () => {}],
    ['revoked', (first) => revoke(bksv, first.id)],
  ])('leaves no %s invitation once the account is deleted', async (_how, retire) => {
    const first = await createInvitation(bksv, 'emmental');
    await retire(first);
    const open = await createInvitation(bksv, 'emmental', first.email);
    expect(await invitationRows(esv, first.email)).toHaveLength(2);
    const editor = await signUpWithInvitation(open.email, open.token);
    const { error } = await editor.client.rpc('delete_account');
    expect(error).toBeNull();
    expect(await invitationRows(esv, first.email)).toEqual([]);
  });

  it('deletes the open and replaced invitations of an address the admin API makes an account for', async () => {
    const first = await createInvitation(bksv, 'emmental');
    await createInvitation(bksv, 'emmental', first.email);
    expect(await invitationRows(esv, first.email)).toHaveLength(2);
    await createAuthUser(first.email, PASSWORD);
    expect(await invitationRows(esv, first.email)).toEqual([]);
  });

  it('clears invited_by when the inviter deletes their account later', async () => {
    const inviter = await approvedEditor(bksv, 'bksv');
    const invitation = await createInvitation(inviter.client, 'emmental');
    const editor = await signUpWithInvitation(invitation.email, invitation.token);
    expect(await profileOf(esv, editor.id)).toMatchObject({ invited_by: inviter.id });
    const { error } = await inviter.client.rpc('delete_account');
    expect(error).toBeNull();
    expect(await profileOf(esv, editor.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
      invited_by: null,
    });
  });

  it('still approves when the inviter has deleted their account', async () => {
    const inviter = await approvedEditor(bksv, 'bksv');
    const invitation = await createInvitation(inviter.client, 'emmental');
    const { error } = await inviter.client.rpc('delete_account');
    expect(error).toBeNull();
    const editor = await signUpWithInvitation(invitation.email, invitation.token);
    expect(await profileOf(esv, editor.id)).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
      invited_by: null,
    });
  });

  it('leaves an account made without a token pending', async () => {
    const applicant = await signUpApplicant('emmental');
    expect(await profileOf(esv, applicant.id)).toMatchObject({
      status: 'pending',
      requested_association_id: 'emmental',
      scope_association_id: null,
    });
  });
});

describe('the sign-up hook', () => {
  // Public sign-up, the path the hook guards. Each refusal gets the same status and message, so a
  // caller can't tell a used token from a revoked one or from none at all.
  const REFUSAL = 'Sign-up requires a valid invitation.';
  const PASSWORD = 'int-password';
  const signUp = (email: string, data?: Record<string, unknown>) =>
    anonClient().auth.signUp({ email, password: PASSWORD, options: data ? { data } : undefined });

  // A used invitation's address always has an account, so the used token is tried with another one.
  it.each<[string, () => Promise<{ email: string; data?: Record<string, unknown> }>]>([
    ['no metadata', async () => ({ email: freshEmail() })],
    ['a requested node only', async () => ({ email: freshEmail(), data: { association: 'emmental' } })],
    [
      'an unknown token',
      async () => ({ email: freshEmail(), data: { invitation: 'A'.repeat(43) } }),
    ],
    [
      'a used token',
      async () => {
        const used = await createInvitation(bksv, 'emmental');
        await signUpWithInvitation(used.email, used.token);
        return { email: freshEmail(), data: { invitation: used.token } };
      },
    ],
    [
      'a revoked token',
      async () => {
        const revoked = await createInvitation(bksv, 'emmental');
        await revoke(bksv, revoked.id);
        return { email: revoked.email, data: { invitation: revoked.token } };
      },
    ],
    [
      'an expired token',
      async () => {
        const expired = await createInvitation(bksv, 'emmental');
        await backdate(expired.id, '8 days');
        return { email: expired.email, data: { invitation: expired.token } };
      },
    ],
    ['an empty token', async () => ({ email: freshEmail(), data: { invitation: '' } })],
    ['a token that is not a string', async () => ({ email: freshEmail(), data: { invitation: 42 } })],
    [
      'a valid token for another address',
      async () => {
        const other = await createInvitation(bksv, 'emmental');
        return { email: freshEmail(), data: { invitation: other.token } };
      },
    ],
  ])('refuses %s', async (_case, setup) => {
    const { email, data } = await setup();
    const { error } = await signUp(email, data);
    expect(error?.status ?? '(no error)', error?.message).toBe(403);
    expect(error?.message).toBe(REFUSAL);
    expect(await profilesWithEmail(email)).toEqual([]);
  });

  // GoTrue turns down a password under its minimum (10 locally) before it calls the hook. The
  // invitation has to stay open, so the invited person can try again with a longer one.
  it('leaves the invitation open when GoTrue refuses the password', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const { error } = await anonClient().auth.signUp({
      email: invitation.email,
      password: 'too-short',
      options: { data: { invitation: invitation.token } },
    });
    expect(error?.status ?? '(no error)', error?.message).toBe(422);
    expect(error?.code).toBe('weak_password');
    expect(await profilesWithEmail(invitation.email)).toEqual([]);
    expect(await invitationRows(esv, invitation.email)).toEqual([
      { id: invitation.id, used_at: null, used_by: null, revoked_at: null },
    ]);

    const editor = await signUpWithInvitation(invitation.email, invitation.token);
    expect(await profileOf(esv, editor.id)).toMatchObject({ status: 'approved' });
  });

  it('accepts a valid token with the address in upper case', async () => {
    const invitation = await createInvitation(bksv, 'emmental');
    const { data, error } = await signUp(invitation.email.toUpperCase(), {
      invitation: invitation.token,
    });
    expect(error).toBeNull();
    expect(await profileOf(esv, data.user?.id ?? '')).toMatchObject({
      status: 'approved',
      scope_association_id: 'emmental',
    });
  });
});
