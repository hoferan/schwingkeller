import { isAuthRetryableFetchError, isAuthWeakPasswordError, type AuthError } from '@supabase/supabase-js';

// What went wrong with a sign-in or sign-up, as far as the person in front of the form needs to
// know. Supabase's own messages are English and some of them say whether an address has an
// account, so the forms only ever show a translated message for one of these.
export type AuthFailure = 'credentials' | 'invitation' | 'weakPassword' | 'rateLimit' | 'unavailable';
export type SignInFailure = Extract<AuthFailure, 'credentials' | 'rateLimit' | 'unavailable'>;

const isRateLimited = (error: AuthError) => error.status === 429 || error.code === 'over_request_rate_limit';

const isUnavailable = (error: AuthError) =>
  isAuthRetryableFetchError(error) || !error.status || error.status >= 500;

export const signInFailure = (error: AuthError): SignInFailure => {
  if (isRateLimited(error)) return 'rateLimit';
  if (isUnavailable(error)) return 'unavailable';
  return 'credentials';
};

// Two sign-ups racing for one token both pass the hook, and the loser fails in the trigger with
// GoTrue's 500 (ADR 0020). It reads as the service being unavailable, which is close enough: the
// account it wanted exists by then.
export const signUpFailure = (error: AuthError): AuthFailure => {
  if (isRateLimited(error)) return 'rateLimit';
  if (isAuthWeakPasswordError(error) || error.code === 'weak_password') return 'weakPassword';
  if (isUnavailable(error)) return 'unavailable';
  return 'invitation';
};
