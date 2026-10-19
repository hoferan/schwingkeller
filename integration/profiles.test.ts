import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ACCOUNTS, ADMIN, anonClient, signInAsAdmin } from '../test-support/local-stack';
import { type Profile, profileOf, signInAs, signUpApplicant } from './support';

// Reads every profile the caller may see: their own, and the ones they manage.
const visibleProfiles = async (client: SupabaseClient): Promise<Profile[]> => {
  const { data, error } = await client.from('profiles').select('*');
  if (error) throw new Error(`reading profiles failed: ${error.message}`);
  return data;
};

const ownProfile = async (client: SupabaseClient): Promise<Profile> => {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error(`reading the signed-in user failed: ${error.message}`);
  return profileOf(client, data.user.id);
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

describe('managed profiles', () => {
  // PostgREST returns at most 1000 rows, and a reused local volume collects more applicants than
  // that, so this pages through them.
  const allVisible = async (client: SupabaseClient): Promise<Profile[]> => {
    const rows: Profile[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .order('id')
        .range(from, from + 999);
      if (error) throw new Error(`reading profiles failed: ${error.message}`);
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };

  const idOf = async (client: SupabaseClient): Promise<string> => {
    const { data, error } = await client.auth.getUser();
    if (error) throw new Error(`reading the signed-in user failed: ${error.message}`);
    return data.user.id;
  };

  const isWithin = async (node: string, scope: string): Promise<boolean> => {
    const { data, error } = await anonClient().rpc('association_is_within', { node, scope });
    if (error) throw new Error(`association_is_within failed: ${error.message}`);
    return data;
  };

  it('shows a bksv editor their own profile and the ones below BKSV, and no others', async () => {
    const [bksv, pending] = await Promise.all([signInAs('bksv'), signInAs('pending')]);
    const [bksvId, pendingId, adminId] = await Promise.all([
      idOf(bksv),
      idOf(pending),
      idOf(admin),
    ]);
    const [inEmmental, inLuzern, inBksv, inEsv] = await Promise.all(
      ['emmental', 'luzern', 'bksv', 'esv'].map((requested) => signUpApplicant(requested)),
    );

    const rows = await allVisible(bksv);
    const ids = rows.map((p) => p.id);
    expect(ids).toContain(bksvId);
    expect(ids).toContain(inEmmental.id);
    expect(ids).toContain(pendingId);
    for (const hidden of [inLuzern.id, inBksv.id, inEsv.id, adminId])
      expect(ids).not.toContain(hidden);

    const nodes = new Set(
      rows
        .filter((p) => p.id !== bksvId)
        .map((p) => p.scope_association_id ?? p.requested_association_id),
    );
    expect(nodes).not.toContain(null);
    expect(nodes).not.toContain('bksv');
    for (const node of nodes) expect(await isWithin(node ?? '', 'bksv'), node ?? '').toBe(true);
  });

  it('shows an emmental editor only their own profile', async () => {
    const emmental = await signInAs('emmental');
    await signUpApplicant('emmental');
    const rows = await visibleProfiles(emmental);
    expect(rows.map((p) => p.id)).toEqual([await idOf(emmental)]);
  });

  it('shows the super-admin every profile', async () => {
    const accounts = await Promise.all([
      signInAs('bksv'),
      signInAs('emmental'),
      signInAs('pending'),
    ]);
    const expected = [...(await Promise.all(accounts.map(idOf))), await idOf(admin)];
    const unknown = await signUpApplicant('no-such-verband');
    const ids = (await allVisible(admin)).map((p) => p.id);
    for (const id of [...expected, unknown.id]) expect(ids).toContain(id);
  });
});
