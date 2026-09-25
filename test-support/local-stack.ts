import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalTargets } from './local-only';

// Shared by the E2E and integration layers. Both reach the local Compose stack through PostgREST
// as ordinary users: anonymous with the demo anon key, or signed in as the local admin. No
// service-role key, so a policy or grant that stopped permitting something fails in the tests too
// instead of being bypassed.

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

// The admin that docker-compose.yml's admin-init creates through the GoTrue admin API. These are
// local-stack-only credentials, committed alongside the demo JWTs in docker/supabase.env for the
// same reason: `docker compose up` has to work with no setup. They authenticate against nothing
// but a disposable container on this machine.
export const ADMIN = {
  email: 'admin@schwingkeller.local',
  password: 'schwingadmin',
} as const;

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, supabaseEnv('ANON_KEY'), clientOptions);

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

export const countVenuesNamed = async (client: SupabaseClient, prefix: string): Promise<number> => {
  const { count, error } = await client
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .like('name', `${prefix}%`);
  if (error) throw new Error(`count of "${prefix}" failed: ${error.message}`);
  return count ?? 0;
};
