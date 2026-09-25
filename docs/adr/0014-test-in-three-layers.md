---
status: proposed
date: 2026-09-25
decision-makers: André Hofer
---

# Test in three layers: unit, integration against the local stack, and Gherkin end to end

## Context and problem statement

A merge to `main` goes to production (ADR 0013), so the pull request has to catch whatever would
break it. In September 2026 the tests had two layers. Vitest covered logic and components in jsdom,
with Supabase mocked, and ten Playwright specs clicked through the dev server. Nothing tested the
database: RLS policies, grants and database functions were applied in CI but never exercised,
although a missing grant had already reached production once (ADR 0001). The E2E specs read as click
scripts and never ran against the minified bundle that users get. The next milestone rewrites RLS
for editors scoped to a Verband.

Which layers should the tests have, and what belongs in each?

## Decision drivers

* Most of the risk sits in the database, because migrations and RLS go live on merge.
* Tests never touch production data.
* End-to-end scenarios should read as behaviour, not as click scripts.
* Keep the tools the project already has where they do the job.

## Considered options

For the middle layer:

* Integration tests with Vitest and supabase-js against the local Compose stack
* Scenario tests that render the whole app in jsdom against a faked backend

For end-to-end tests:

* Gherkin feature files run by playwright-bdd
* Gherkin feature files run by `@cucumber/cucumber` with the Playwright library
* Plain Playwright specs

## Decision outcome

Chosen options: integration tests against the local stack, and Gherkin feature files run by
playwright-bdd.

* Unit tests (Vitest in jsdom) cover logic, hooks and components, with Supabase mocked. Whatever
  can be tested without a browser and a database is tested here.
* Integration tests (Vitest in Node) reach the Compose stack through supabase-js as real users,
  never with the service-role key, and cover RLS, grants, database functions and migrations.
* End-to-end tests describe user journeys in Gherkin feature files, in English, one per capability.
  playwright-bdd compiles them into Playwright tests, so the runner, fixtures, projects and reports
  stay. Edge cases go down a layer.
* In CI the E2E suite runs against the production bundle, built by `vite build` against the local
  stack and served by `vite preview`. Locally it runs against the Compose dev server.
* The test setups refuse any target URL whose host isn't `localhost` or `127.0.0.1`.

### Consequences

* Good, because RLS and grants get tests before the Verband-scoped permissions change them.
* Good, because a bug that only appears after bundling fails the pull request.
* Good, because the scenarios can be read without the code.
* Bad, because feature files put step definitions between the scenario and the code.
* Bad, because the E2E bundle is built with local values, so it isn't byte for byte the bundle that
  ships. The two builds share the commit, the lockfile, the Node version and the command.

### Confirmation

* `playwright.config.ts` builds and previews the bundle when `CI` is set, and checks its target
  URLs with `e2e/local-only.ts` before anything starts.
* Review checks that a migration comes with integration tests and a new user journey with a feature
  file.

## Pros and cons of the options

### Scenario tests in jsdom

* Good, because whole flows run without a browser.
* Bad, because a faked backend never runs a real policy.

### `@cucumber/cucumber`

* Good, because it is the reference Gherkin runner.
* Bad, because it drives the Playwright library instead of its test runner, so projects, fixtures,
  traces, retries and the HTML report would have to be rebuilt.

### Plain Playwright specs

* Good, because they need no new dependency.
* Bad, because nothing describes the behaviour apart from the code.

## More information

* E2E against the production bundle came with #60. The integration layer (#78) and the feature
  files (#79) extend this record, and the last issue of the milestone accepts it.
* German feature files were turned down while developers, not the Verbände, are the readers.
