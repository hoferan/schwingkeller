# Contributing to Schwingkeller Schweiz

Thanks for contributing! This guide covers the project layout, the development workflow, code style,
commit conventions, how to add a database migration, and the rules around secrets. For local setup
(Supabase, env vars, running the app), see the [README](README.md).

## Project layout

The app is a static Vite + React + TypeScript SPA backed by Supabase. Source code lives under
`src/`, grouped by feature:

```text
src/
├── lib/           # supabase.ts (client), sentry.ts (error tracking)
├── data/          # cantons.ts, plzRanges.ts (static Swiss data)
├── i18n/          # translations.ts, useTranslation.ts (DE / FR / IT)
├── features/
│   ├── auth/      # AuthProvider, useAuth, LoginModal
│   ├── venues/    # types, api, useVenues, geocoding, importExport, grouping
│   ├── map/       # MapView, markers
│   ├── sidebar/   # Sidebar
│   ├── venue-detail/  # DetailModal
│   └── venue-edit/    # EditForm
├── components/    # shared UI: Topbar, Modal
├── App.tsx
├── main.tsx
└── index.css

supabase/
├── migrations/    # SQL migrations (schema, RLS, storage)
└── seed.sql       # local seed data
```

Tests live next to the code they cover as `*.test.ts` / `*.test.tsx` files.

## Development workflow (TDD)

We follow a test-driven workflow:

1. Write or update a test that describes the desired behavior.
2. Run the suite and watch it fail for the right reason:

   ```bash
   npm test            # run once
   npm run test:watch  # re-run on change while developing
   ```

3. Implement the change until the test passes.
4. Keep the whole suite green before opening a pull request, and check coverage:

   ```bash
   npm test
   npm run coverage
   ```

Tests use [Vitest](https://vitest.dev/) and
[React Testing Library](https://testing-library.com/). Prefer testing observable behavior over
implementation details.

## Browser tests

The end-to-end suite is [Gherkin](https://cucumber.io/docs/gherkin/) feature files, written in
English, one file per capability. The admin capabilities live under `e2e/features/admin` and run
with the saved admin session; the visitor capabilities live under `e2e/features/visitor` and run
anonymously, with no session at all.

Step definitions live in `e2e/steps`, take `Given`, `When` and `Then` from `e2e/fixtures.ts`, and
hold the selectors and the `STR` texts a scenario needs. A feature file describes behavior, never a
click.

```bash
docker compose up -d      # or let Playwright start it
npx playwright install chromium
npm run test:e2e
```

Locally the suite runs against the Compose stack started above. `npm run test:e2e` first runs
`bddgen`, which compiles the feature files into Playwright tests and fails the run if a step has no
definition, then runs Playwright.

To add a scenario, write it in the feature file for its capability, run `npx bddgen`, and implement
whatever steps it reports missing in `e2e/steps`. Keep the scenario itself at the level of user
behavior; edge cases and error paths belong in a unit or an integration test instead.

### Scenarios that write

The scenarios share one database and run in parallel, so a scenario that creates or edits data
takes a `venuePrefix` fixture, names everything with it, and lets the fixture delete those rows
afterwards, including when the scenario fails. Steps use `WRITE_CANTON` (`e2e/db.ts`) rather than a
canton the seed fills, so a venue in flight cannot disturb a scenario that counts Fribourg's
labels. Never assert on a total: another worker may be mid-write. Search for your own record
instead.

Cleanup reaches Postgres through PostgREST as the signed-in admin, not with the service-role key,
so a policy that stopped permitting a write would fail the scenario rather than be bypassed. A run
that dies before cleaning up leaves rows behind; the next run's global setup sweeps anything named
`[e2e]…`.

**After changing app code, restart the web container before running these:**

```bash
docker compose restart web
```

The container bind-mounts the repository, and the file watcher inside it does not see edits made on
the host, so Vite keeps serving the code it had at startup. Skipping the restart makes the suite
pass or fail against stale code, which is worse than a plain failure.

## Code style

Before committing, make sure the code lints, type-checks and is formatted:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript (tsc -b --noEmit)
npx prettier --check .   # verify formatting (use --write to fix)
```

- **ESLint** enforces the project's lint rules (config in `eslint.config.js`); fix all errors before
  pushing.
- **Prettier** owns formatting. Run `npx prettier --write .` to auto-format, and do not hand-fight
  its output.
- **TypeScript** must compile cleanly with no errors.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/): a `type: short description`
subject line, written in the imperative mood.

Common types:

- `feat:` — a new feature
- `fix:` — a bug fix
- `docs:` — documentation only
- `test:` — adding or updating tests
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `chore:` — tooling, dependencies, build, config

Examples:

```text
feat: add canton mask overlay to the map
fix: strip BOM in parseCSV so CSV round-trips cleanly
docs: add README and CONTRIBUTING with full setup guide
```

Keep commits focused; group related changes and write a body when the "why" isn't obvious from the
subject.

## Adding a database migration

Schema changes are tracked as SQL migrations under `supabase/migrations/`. Never edit an
already-applied migration — create a new one:

1. Create a new migration file:

   ```bash
   supabase migration new <name>
   ```

   This writes a timestamped SQL file to `supabase/migrations/`. The Supabase CLI is fine for
   this step alone.

2. Write your SQL (table changes, RLS policies, storage policies, etc.) into the new file.

3. Apply it locally with the Compose stack, not the Supabase CLI stack. Restart the db-init
   service so it re-runs and picks up the new migration file:

   ```bash
   docker compose up -d db-init
   ```

   For a fresh database, tear the stack down and bring it back up instead, which also re-runs
   the seed:

   ```bash
   docker compose down -v && docker compose up -d
   ```

   The Supabase CLI stack (`supabase db reset` and similar commands) has no grant parity step
   and no local admin user, so it cannot stand in for the Compose stack here.

4. Declare every grant the change needs (`grant select on ... to anon`, and so on). The local
   stack, like production, grants no read, write or execute rights by default, so a missing grant
   fails locally too.

5. Add or update integration tests in `integration/` for the tables, policies, grants and
   functions you touched, and run them with `npm run test:integration`. This also needs the
   Compose stack; the Supabase CLI stack fails the same way, with no grant parity and no local
   admin.

Migrations reach the cloud project through the `migrate` job in CI, once a pull request is merged
and every check passed. The README's Supabase setup covers the first push by hand.

## Secrets — never commit them

**No secrets are ever committed to this repository.** Only `.env.example` (with placeholder values)
is tracked; `.env.local` and any real keys are gitignored.

- Put real values only in your local `.env.local` (gitignored) for development.
- Production tokens and the database connection string go in the GitHub environment
  `production` as secrets, its public values as variables. Preview values go in **Netlify**.
  `CODECOV_TOKEN` is the only repository secret.
- The Supabase **secret** key (`sb_secret_…`) must never be committed, logged, or exposed to the
  browser. Only the **publishable** key (`sb_publishable_…`) and the Sentry **DSN** are
  browser-safe.
- If you add a new environment variable, document it in `.env.example` with a placeholder (never a
  real value) and in the README's environment-variables table.

## Pull requests

Before opening a PR, confirm locally:

```bash
npm run lint
npm run typecheck
npm test
```

CI runs the same checks and uploads coverage to Codecov. Netlify deploys a preview for every PR so
changes can be reviewed live.
