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

   This writes a timestamped SQL file to `supabase/migrations/`.

2. Write your SQL (table changes, RLS policies, storage policies, etc.) into the new file.

3. Apply it locally by resetting the database, which re-runs all migrations and the seed:

   ```bash
   supabase db reset
   ```

4. Verify the change in Studio (`http://localhost:54323`) and add/update tests as needed.

To deploy migrations to the cloud project, link it and push (see the README):

```bash
supabase db push
```

## Secrets — never commit them

**No secrets are ever committed to this repository.** Only `.env.example` (with placeholder values)
is tracked; `.env.local` and any real keys are gitignored.

- Put real values only in your local `.env.local` (gitignored) for development.
- Production frontend env vars go in **Netlify**; CI-only tokens go in **GitHub Actions secrets**.
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
