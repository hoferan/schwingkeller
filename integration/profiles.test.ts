import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, signInAsAdmin } from '../test-support/local-stack';

type Profile = {
  id: string;
  email: string;
  status: string;
  requested_association_id: string | null;
  scope_association_id: string | null;
};

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

// Local sign-up is on and autoconfirmed, so signUp returns a live session. These users stay in the
// local database: nothing can delete them without the service-role key. CI starts from scratch.
const signUpRequesting = async (association: string): Promise<SupabaseClient> => {
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email: `int-${crypto.randomUUID()}@schwingkeller.local`,
    password: 'int-password',
    options: { data: { association } },
  });
  if (error) throw new Error(`sign-up failed: ${error.message}`);
  if (!data.session) throw new Error('sign-up returned no session; is GOTRUE_MAILER_AUTOCONFIRM on?');
  return client;
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
    await signUpRequesting('emmental');
    const { data } = await admin.auth.getUser();
    const rows = await visibleProfiles(admin);
    expect(rows.map((p) => p.id)).toEqual([data.user?.id]);
  });

  it('refuses anonymous reads', async () => {
    const { error } = await anonClient().from('profiles').select('id');
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table profiles/);
  });

  it("doesn't let a user change their own status or scope", async () => {
    const applicant = await signUpRequesting('emmental');
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
    const applicant = await signUpRequesting(requested);
    expect(await ownProfile(applicant)).toMatchObject({
      status: 'pending',
      requested_association_id: stored,
      scope_association_id: null,
    });
  });
});
