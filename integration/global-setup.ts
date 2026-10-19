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
  // A throwaway super-admin that a crashed run left approved would make the admin stop being the
  // last one. So would test users that 0011 found on an older volume and approved as esv.
  const { data: extraAdmins, error: adminsError } = await admin
    .from('profiles')
    .select('id')
    .eq('status', 'approved')
    .eq('scope_association_id', 'esv')
    .like('email', 'int-%');
  if (adminsError) throw new Error(`listing leftover super-admins failed: ${adminsError.message}`);
  for (const { id } of extraAdmins) {
    const { error: suspendError } = await admin.rpc('suspend_editor', { target_id: id });
    if (suspendError)
      throw new Error(`suspending leftover super-admin ${id} failed: ${suspendError.message}`);
  }

  if (venues > 0 || files.length > 0 || extraAdmins.length > 0) {
    console.log(
      `[int] swept ${venues} venue(s), ${files.length} file(s) and ${extraAdmins.length} super-admin(s) left over from a previous run`,
    );
  }
}
