import { FEATURES, type AppEnv, type Feature } from '../lib/features';

// The registry's own type has a literal true or false per environment; this view of it takes either.
const flags: Record<Feature, Record<AppEnv, boolean>> = FEATURES;
const REGISTRY = structuredClone(flags);

// Gives a flag one value in every environment. Unit tests set a flag's state with this rather than
// by stubbing VITE_APP_ENV, so they don't depend on the registry's values and keep passing when a
// flag is switched on or off somewhere.
export const setFeature = (name: Feature, on: boolean): void => {
  flags[name] = { development: on, stage: on, production: on };
};

// vitest.setup.ts runs this after every test.
export const restoreFeatures = (): void => {
  Object.assign(flags, structuredClone(REGISTRY));
};
