import { supabase } from '../../lib/supabase';
import { captureAndFormat, extractCode } from '../../lib/sentry';
import { toError } from './profile';

export class WrongPasswordError extends Error {
  constructor() {
    super('wrong password');
    this.name = 'WrongPasswordError';
  }
}

export type DeleteOwnErrorKey =
  | 'deleteOwnErrPassword'
  | 'deleteOwnErrLastSuperAdmin'
  | 'deleteOwnErrTooMany'
  | 'adminErrGeneric';

// Deletes the signed-in account (#31). Signing in again checks the password, so an unattended session
// can't delete the account; a failed sign-in leaves the current session as it is. delete_account
// without a target deletes the caller (supabase/migrations/0013_delete_account.sql).
//
// A correct password starts a new session. If the deletion then fails, the session it replaced stays
// valid on the server until it expires; the browser only keeps the new one.
export const deleteOwnAccount = async (email: string, password: string): Promise<void> => {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    if (signInError.code === 'invalid_credentials') throw new WrongPasswordError();
    throw toError({ message: signInError.message, code: signInError.code });
  }
  const { error } = await supabase.rpc('delete_account');
  if (error) throw toError(error);
  // The account is gone either way, so a failed sign-out doesn't make the deletion fail. Supabase
  // Auth ignores the answer for a deleted user and only keeps the session on errors such as a
  // dropped connection, so one more try covers the likely case. If that fails too, the app looks
  // signed in until the token runs out (ADR 0019 lists what such a token can still do).
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) await supabase.auth.signOut({ scope: 'local' });
};

// Turns a failed deletion into a message key. Only an error the dialog can't explain goes to Sentry.
export const deleteOwnErrorKey = (err: unknown): DeleteOwnErrorKey => {
  if (err instanceof WrongPasswordError) return 'deleteOwnErrPassword';
  if (err instanceof Error && err.message.includes('last super-admin')) return 'deleteOwnErrLastSuperAdmin';
  // Supabase Auth throttles sign-ins. Nothing is wrong apart from the pace.
  if (extractCode(err) === 'over_request_rate_limit') return 'deleteOwnErrTooMany';
  captureAndFormat(err, 'delete own account failed');
  return 'adminErrGeneric';
};
