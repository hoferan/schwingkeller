// Feature flags, one boolean per environment. Flip a value in a pull request to change a flag, and
// delete the entry to remove it: TypeScript then reports every isFeatureOn call that is left. See
// docs/adr/0017-feature-flags-from-one-registry.md.

export type AppEnv = 'development' | 'stage' | 'production';

export const FEATURES = {
  // Group and manage venues by Schwingerverband. Removed in #72.
  verband: { development: true, stage: true, production: false },
} satisfies Record<string, Record<AppEnv, boolean>>;

export type Feature = keyof typeof FEATURES;

// VITE_APP_ENV is unset locally, `stage` on Netlify previews and `production` in the CI deploy
// build. Unset reads as `development`, like the Sentry environment. Any other value reads as
// `production`, so a mistyped build shows what visitors see.
export const appEnv = (): AppEnv => {
  const env = import.meta.env.VITE_APP_ENV;
  if (!env || env === 'development') return 'development';
  if (env === 'stage') return 'stage';
  return 'production';
};

export const isFeatureOn = (name: Feature): boolean => FEATURES[name][appEnv()];
