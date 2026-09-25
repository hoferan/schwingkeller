import { describe, expect, it } from 'vitest';
import { assertLocalTargets } from './local-only';

describe('assertLocalTargets', () => {
  it('accepts the local stack by name and by address', () => {
    expect(() =>
      assertLocalTargets({ baseURL: 'http://localhost:5173', supabaseURL: 'http://127.0.0.1:54321' }),
    ).not.toThrow();
  });

  it('rejects the cloud Supabase project and names it', () => {
    expect(() =>
      assertLocalTargets({ supabaseURL: 'https://abcdefghijklmnopqrst.supabase.co' }),
    ).toThrow(/supabaseURL .*abcdefghijklmnopqrst\.supabase\.co/);
  });

  it('rejects the production site as the base URL', () => {
    expect(() => assertLocalTargets({ baseURL: 'https://schwingkeller.netlify.app' })).toThrow(
      /baseURL/,
    );
  });

  it('rejects a host that only starts with localhost', () => {
    expect(() => assertLocalTargets({ baseURL: 'http://localhost.evil.example:5173' })).toThrow(
      /baseURL/,
    );
  });

  it('rejects a value that is not a URL', () => {
    expect(() => assertLocalTargets({ supabaseURL: 'not a url' })).toThrow(/not a valid URL/);
  });
});
