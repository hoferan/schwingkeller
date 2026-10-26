import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/react', () => ({ init: vi.fn(), captureException: vi.fn() }));

import * as SentryMod from '@sentry/react';
import { extractCode, captureAndFormat, initSentry } from './sentry';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('initSentry', () => {
  it('does not call init when DSN is missing', () => {
    initSentry();
    expect(SentryMod.init).not.toHaveBeenCalled();
  });

  it('passes VITE_APP_ENV as environment when set', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/1');
    vi.stubEnv('VITE_APP_ENV', 'stage');
    initSentry();
    expect(SentryMod.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'stage' }),
    );
  });

  it('defaults environment to "development" when VITE_APP_ENV is unset', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/1');
    initSentry();
    expect(SentryMod.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' }),
    );
  });

  it('defaults environment to "development" when VITE_APP_ENV is empty string', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/1');
    vi.stubEnv('VITE_APP_ENV', '');
    initSentry();
    expect(SentryMod.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' }),
    );
  });
});

describe('extractCode', () => {
  it('extracts the code from a [CODE] prefixed message', () => {
    expect(extractCode(new Error('[42883] function not found'))).toBe('42883');
  });
  it('extracts alphanumeric codes', () => {
    expect(extractCode(new Error('[PGRST202] undefined function'))).toBe('PGRST202');
  });
  it('returns null when no [CODE] prefix', () => {
    expect(extractCode(new Error('plain message'))).toBeNull();
  });
  it('returns null for non-Error values', () => {
    expect(extractCode('a string')).toBeNull();
    expect(extractCode(null)).toBeNull();
  });
});

describe('captureAndFormat', () => {
  it('calls Sentry.captureException with the error', () => {
    const err = new Error('[42883] boom');
    captureAndFormat(err, 'Import fehlgeschlagen');
    expect(SentryMod.captureException).toHaveBeenCalledWith(err);
  });
  it('returns fallback with code appended when code is present', () => {
    const result = captureAndFormat(new Error('[42883] boom'), 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen [42883]');
  });
  it('returns fallback only when no code in message', () => {
    const result = captureAndFormat(new Error('plain boom'), 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen');
  });
  it('handles non-Error values without throwing', () => {
    const result = captureAndFormat('a string', 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen');
  });
});

// An invitation token is a credential until it is used. history.replaceState leaves a navigation
// breadcrumb whose `from` still has it, and every later event would carry that breadcrumb.
describe('initSentry keeps invitation tokens out of events', () => {
  type Options = {
    beforeBreadcrumb: (b: { category?: string; data?: Record<string, unknown> }) => { data?: Record<string, unknown> } | null;
    beforeSend: (e: { request?: { url?: string } }) => { request?: { url?: string } } | null;
  };
  const options = (): Options => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://test@sentry.io/1');
    initSentry();
    return vi.mocked(SentryMod.init).mock.calls[0][0] as unknown as Options;
  };

  it('strips the token from navigation breadcrumbs', () => {
    const crumb = options().beforeBreadcrumb({
      category: 'navigation',
      data: { from: '/?vb=emmental&invite=tok', to: '/?vb=emmental' },
    });
    expect(crumb?.data).toEqual({ from: '/?vb=emmental', to: '/?vb=emmental' });
  });

  it('strips the token from request breadcrumbs', () => {
    const crumb = options().beforeBreadcrumb({ category: 'fetch', data: { url: 'https://x.app/?invite=tok' } });
    expect(crumb?.data).toEqual({ url: 'https://x.app/' });
  });

  it('strips the token from the page URL of an event', () => {
    const event = options().beforeSend({ request: { url: 'https://x.app/?invite=tok' } });
    expect(event?.request?.url).toBe('https://x.app/');
  });
});
