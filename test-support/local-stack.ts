import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalTargets } from './local-only';

// Shared by the E2E and integration layers. Both reach the local Compose stack through PostgREST
// as ordinary users: anonymous with the demo anon key, or signed in as the local admin. The
// service-role key does one job here, creating auth users through GoTrue's admin API, because
// public sign-up needs an invitation. It never reaches PostgREST, so a policy or grant that stopped
// permitting something still fails in the tests instead of being bypassed.

// Read from docker/supabase.env, the one file docker compose and CI already read, so rotating the
// demo key cannot leave the tests on a stale one.
export const supabaseEnv = (key: string): string => {
  const file = readFileSync(resolve(process.cwd(), 'docker/supabase.env'), 'utf8');
  const line = file.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`docker/supabase.env has no ${key}`);
  return line.slice(key.length + 1).trim();
};

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';

// globalSetup runs in a separate process from the one that loads .env.local into process.env, so
// its own assertLocalTargets call can miss a cloud URL there. Every process that builds a client
// from SUPABASE_URL checks it again here, at the point the value is actually read.
assertLocalTargets({ supabaseURL: SUPABASE_URL });

// The accounts that docker-compose.yml's admin-init creates through the GoTrue admin API, one per
// level of the Verband tree plus one that waits for approval. db-init sets their profiles from
// supabase/local-accounts.sql. These are local-stack-only credentials, committed alongside the demo
// JWTs in docker/supabase.env for the same reason: `docker compose up` has to work with no setup.
// They authenticate against nothing but a disposable container on this machine.
const LOCAL_PASSWORD = 'schwingadmin';

export const ACCOUNTS = {
  esv: { email: 'admin@schwingkeller.local', password: LOCAL_PASSWORD },
  bksv: { email: 'bksv@schwingkeller.local', password: LOCAL_PASSWORD },
  emmental: { email: 'emmental@schwingkeller.local', password: LOCAL_PASSWORD },
  pending: { email: 'pending@schwingkeller.local', password: LOCAL_PASSWORD },
} as const;

// The super-admin. Most tests sign in as this one.
export const ADMIN = ACCOUNTS.esv;

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, supabaseEnv('ANON_KEY'), clientOptions);

// Creates a confirmed auth user through GoTrue's admin API, the way docker-compose.yml's admin-init
// does, and returns its id. The sign-up trigger then makes the profile from user_metadata.
export const createAuthUser = async (
  email: string,
  password: string,
  userMetadata?: Record<string, unknown>,
): Promise<string> => {
  const key = supabaseEnv('SERVICE_ROLE_KEY');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }),
  });
  const body = await response.text();
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`creating ${email} through the admin API failed: ${response.status} ${body}`);
  }
  return (JSON.parse(body) as { id: string }).id;
};

export const signInAsAdmin = async (email: string, password: string): Promise<SupabaseClient> => {
  const client = createClient(SUPABASE_URL, supabaseEnv('ANON_KEY'), clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`admin sign-in failed against ${SUPABASE_URL}: ${error.message}`);
  return client;
};

// Waits for the stack to answer. Global setup may run before the Compose backend has finished
// coming up, and a bare failure would look like bad credentials rather than a race.
export const signInAsAdminWhenReady = async (
  email: string,
  password: string,
  timeoutMs = 60_000,
): Promise<SupabaseClient> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await signInAsAdmin(email, password);
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
};

export const deleteVenuesNamed = async (client: SupabaseClient, prefix: string): Promise<number> => {
  // `[` and `]` carry no meaning in SQL LIKE, and the prefixes contain no % or _, so they match
  // literally.
  const { data, error } = await client.from('venues').delete().like('name', `${prefix}%`).select('id');
  if (error) throw new Error(`cleanup of "${prefix}" failed: ${error.message}`);
  return data?.length ?? 0;
};

// Deletes every account whose email matches the LIKE pattern, through delete_account(target_id).
// The client has to be the super-admin: its profiles policy lets it read every other account and
// delete_account lets it remove them, with no service-role key involved.
export const deleteAccountsMatching = async (client: SupabaseClient, pattern: string): Promise<number> => {
  const { data, error } = await client.from('profiles').select('id').like('email', pattern);
  if (error) throw new Error(`listing accounts like "${pattern}" failed: ${error.message}`);
  for (const { id } of data ?? []) {
    const { error: deleteError } = await client.rpc('delete_account', { target_id: id });
    if (deleteError) throw new Error(`deleting account ${id} failed: ${deleteError.message}`);
  }
  return data?.length ?? 0;
};

export const countVenuesNamed = async (client: SupabaseClient, prefix: string): Promise<number> => {
  const { count, error } = await client
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .like('name', `${prefix}%`);
  if (error) throw new Error(`count of "${prefix}" failed: ${error.message}`);
  return count ?? 0;
};
