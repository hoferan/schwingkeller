import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Test data lives in the same Postgres the app talks to, reached through PostgREST as an ordinary
// authenticated user. No service-role key: the venues policies already allow authenticated insert,
// update and delete, so the specs clean up through exactly the path the app uses and a policy that
// stopped permitting a write would fail here too rather than being silently bypassed.

// Read from docker/supabase.env, the one file docker compose and the CI job already read, so
// rotating the demo key cannot leave this pointing at a stale one.
const supabaseEnv = (key: string): string => {
  const file = readFileSync(resolve(process.cwd(), 'docker/supabase.env'), 'utf8');
  const line = file.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`docker/supabase.env has no ${key}`);
  return line.slice(key.length + 1).trim();
};

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';

// Every venue a spec creates carries this, so a sweep can find leftovers from a run that crashed
// before its cleanup ran. Deliberately not a name any real venue would have.
export const E2E_PREFIX = '[e2e]';

// Specs write into a canton the seed leaves empty, so a venue in flight can never disturb a spec
// that counts Fribourg's labels.
export const WRITE_CANTON = 'GR';

export const signInAsAdmin = async (email: string, password: string): Promise<SupabaseClient> => {
  const client = createClient(SUPABASE_URL, supabaseEnv('ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`e2e admin sign-in failed against ${SUPABASE_URL}: ${error.message}`);
  return client;
};

// Waits for the stack to answer. Playwright may run global setup before the Compose backend has
// finished coming up, and a bare failure here would look like bad credentials rather than a race.
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
  // `[` and `]` carry no meaning in SQL LIKE, and the prefix contains no % or _, so it matches
  // literally.
  const { data, error } = await client.from('venues').delete().like('name', `${prefix}%`).select('id');
  if (error) throw new Error(`e2e cleanup of "${prefix}" failed: ${error.message}`);
  return data?.length ?? 0;
};

export const countVenuesNamed = async (client: SupabaseClient, prefix: string): Promise<number> => {
  const { count, error } = await client
    .from('venues')
    .select('id', { count: 'exact', head: true })
    .like('name', `${prefix}%`);
  if (error) throw new Error(`e2e count of "${prefix}" failed: ${error.message}`);
  return count ?? 0;
};
