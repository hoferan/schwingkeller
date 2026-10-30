import { FEATURES, type AppEnv, type Feature } from '../src/lib/features';

type FlagTags = { on?: string; off?: string };

// A scenario that needs one state of a flag carries that state's tag. A flag without e2e
// scenarios of its own has no entry.
export const FLAG_TAGS: Partial<Record<Feature, FlagTags>> = {
  verband: { on: '@verband-view', off: '@canton-view' },
  editors: { on: '@editors' },
};

// The tag filter for a bundle built for `env`: it skips each scenario tagged with a state its flag
// doesn't have there. The Playwright config builds every project's filter with this, so switching
// a flag in src/lib/features.ts moves its scenarios to the right bundles without a config change.
export const flagTagFilter = (
  env: AppEnv,
  flags: Partial<Record<string, Record<AppEnv, boolean>>> = FEATURES,
  tags: Partial<Record<string, FlagTags>> = FLAG_TAGS,
): string =>
  Object.entries(tags)
    .map(([name, tag]) => (flags[name]?.[env] ? tag?.off : tag?.on))
    .filter((tag): tag is string => !!tag)
    .map((tag) => `not ${tag}`)
    .join(' and ');

export type Layout = 'phone' | 'tablet';

// The tag expression for a project: the flag filter for its bundle, then its layout. A phone or
// tablet project runs only the scenarios tagged for it, and every desktop project skips both.
export const projectTags = (
  env: AppEnv,
  layout?: Layout,
  flags: Partial<Record<string, Record<AppEnv, boolean>>> = FEATURES,
  tags: Partial<Record<string, FlagTags>> = FLAG_TAGS,
): string =>
  [flagTagFilter(env, flags, tags), layout ? `@${layout}` : 'not @phone and not @tablet']
    .filter((part) => part !== '')
    .join(' and ');
