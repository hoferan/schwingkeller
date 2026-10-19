import {
  ADMIN, deleteAccountsMatching, deleteVenuesNamed, signInAsAdminWhenReady,
} from '../test-support/local-stack';
import { APPLICANT_DOMAIN, APPLICANT_PREFIX, E2E_PREFIX } from './db';

// Clears venues and applicant accounts left behind by a run that died before its per-test cleanup
// could fire. Matters most locally, where the db-data volume survives between runs; a CI runner
// starts empty anyway.
export default async function globalSetup() {
  const client = await signInAsAdminWhenReady(ADMIN.email, ADMIN.password);
  const removed = await deleteVenuesNamed(client, E2E_PREFIX);
  if (removed > 0) console.log(`[e2e] swept ${removed} venue(s) left over from a previous run`);
  // `-` and `.` mean nothing to LIKE, so only the `%` in the middle is a wildcard.
  const accounts = await deleteAccountsMatching(client, `${APPLICANT_PREFIX}%${APPLICANT_DOMAIN}`);
  if (accounts > 0) console.log(`[e2e] swept ${accounts} applicant account(s) left over from a previous run`);
}
