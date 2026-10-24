import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { expect } from 'vitest';
import { ACCOUNTS, anonClient, createAuthUser, signInAsAdmin } from '../test-support/local-stack';

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
  invited_by: string | null;
};

// An address no account or invitation has used yet.
export const freshEmail = (): string => `int-${crypto.randomUUID()}@schwingkeller.local`;

export type Applicant = { client: SupabaseClient; id: string; email: string; password: string };

// Creates the account through GoTrue's admin API, since public sign-up needs an invitation, then
// signs in as it. These users stay in the local database unless a test deletes them through
// delete_account. CI starts from scratch.
export const signUpApplicant = async (
  requested: string,
  email = freshEmail(),
): Promise<Applicant> => {
  const password = 'int-password';
  const id = await createAuthUser(email, password, { association: requested });
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in of ${email} failed: ${error.message}`);
  return { client, id, email, password };
};

// Signs up through public sign-up with an invitation token, the way an invited editor does. Local
// sign-up is autoconfirmed, so this returns a live session.
export const signUpWithInvitation = async (email: string, token: string): Promise<Applicant> => {
  const client = anonClient();
  const password = 'int-password';
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { invitation: token } },
  });
  if (error) throw new Error(`sign-up of ${email} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up of ${email} returned no session; is GOTRUE_MAILER_AUTOCONFIRM on?`);
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

// A throwaway editor with this scope, made the way a real one is: the approver invites a fresh
// address and it signs up with the token.
export const approvedEditor = async (
  approver: SupabaseClient,
  scope: string,
): Promise<Applicant> => {
  const invitation = await createInvitation(approver, scope);
  return signUpWithInvitation(invitation.email, invitation.token);
};

export type InvitationRow = {
  id: string;
  used_at: string | null;
  used_by: string | null;
  revoked_at: string | null;
};

// Every invitation row for email, oldest first, including those the select policy hides. Reads
// through the local-only test_invitation_rows.
export const invitationRows = async (
  reader: SupabaseClient,
  email: string,
): Promise<InvitationRow[]> => {
  const { data, error } = await reader.rpc('test_invitation_rows', { target_email: email });
  if (error) throw new Error(`reading invitations of ${email} failed: ${error.message}`);
  return data as InvitationRow[];
};

export type Invitation = { id: string; token: string; email: string };

// The inviter invites email for scope. email comes back trimmed and lower-cased, as stored, and id
// is that address's open invitation.
export const createInvitation = async (
  inviter: SupabaseClient,
  scope: string,
  email = freshEmail(),
): Promise<Invitation> => {
  const { data: token, error } = await inviter.rpc('create_invitation', {
    target_email: email,
    scope,
  });
  if (error) throw new Error(`inviting ${email} as ${scope} failed: ${error.message}`);
  const normalised = email.trim().toLowerCase();
  const open = (await invitationRows(inviter, normalised)).find(
    (r) => r.used_at === null && r.revoked_at === null,
  );
  if (!open) throw new Error(`no open invitation for ${normalised}`);
  return { id: open.id, token: token as string, email: normalised };
};

// The refusal every editor RPC gives a caller who doesn't manage the target. Checks the code, so a
// missing function (PGRST202) doesn't pass for a refusal.
export const expectNotAuthorized = (result: { error: PostgrestError | null }): void => {
  expect(result.error?.code ?? '(no error)', result.error?.message).toBe('42501');
  expect(result.error?.message).toBe('not authorized');
};
