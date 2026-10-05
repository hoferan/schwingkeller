---
status: proposed
date: 2026-10-02
decision-makers: André Hofer
---

# Feature flags as one table in code, with a value per environment

## Context and problem statement

The site is live. The Verband view ([ADR 0015](0015-organise-venues-by-schwingerverband.md)) has to
ship dark, be tried on production data, and only then be switched on for everyone. The app had no
flag mechanism. The only build switch was `VITE_APP_ENV`, which is unset locally, `stage` on
Netlify deploy previews and `production` in the CI `deploy` build. The question was how to set a
flag independently for local development, previews and production.

## Decision drivers

* Each of the three environments needs its own value.
* Deploy previews already run against the production Supabase project, so a preview with the flag
  on is where the new view gets tried on real data.
* No new dependency, account or setting outside the repository.
* A flag must never decide who can write.

## Considered options

* A table in code with one boolean per environment, selected by `VITE_APP_ENV`
* One `VITE_FEATURE_<NAME>` variable per flag, set in `.env.local`, `netlify.toml` and the
  `deploy` job
* Overrides in the browser through `?ff=` and `localStorage`, on top of a build default
* A flag table in Supabase, read at startup
* A hosted flag service such as DevCycle, ConfigCat or GrowthBook
* A second production build under a fixed Netlify stage alias

## Decision outcome

Chosen option: a table in code, because it's the smallest thing that gives each environment its
own value.

* `src/lib/features.ts` holds one entry per flag, such as
  `verband: { development: true, stage: true, production: false }`. `isFeatureOn(name)` reads the
  column for the current `VITE_APP_ENV`.
* An unknown `VITE_APP_ENV` counts as `production`, so a mistyped build shows what visitors see.
* Changing a flag means changing a boolean in a pull request. Switching a feature on in production
  is that pull request, and rolling back is its revert.
* Removing a flag means deleting its entry. TypeScript then reports every remaining call. When to do
  that is tracked by hand in an issue.
* Per-flag variables would spread one setting over three places, two of them outside the code.
  Browser overrides and the stage alias solve testing on production data, which previews already
  cover. A Supabase table or a hosted service would let flags change without a deploy, and nothing
  here needs that.

### Consequences

* Good, because every flag value is in git, reviewed and tested like any other change.
* Good, because there's nothing to set up in Netlify, GitHub or `.env`.
* Bad, because a change in production needs a deploy, and nobody can try the production value of a
  flag in a preview.
* Flags are UI switches, not access control. Writes stay guarded by RLS
  ([ADR 0001](0001-rls-is-the-security-boundary.md)).

### Confirmation

`src/lib/features.test.ts` checks how `VITE_APP_ENV` maps to the three columns, including the
fallback for unknown values.

## More information

* Mechanism: [#62](https://github.com/hoferan/schwingkeller/issues/62). Switch and removal of
  `verband`: [#71](https://github.com/hoferan/schwingkeller/issues/71),
  [#72](https://github.com/hoferan/schwingkeller/issues/72). E2E coverage of both states:
  [#70](https://github.com/hoferan/schwingkeller/issues/70).
* Revisit when previews move to a staging database
  ([#90](https://github.com/hoferan/schwingkeller/issues/90)). Previews then no longer show
  production data, and trying a feature there before the switch needs another way.
