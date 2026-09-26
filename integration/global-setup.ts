import { assertLocalTargets } from '../test-support/local-only';
import { ADMIN, SUPABASE_URL, deleteVenuesNamed, signInAsAdminWhenReady } from '../test-support/local-stack';
import { INT_PREFIX, INT_STORAGE_DIR, PHOTO_BUCKET } from './support';

// Refuses anything but the local stack, waits for it, and clears what a crashed run left behind.
export default async function globalSetup(): Promise<void> {
  assertLocalTargets({ supabaseURL: SUPABASE_URL });
  const admin = await signInAsAdminWhenReady(ADMIN.email, ADMIN.password, 90_000);

  const venues = await deleteVenuesNamed(admin, INT_PREFIX);
  const bucket = admin.storage.from(PHOTO_BUCKET);
  const { data: files, error } = await bucket.list(INT_STORAGE_DIR);
  if (error) throw new Error(`listing ${INT_STORAGE_DIR}/ failed: ${error.message}`);
  if (files.length > 0) {
    const { error: removeError } = await bucket.remove(files.map((f) => `${INT_STORAGE_DIR}/${f.name}`));
    if (removeError) throw new Error(`sweeping ${INT_STORAGE_DIR}/ failed: ${removeError.message}`);
  }
  if (venues > 0 || files.length > 0) {
    console.log(`[int] swept ${venues} venue(s) and ${files.length} file(s) left over from a previous run`);
  }
}
