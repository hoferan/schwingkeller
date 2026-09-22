import { ADMIN } from './fixtures';
import { E2E_PREFIX, deleteVenuesNamed, signInAsAdminWhenReady } from './db';

// Clears venues left behind by a run that died before its per-test cleanup could fire. Matters
// most locally, where the db-data volume survives between runs; a CI runner starts empty anyway.
export default async function globalSetup() {
  const client = await signInAsAdminWhenReady(ADMIN.email, ADMIN.password);
  const removed = await deleteVenuesNamed(client, E2E_PREFIX);
  if (removed > 0) console.log(`[e2e] swept ${removed} venue(s) left over from a previous run`);
}
