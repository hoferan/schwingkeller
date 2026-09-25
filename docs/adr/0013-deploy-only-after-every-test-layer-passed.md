---
status: proposed
date: 2026-09-25
decision-makers: André Hofer
---

# Deploy from GitHub Actions only after every test layer passed

## Context and problem statement

A merge to `main` changes production. Until September 2026, neither half of that waited for the
full test run. The `migrate` job pushed the migrations to the cloud database once `build-test`
passed, even when `e2e` failed on the same commit. Netlify built and published `main` on its own
trigger, so the frontend could go live before the migration it needed, or after a failed run. The
production secrets were repository secrets, which the workflow on any branch could read. Issue:
[#77](https://github.com/hoferan/schwingkeller/issues/77).

How should a merge reach production so that a failing test stops it?

## Decision drivers

* Nothing reaches production unless every test layer passed on the merged commit.
* The database is migrated before the frontend that depends on it.
* Test jobs can't reach production secrets.
* Deploy previews on pull requests keep working.

## Considered options

* Netlify publishes `main` itself, and the pull request check is the only gate
* Strict pull request checks, with Netlify still publishing `main` itself
* A deploy job after `migrate`, with Netlify's auto-publishing locked
* A deploy job after `migrate`, with Netlify's production builds skipped by `ignore` in
  `netlify.toml`

## Decision outcome

Chosen option: a deploy job after `migrate`, with Netlify's auto-publishing locked, because it's the
only option that orders the database before the frontend and relies only on documented Netlify
behaviour.

* On a push to `main`, `migrate` needs `all-green`, and `deploy` needs `migrate`.
* `deploy` builds the bundle with the production values and publishes it with
  `netlify deploy --prod --no-build`. `--prod` publishes while auto-publishing is locked.
* The production secrets live in a GitHub environment `production` that only `main` may use, and
  only `migrate` and `deploy` declare it. Public values like the Supabase URL are its variables.
* The `main` ruleset requires branches to be up to date, so a pull request is tested against the
  `main` it merges into.
* Netlify keeps building deploy previews and reads the Node version from `.nvmrc`, like CI.

### Consequences

* Good, because a failing test on `main` leaves the database and the live site as they were.
* Good, because a pull request can't read production secrets, even by editing the workflow.
* Good, because production is built on the Node version CI tests with.
* Bad, because the lock is a Netlify setting outside the repository. Unlocking it brings back
  Netlify publishing `main` without a trace in the code.
* Bad, because Netlify still builds `main` on every merge and discards the build.
* Bad, because a deploy that fails after `migrate` leaves the database ahead of the frontend. That's
  harmless while migrations stay additive.
* Deploy previews still use the production Supabase project.
  [#80](https://github.com/hoferan/schwingkeller/issues/80) tracks that decision.

### Confirmation

* In `.github/workflows/ci.yml`, `migrate` needs `all-green` and `deploy` needs `migrate`.
* Only `migrate` and `deploy` declare `environment: production`, and no other job references a
  secret besides `CODECOV_TOKEN`.
* Netlify's deploy list shows its own builds of `main` as not published.

## Pros and cons of the options

### Netlify publishes `main` itself

* Good, because it needs no deploy job.
* Bad, because the frontend goes live whatever the tests on `main` say, and before or without its
  migration.

### Strict pull request checks, Netlify publishing itself

* Good, because a pull request is tested against the current `main`.
* Bad, because Netlify still publishes without waiting for `migrate`.

### Skip production builds with `ignore` in `netlify.toml`

* Good, because the setting lives in the repository and no build is wasted.
* Bad, because Netlify's docs don't say whether `ignore` works per deploy context, and it can only
  be tried on `main`. If it doesn't work, Netlify publishes `main` alongside the deploy job.

## More information

* Setup: README, sections "GitHub setup" and "Netlify setup".
* Part of the milestone
  [Testing and deploy pipeline](https://github.com/hoferan/schwingkeller/milestone/3). It stays
  `proposed` until the milestone's last issue accepts it.
* Revisit if deploy previews move to GitHub Actions or get their own database (#80).
