import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { expect } from 'vitest';
import { ACCOUNTS, anonClient, signInAsAdmin } from '../test-support/local-stack';

// Everything the integration tests create carries these, so a sweep can find what a crashed run
// left behind. Grisons, because the seed has no venue there, and Graubünden, its association.
export const INT_PREFIX = '[int]';
export const INT_STORAGE_DIR = 'int-test';
export const PHOTO_BUCKET = 'venue-photos';

export type VenueRow = {
  name: string;
  canton: string;
  lat: number;
  lng: number;
  association_id: string;
};

export const newVenueRow = (label: string): VenueRow => ({
  name: `${INT_PREFIX} ${label} ${crypto.randomUUID().slice(0, 8)}`,
  canton: 'GR',
  lat: 46.85,
  lng: 9.53,
  association_id: 'graubuenden',
});

export const insertVenue = async (
  client: SupabaseClient,
  label: string,
  extra: { association_id?: string | null } = {},
): Promise<{ id: string; name: string }> => {
  const { data, error } = await client
    .from('venues')
    .insert({ ...newVenueRow(label), ...extra })
    .select('id, name')
    .single();
  if (error) throw new Error(`inserting "${label}" failed: ${error.message}`);
  return data;
};

// A venue from supabase/seed.sql, never one a test created.
export const seedVenue = async (
  client: SupabaseClient,
): Promise<{ id: string; name: string; address: string | null }> => {
  const { data, error } = await client
    .from('venues')
    .select('id, name, address')
    .not('name', 'like', '[%')
    .order('name')
    .limit(1)
    .single();
  if (error) throw new Error(`reading a seed venue failed: ${error.message}`);
  return data;
};

export type Level = keyof typeof ACCOUNTS;

export const signInAs = (level: Level): Promise<SupabaseClient> =>
  signInAsAdmin(ACCOUNTS[level].email, ACCOUNTS[level].password);

export type Profile = {
  id: string;
  email: string;
  status: string;
  requested_association_id: string | null;
  scope_association_id: string | null;
};

export type Applicant = { client: SupabaseClient; id: string; email: string; password: string };

// Local sign-up is on and autoconfirmed, so signUp returns a live session. These users stay in the
// local database unless a test deletes them through delete_account. CI starts from scratch.
export const signUpApplicant = async (
  requested: string,
  email = `int-${crypto.randomUUID()}@schwingkeller.local`,
): Promise<Applicant> => {
  const client = anonClient();
  const password = 'int-password';
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { association: requested } },
  });
  if (error) throw new Error(`sign-up failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error('sign-up returned no session; is GOTRUE_MAILER_AUTOCONFIRM on?');
  }
  return { client, id: data.user.id, email, password };
};

// Reads one profile row. Throws when the reader can't see it.
export const profileOf = async (reader: SupabaseClient, id: string): Promise<Profile> => {
  const { data, error } = await reader.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`reading profile ${id} failed: ${error.message}`);
  if (!data) throw new Error(`profile ${id} is not visible to this reader`);
  return data;
};

// A throwaway applicant that the approver approves at once with this scope.
export const approvedEditor = async (
  approver: SupabaseClient,
  scope: string,
): Promise<Applicant> => {
  const applicant = await signUpApplicant(scope);
  const { error } = await approver.rpc('approve_editor', { target_id: applicant.id, scope });
  if (error) throw new Error(`approving an applicant as ${scope} failed: ${error.message}`);
  return applicant;
};

// The refusal every editor RPC gives a caller who doesn't manage the target. Checks the code, so a
// missing function (PGRST202) doesn't pass for a refusal.
export const expectNotAuthorized = (result: { error: PostgrestError | null }): void => {
  expect(result.error?.code ?? '(no error)', result.error?.message).toBe('42501');
  expect(result.error?.message).toBe('not authorized');
};
