# Schwingkeller Schweiz — Project Instructions

## Project Overview

Interactive map of Swiss **Schwingkeller** — training cellars and venues of Swiss wrestling (Schwingen). Single-page app backed by Supabase, available in German, French and Italian.

## Tech Stack

- **Build:** Vite + TypeScript
- **UI:** React 19
- **Map:** Leaflet + react-leaflet + leaflet.markercluster
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

## Dos

- Run `npm run test` and `npm run lint` before claiming any task complete — use `verification-before-completion`
- Use TDD: write the failing test first, then the implementation
- Keep i18n keys in sync across DE/FR/IT when touching UI text
- Use TanStack Query for all Supabase data fetching; never fetch directly in components
- Use RLS policies on the Supabase side; never rely on client-side auth guards alone
- Geocoding goes through Nominatim — respect rate limits (1 req/s, User-Agent header required)
- Use Conventional Commits format for PR titles (e.g. `feat: add Codecov integration`, `fix: supabase db push flag`) — matching the existing commit history
- Commit on a feature branch; push to `claude/new-session-eeiygh` for this session

## Don'ts

- Don't skip brainstorming before building features — invoke the skill even for small changes
- Don't bypass Supabase RLS by using the service-role key on the client
- Don't add new npm dependencies without discussing them first
- Don't hardcode Swiss-locale text; always use the i18n layer
- Don't commit `.env` files or Supabase secrets
- Don't use `any` in TypeScript — use proper types or `unknown`
- Don't open PRs to `main` directly; work lands on feature branches first

## Development Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # production build
npm run test         # run Vitest tests
npm run lint         # ESLint
npm run preview      # preview production build
```
