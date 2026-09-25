# Schwingkeller Schweiz — Project Instructions

## Project Overview

Interactive map of Swiss **Schwingkeller** — training cellars and venues of Swiss wrestling (Schwingen). Single-page app backed by Supabase, available in German, French and Italian.

## Tech Stack

- **Build:** Vite + TypeScript
- **UI:** React 19
- **Map:** Leaflet + leaflet.markercluster, driven imperatively (see ADR 0008)
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Data fetching:** TanStack Query
- **Testing:** Vitest + React Testing Library
- **Linting:** ESLint + Prettier
- **Error tracking:** Sentry

## Superpowers Skills

This project ships with [Superpowers](https://github.com/obra/superpowers) skills in `.claude/skills/`. These are loaded automatically at session start. Always use the `Skill` tool to invoke them — never read skill files manually.

Available skills:

| Skill | When to use |
|-------|-------------|
| `brainstorming` | Before implementing any feature or change |
| `writing-plans` | When given a spec or multi-step task |
| `executing-plans` | When running an existing plan |
| `subagent-driven-development` | For parallel implementation tasks |
| `test-driven-development` | Before writing any implementation code |
| `systematic-debugging` | On any bug or test failure |
| `verification-before-completion` | Before claiming work is done |
| `requesting-code-review` | After completing a feature |
| `receiving-code-review` | When acting on review feedback |
| `finishing-a-development-branch` | When ready to integrate work |
| `dispatching-parallel-agents` | For 2+ independent tasks |
| `using-git-worktrees` | For isolated feature work |
| `writing-skills` | When creating or editing skills |

## Decisions and working documents

Work on an issue goes through these steps:

1. Take the issue and run the `brainstorming` skill.
2. Write the spec, then the plan with `writing-plans`, under `docs/superpowers/`. Both skills say to
   commit them. This project overrides that: the folder is gitignored, and specs and plans stay
   local.
3. Implement the plan. If the work turns out larger than one pull request, split it into new issues
   or a milestone instead.
4. Write an ADR once the work settled something a future reader needs to know. Most issues need
   none.

When the work spans several issues, as in a milestone, the first issue that settles something
important may add the ADR with status `proposed`. Later issues in the same work extend it, and the
last one sets it to `accepted`. After that the record stays as it is: a later change gets a new ADR
that supersedes it.

Architecture decisions live in `docs/adr/` as [MADR](https://adr.github.io/madr/) records. Check the
index in `docs/adr/README.md` before changing something structural. If a change alters a recorded
decision, write a new ADR and mark the old one superseded (ADR 0000).

An ADR records one decision once it has been made: the context, the options that were turned down,
and why. It isn't a draft committed ahead of the work, and it doesn't replace the spec. File lists,
job names and step-by-step instructions stay in the spec and plan. A record should be about the size
of the existing ones. Before setting a record to `accepted`, check it against the definition of done
in `docs/adr/README.md`.

## Dos

- Run `npm run test` and `npm run lint` before claiming any task complete — use `verification-before-completion`
- Use TDD: write the failing test first, then the implementation
- Keep i18n keys in sync across DE/FR/IT when touching UI text
- Use TanStack Query for all Supabase data fetching; never fetch directly in components
- Use RLS policies on the Supabase side; never rely on client-side auth guards alone
- Geocoding goes through Nominatim — respect rate limits (1 req/s, User-Agent header required)
- Use Conventional Commits format for PR titles (e.g. `feat: add Codecov integration`, `fix: supabase db push flag`) — matching the existing commit history
- Commit on a feature branch named `claude/<topic>`; never commit directly to `main`

## Don'ts

- Don't skip brainstorming before building features — invoke the skill even for small changes
- Don't bypass Supabase RLS by using the service-role key on the client
- Don't add new npm dependencies without discussing them first
- Don't hardcode Swiss-locale text; always use the i18n layer
- Don't commit `.env` files or Supabase secrets
- Don't use `any` in TypeScript — use proper types or `unknown`
- Don't open PRs to `main` directly; work lands on feature branches first

## CI

`.github/workflows/ci.yml` has five jobs. `build-test` runs lint, typecheck,
coverage and a compile-only build. `e2e` runs the Playwright suite in `e2e/`
against the Compose backend, with the production bundle built and served by
Vite on the runner rather than in a container. Locally the suite runs against
the Compose dev server, and it refuses to start if its base URL or Supabase
URL isn't local. `all-green` depends on both and is the single required status
check. On pushes to `main`, `migrate` pushes the Supabase migrations once
`all-green` passed, and `deploy` then builds the production bundle and
publishes it to Netlify.

- A new job protects `main` only once it is listed in `all-green`'s `needs`.
- `all-green` reads `needs['build-test']`, not `needs.build-test`: a hyphen in a
  job id parses as subtraction in a GitHub expression and yields an empty string.
- The workflow runs with `contents: read`. A job that needs more asks for it.
- Production secrets live in the GitHub environment `production`, which only
  `main` may use, and only `migrate` and `deploy` declare it. Test jobs never get
  a production secret. `CODECOV_TOKEN` is the only repository secret. Public
  production values (Supabase URL and publishable key, Sentry DSN and slugs,
  Netlify site ID) are environment variables, not secrets.
- `migrate` pushes with `supabase db push --db-url` and the session pooler
  string in `SUPABASE_DB_URL`. CI holds no Supabase account token.
- Netlify's auto-publishing is locked, so `deploy` is the only way onto the live
  site. Netlify still builds deploy previews, with the variables set in its UI.
- Node comes from `.nvmrc`, for CI and for Netlify. Change the version there, not
  in the workflow.
- `main` takes squash merges only.
- Coverage does not block: Codecov comments on pull requests, but `codecov/patch`
  is not a required check.

## Development Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # production build
npm run test         # run Vitest tests
npm run lint         # ESLint
npm run preview      # preview production build
```
