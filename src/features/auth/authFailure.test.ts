import { describe, it, expect } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from '@supabase/supabase-js';
import { signInFailure, signUpFailure } from './authFailure';

describe('signInFailure', () => {
  it('reads a wrong password and an unknown address the same', () => {
    expect(signInFailure(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))).toBe('credentials');
    expect(signInFailure(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))).toBe('credentials');
  });

  it('recognises rate limiting by status or code', () => {
    expect(signInFailure(new AuthApiError('x', 429, 'over_request_rate_limit'))).toBe('rateLimit');
    expect(signInFailure(new AuthApiError('x', 429, undefined))).toBe('rateLimit');
  });

  it('treats network and server errors as unavailable', () => {
    expect(signInFailure(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('unavailable');
    expect(signInFailure(new AuthApiError('x', 500, 'unexpected_failure'))).toBe('unavailable');
  });
});

describe('signUpFailure', () => {
  it('reads every refusal of the invitation the same', () => {
    expect(signUpFailure(new AuthApiError('Sign-up requires a valid invitation.', 403, undefined))).toBe('invitation');
    expect(signUpFailure(new AuthApiError('x', 422, 'email_exists'))).toBe('invitation');
    expect(signUpFailure(new AuthApiError('x', 422, 'signup_disabled'))).toBe('invitation');
  });

  it('keeps a weak password apart', () => {
    expect(signUpFailure(new AuthWeakPasswordError('weak', 422, ['length']))).toBe('weakPassword');
    expect(signUpFailure(new AuthApiError('weak', 422, 'weak_password'))).toBe('weakPassword');
  });

  it('shares rate limiting and unavailability with sign-in', () => {
    expect(signUpFailure(new AuthApiError('x', 429, 'over_request_rate_limit'))).toBe('rateLimit');
    expect(signUpFailure(new AuthApiError('x', 500, 'unexpected_failure'))).toBe('unavailable');
  });
});
