---
status: proposed
date: 2026-09-25
decision-makers: André Hofer
---

# Feature flags from one registry, overridable by URL

## Context and problem statement

The site is live. The Verband view ([ADR 0015](0015-organise-venues-by-schwingerverband.md)) has to
ship dark, be reviewed by people from the Verbände on production data, and only then be switched
on for everyone. The app had no flag mechanism; the only build switch was `VITE_APP_ENV`. The
mechanism should be general, so the next flag (`editors`, for the user management UI) takes one
entry.

## Decision drivers

* Reviewers must see the new view on the production site, without a separate deploy.
* Switching on and rolling back should need no database change.
* No new service or dependency.
* A flag must never decide who can write.

## Considered options

* Build env variables only
* A runtime flag table in Supabase
* A third-party flag service
* One registry in code, resolved from URL, `localStorage`, build env and code default

## Decision outcome

Chosen option: one registry in code.

* Each flag is one entry with its env variable `VITE_FEATURE_<NAME>`, a default and a description.
* Resolution, highest first: URL (`?ff=name`, `?ff=-name`, `?ff=reset`), then a remembered
  `localStorage` override, then the build env, then the code default.
* Flags are resolved once at startup and stay fixed for the page's life. Components read them
  through `useFeature()` only. After resolving, `ff` is removed from the address bar, so a shared
  link doesn't pass on a reviewer's override.
* A small pill shows while any flag differs from its build value, with a reset.
* Flags are UI switches, not access control. Anyone can type `?ff=verband`, and RLS still guards
  every write ([ADR 0001](0001-rls-is-the-security-boundary.md)).
* Build env alone would mean a reviewer can only see the view on a deploy preview, not on
  production. A Supabase table would add a request before the first render, plus policies and
  grants for something that isn't secret. A flag service would add a dependency and an account for
  two flags.

### Consequences

* Good, because switching on or rolling back is one Netlify variable and a redeploy.
* Good, because deploy previews can default a flag on while production leaves it off.
* Bad, because flagged code ships to every visitor, and both paths have to be tested until the
  flag is removed.
* A flag is meant to be temporary. Once a view is switched on and has settled, its flag and the old
  path are deleted.

### Confirmation

Unit tests cover the priority order, the `-name` and `reset` forms, a throwing `localStorage`, and
that every registry key's env variable is named after it. The e2e suite runs with the `verband`
flag both on and off until it's removed.

## More information

* Mechanism: [#62](https://github.com/hoferan/schwingkeller/issues/62), e2e with the flag on:
  [#70](https://github.com/hoferan/schwingkeller/issues/70)
* Switch and removal of the `verband` flag: [#71](https://github.com/hoferan/schwingkeller/issues/71),
  [#72](https://github.com/hoferan/schwingkeller/issues/72). The `editors` flag:
  [#73](https://github.com/hoferan/schwingkeller/issues/73)
