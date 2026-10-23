import { supabase } from '../../lib/supabase';
import { captureAndFormat } from '../../lib/sentry';
import { toError } from './profile';

export class WrongPasswordError extends Error {
  constructor() {
    super('wrong password');
    this.name = 'WrongPasswordError';
  }
}

export type DeleteOwnErrorKey = 'deleteOwnErrPassword' | 'deleteOwnErrLastSuperAdmin' | 'adminErrGeneric';

// Deletes the signed-in account (#31). Signing in again checks the password, so an unattended session
// can't delete the account; a failed sign-in leaves the current session as it is. delete_account
// without a target deletes the caller (supabase/migrations/0013_delete_account.sql).
export const deleteOwnAccount = async (email: string, password: string): Promise<void> => {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    if (signInError.code === 'invalid_credentials') throw new WrongPasswordError();
    throw toError({ message: signInError.message, code: signInError.code });
  }
  const { error } = await supabase.rpc('delete_account');
  if (error) throw toError(error);
  // The account is gone either way. A failed sign-out leaves a session the server no longer accepts,
  // so it doesn't count as a failed deletion.
  await supabase.auth.signOut({ scope: 'local' });
};

// Turns a failed deletion into a message key. Only an error the dialog can't explain goes to Sentry.
export const deleteOwnErrorKey = (err: unknown): DeleteOwnErrorKey => {
  if (err instanceof WrongPasswordError) return 'deleteOwnErrPassword';
  if (err instanceof Error && err.message.includes('last super-admin')) return 'deleteOwnErrLastSuperAdmin';
  captureAndFormat(err, 'delete own account failed');
  return 'adminErrGeneric';
};
