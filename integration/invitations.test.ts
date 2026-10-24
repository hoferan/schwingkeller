import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, anonClient } from '../test-support/local-stack';
import {
  approvedEditor,
  createInvitation,
  expectNotAuthorized,
  invitationRows,
  signInAs,
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

const freshEmail = (): string => `int-${crypto.randomUUID()}@schwingkeller.local`;

const invite = (client: SupabaseClient, scope: string, email = freshEmail()) =>
  client.rpc('create_invitation', { target_email: email, scope });

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

describe('can_invite / create_invitation', () => {
  it.each(['bksv', 'emmental'])('lets a bksv editor invite for %s', async (scope) => {
    const { data, error } = await invite(bksv, scope);
    expect(error).toBeNull();
    expect(data).toMatch(TOKEN);
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

  it('purges invitations revoked or expired more than 30 days ago', async () => {
    const revoked = await createInvitation(bksv, 'emmental');
    await revoke(bksv, revoked.id);
    await backdate(revoked.id, '31 days');
    const expired = await createInvitation(bksv, 'emmental');
    await backdate(expired.id, '38 days');
    const recent = await createInvitation(bksv, 'emmental');
    await backdate(recent.id, '20 days');

    const { error } = await invite(bksv, 'emmental');
    expect(error).toBeNull();

    expect(await invitationRows(esv, revoked.email)).toEqual([]);
    expect(await invitationRows(esv, expired.email)).toEqual([]);
    expect(await invitationRows(esv, recent.email)).toHaveLength(1);
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

  it('gives anonymous callers nothing', async () => {
    const { error } = await anonClient().from('invitations').select('id').limit(1);
    expect(error?.code ?? '(no error)', error?.message).toBe('42501');
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
