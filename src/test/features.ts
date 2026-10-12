import { FEATURES, type AppEnv, type Feature } from '../lib/features';

// The registry's own type has a literal true or false per environment; this view of it takes either.
const flags: Record<Feature, Record<AppEnv, boolean>> = FEATURES;
const REGISTRY = structuredClone(flags);

// Gives a flag one value in every environment, for unit tests of a state that no environment has.
// The canton view needs it while its code is still there with the verband flag on everywhere; #72
// removes both.
export const setFeature = (name: Feature, on: boolean): void => {
  flags[name] = { development: on, stage: on, production: on };
};

// vitest.setup.ts runs this after every test.
export const restoreFeatures = (): void => {
  Object.assign(flags, structuredClone(REGISTRY));
};
