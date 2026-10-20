import { captureAndFormat, extractCode } from '../../lib/sentry';

export type AdminErrorKey = 'adminErrNotAuthorized' | 'adminErrStale' | 'adminErrLastSuperAdmin' | 'adminErrGeneric';

// Turns an editor RPC error into a message key. The texts come from the RPCs in
// supabase/migrations/0012_authorization.sql and 0013_delete_account.sql. Only an error the panel
// can't explain goes to Sentry.
export const adminErrorKey = (err: unknown): AdminErrorKey => {
  if (err instanceof Error) {
    if (extractCode(err) === '42501') return 'adminErrNotAuthorized';
    const message = err.message.replace(/^\[\w+\] /, '');
    if (message.includes('last super-admin')) return 'adminErrLastSuperAdmin';
    if (/^cannot .+ an account that is /.test(message)) return 'adminErrStale';
  }
  captureAndFormat(err, 'admin action failed');
  return 'adminErrGeneric';
};
