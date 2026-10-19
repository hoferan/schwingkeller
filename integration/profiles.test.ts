import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, ADMIN, anonClient, signInAsAdmin } from '../test-support/local-stack';
import { type Profile, signUpApplicant } from './support';

// Reads every profile the caller may see. The policy allows only the caller's own row.
const visibleProfiles = async (client: SupabaseClient): Promise<Profile[]> => {
  const { data, error } = await client.from('profiles').select('*');
  if (error) throw new Error(`reading profiles failed: ${error.message}`);
  return data;
};

const ownProfile = async (client: SupabaseClient): Promise<Profile> => {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(`reading the signed-in user failed: ${error.message}`);
  const rows = await visibleProfiles(client);
  const own = rows.find((p) => p.id === data.user.id);
  if (!own) throw new Error(`no profile for ${data.user.email}`);
  return own;
};

let admin: SupabaseClient;

beforeAll(async () => {
  admin = await signInAsAdmin(ADMIN.email, ADMIN.password);
});

describe('profiles', () => {
  it('gives the local admin an approved esv profile', async () => {
    const profile = await ownProfile(admin);
    expect(profile).toMatchObject({ email: ADMIN.email, status: 'approved', scope_association_id: 'esv' });
  });

  it('shows a signed-in user their own row and no other', async () => {
    await signUpApplicant('emmental');
    const { client, id } = await signUpApplicant('emmental');
    const rows = await visibleProfiles(client);
    expect(rows.map((p) => p.id)).toEqual([id]);
  });

  it('refuses anonymous reads', async () => {
    const { error } = await anonClient().from('profiles').select('id');
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table profiles/);
  });

  it("doesn't let a user change their own status or scope", async () => {
    const { client: applicant } = await signUpApplicant('emmental');
    const before = await ownProfile(applicant);
    const { error } = await applicant
      .from('profiles')
      .update({ status: 'approved', scope_association_id: 'esv' })
      .eq('id', before.id);
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table profiles/);
    expect(await ownProfile(applicant)).toEqual(before);
  });

  it.each([
    ['emmental', 'emmental'],
    ['bksv', 'bksv'],
    ['esv', 'esv'],
    ['no-such-verband', null],
  ])('creates a pending profile for a sign-up requesting %s', async (requested, stored) => {
    const { client: applicant } = await signUpApplicant(requested);
    expect(await ownProfile(applicant)).toMatchObject({
      status: 'pending',
      requested_association_id: stored,
      scope_association_id: null,
    });
  });
});

describe('local test accounts', () => {
  it.each([
    ['esv', { status: 'approved', scope_association_id: 'esv', requested_association_id: null }],
    ['bksv', { status: 'approved', scope_association_id: 'bksv', requested_association_id: null }],
    ['emmental', { status: 'approved', scope_association_id: 'emmental', requested_association_id: null }],
    ['pending', { status: 'pending', scope_association_id: null, requested_association_id: 'emmental' }],
  ] as const)('signs in as %s with the expected profile', async (name, expected) => {
    const account = ACCOUNTS[name];
    const client = await signInAsAdmin(account.email, account.password);
    expect(await ownProfile(client)).toMatchObject({ email: account.email, ...expected });
  });
});
