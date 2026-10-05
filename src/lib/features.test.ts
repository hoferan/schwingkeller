import { describe, it, expect, vi, afterEach } from 'vitest';
import { FEATURES, appEnv, isFeatureOn, type AppEnv } from './features';

afterEach(() => { vi.unstubAllEnvs(); });

describe('appEnv', () => {
  it('is "development" when VITE_APP_ENV is unset', () => {
    vi.stubEnv('VITE_APP_ENV', undefined);
    expect(appEnv()).toBe('development');
  });

  it('is "development" when VITE_APP_ENV is empty, as in sentry.ts', () => {
    vi.stubEnv('VITE_APP_ENV', '');
    expect(appEnv()).toBe('development');
  });

  it.each(['development', 'stage', 'production'] as const)('passes "%s" through', (env) => {
    vi.stubEnv('VITE_APP_ENV', env);
    expect(appEnv()).toBe(env);
  });

  it.each(['test', 'Production', 'prod'])('treats unknown "%s" as production', (env) => {
    vi.stubEnv('VITE_APP_ENV', env);
    expect(appEnv()).toBe('production');
  });
});

describe('isFeatureOn', () => {
  it.each(['development', 'stage', 'production'] as AppEnv[])(
    'reads the "%s" column of the table',
    (env) => {
      vi.stubEnv('VITE_APP_ENV', env);
      expect(isFeatureOn('verband')).toBe(FEATURES.verband[env]);
    },
  );

  it('ships verband on locally and on previews, off in production', () => {
    expect(FEATURES.verband).toEqual({ development: true, stage: true, production: false });
  });
});
