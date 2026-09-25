# Schwingkeller Schweiz

[![CI](https://github.com/hoferan/schwingkeller/actions/workflows/ci.yml/badge.svg)](https://github.com/hoferan/schwingkeller/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/hoferan/schwingkeller/branch/main/graph/badge.svg)](https://codecov.io/gh/hoferan/schwingkeller)
[![Netlify Status](https://api.netlify.com/api/v1/badges/161aa043-440b-4e41-b715-f0cfe278171d/deploy-status)](https://app.netlify.com/projects/schwingkeller/deploys)

An interactive map of Swiss **Schwingkeller** — the training cellars and venues of Swiss wrestling
(*Schwingen*). Browse venues clustered on a Leaflet map, search and sort them in a sidebar grouped by
canton, read venue details, and — as an authenticated admin — add, edit and delete venues with photo
galleries, address geocoding and pick-on-map coordinate entry. The app is a static single-page application backed by
Supabase, available in German, French and Italian.

![Screenshot of the Schwingkeller Schweiz app](docs/screenshot.png)

## Features

- **Interactive clustered map** — Leaflet map with marker clustering that expands as you zoom in.
- **Canton grouping** — the sidebar lists all 26 cantons with their venues. The map itself stays
  plain, without canton borders ([ADR 0005](docs/adr/0005-plain-map-without-mask-or-borders.md)).
- **Trilingual UI (DE / FR / IT)** — full i18n with a language switcher.
- **Search, filter and sort** — search by name, town or canton, show only indoor or outdoor venues,
  and sort by canton, by name or by distance from you. Filters narrow the list; the map always shows
  every venue.
- **Shareable links** — `?venue=` opens a venue and `?ctn=` zooms to a canton.
- **Venue detail** — a detail view with a photo gallery, address, description and a directions link.
- **Posters** — admins can export a canton map with its venues and a QR code as an image.
- **Admin CRUD** — authenticated users can add, edit and delete venues, including:
  - **Photo galleries** of up to 6 photos per venue, compressed in the browser and stored in the
    `venue-photos` Supabase Storage bucket.
  - **Address geocoding** via Nominatim (OpenStreetMap).
  - **Pick-on-map** coordinate entry for venues without a precise address.
- **CSV / JSON import & export** — bulk-manage the venue dataset.
- **Sentry error tracking** — runtime errors are reported to Sentry in production.

## Tech stack

| Area              | Technology                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| Build tool        | [Vite](https://vitejs.dev/)                                             |
| UI framework      | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Map               | [Leaflet](https://leafletjs.com/), [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) |
| Backend           | [Supabase](https://supabase.com/) (Postgres + Auth + Storage, with RLS) |
| Data fetching     | [@tanstack/react-query](https://tanstack.com/query)                     |
| Error tracking    | [@sentry/react](https://sentry.io/)                                     |
| Geocoding         | [Nominatim](https://nominatim.org/) (OpenStreetMap)                     |
| Testing           | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) |
| Linting / format  | [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)        |
| Local backend     | Self-hosted Supabase in Docker Compose ([Supabase CLI](https://supabase.com/docs/guides/cli) optional) |
| Containerization  | [Docker Compose](https://docs.docker.com/compose/)                      |
| Hosting           | [Netlify](https://www.netlify.com/)                                     |
| CI / coverage     | [GitHub Actions](https://docs.github.com/actions) + [Codecov](https://codecov.io/) |

## Architecture

A static Vite + React SPA. All persistent state lives in Supabase: a Postgres `venues` table
protected by Row Level Security (public read, authenticated write) and a `venue-photos` Storage
bucket for images. The browser talks to Supabase directly using the publishable key; there is no
custom backend server. React Query manages server state and caching, an auth provider wraps the
Supabase session, and feature folders under `src/features/` group UI and logic by domain.

The reasons behind the less obvious choices (no router, imperative Leaflet, inline styles, the poster
pipeline and more) are recorded in [`docs/adr/`](docs/adr/README.md).

```text
src/
├── lib/
│   ├── supabase.ts            # Supabase client (URL + publishable key)
│   ├── sentry.ts              # Sentry initialization
│   ├── permalink.ts           # ?venue= and ?ctn= links
│   └── share.ts               # Web Share API with clipboard fallback
├── data/
│   ├── cantons.ts             # Swiss canton metadata
│   ├── cantonBounds.ts        # precomputed canton bounding boxes
│   └── plzRanges.ts           # postal-code → canton ranges
├── i18n/
│   ├── translations.ts        # DE / FR / IT dictionaries
│   └── useTranslation.ts      # translation hook
├── features/
│   ├── auth/                  # AuthProvider, useAuth, LoginModal
│   ├── venues/                # types, api, useVenues, geocoding, importExport, grouping, posters
│   ├── map/                   # MapView, markers, MarkerPopup, tile layers
│   ├── geo/                   # useGeolocation
│   ├── sidebar/               # Sidebar
│   ├── venue-detail/          # DetailModal, PhotoGallery
│   └── venue-edit/            # EditForm, PhotoGalleryEditor
├── components/
│   ├── Topbar.tsx
│   └── Modal.tsx
├── App.tsx
├── main.tsx
├── theme.ts                   # design tokens
└── index.css
```

Supabase schema and seed data live under `supabase/`:

- `supabase/migrations/` — numbered SQL migrations: the `venues` table and its RLS policies, the
  `venue-photos` Storage bucket and its policies, the `venue_photos` gallery table, and the
  `replace_venues` import function.
- `supabase/seed.sql` — seeds 29 example venues for local development.

## Prerequisites

- **[Docker](https://docs.docker.com/get-docker/)** (with Compose v2) — the only requirement for the
  recommended one-command local setup.
- **[Node.js 24](https://nodejs.org/)** (the version in `.nvmrc`) — optional, for running the app and tests on the host
  (non-Docker / Supabase CLI path).
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** — optional, only for the alternative CLI
  path below.
- Free accounts for production: **[Supabase](https://supabase.com/)**,
  **[Netlify](https://www.netlify.com/)**, **[Codecov](https://codecov.io/)** and
  **[Sentry](https://sentry.io/)**.

## Environment variables

| Variable | Used by | Browser-exposed? | Set in | Where to get it |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | frontend | yes | environment `production`; Netlify for previews | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend | yes (safe) | environment `production`; Netlify for previews | Supabase → API keys → publishable (`sb_publishable_…`) |
| `VITE_SENTRY_DSN` | frontend | yes (safe) | environment `production`; Netlify for previews | Sentry → Project → Client Keys (DSN) |
| `SUPABASE_ACCESS_TOKEN` | `migrate` job | no | environment `production` | Supabase → Account → Access Tokens |
| `SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD` | `migrate` job | no | environment `production` | Supabase project settings |
| `SENTRY_AUTH_TOKEN` | `deploy` job | no | environment `production` | Sentry → Account → Auth Tokens |
| `SENTRY_ORG` / `SENTRY_PROJECT` | `deploy` job | no | environment `production` | Sentry org/project slugs |
| `NETLIFY_AUTH_TOKEN` | `deploy` job | no | environment `production` | Netlify → User settings → Applications → Personal access tokens |
| `NETLIFY_SITE_ID` | `deploy` job | no (not secret) | environment `production`, as a variable | Netlify → Site configuration → Site ID |
| `CODECOV_TOKEN` | `build-test` job | no | repository secret | codecov.io → repo settings |
| secret key (`sb_secret_…`) | server/tooling only | **NO, never** | nowhere in CI | Supabase → API keys → secret |

All `VITE_`-prefixed variables are bundled into the static frontend and are visible in the browser,
so only browser-safe values go there. "Environment `production`" is the GitHub Actions environment
of that name (see [GitHub setup](#github-setup)). Only `main` can use it, and only the `migrate` and
`deploy` jobs read it.

## Local development

The recommended way to run everything locally is a single command. From the repo root:

```bash
docker compose up
```

This brings up the **entire stack** with no `.env` setup and no Supabase CLI:

- a full self-hosted Supabase backend (Postgres, Auth/GoTrue, PostgREST, Storage + imgproxy,
  Realtime, postgres-meta, the Kong API gateway and Studio);
- a one-shot init step that applies every migration in `supabase/migrations/` that hasn't run yet
  (tracked in `public.schema_migrations`) and, if the `venues` table is empty, runs
  `supabase/seed.sql` to add 29 example venues;
- a one-shot init step that creates a local admin user;
- the Vite app (`web` service).

Once everything is up:

| Service | URL |
|---|---|
| App | <http://localhost:5173> |
| Supabase API gateway (Kong) | <http://localhost:54321> |
| Supabase Studio | <http://localhost:54323> |
| Postgres | `localhost:54322` |

Open <http://localhost:5173> and sign in with the pre-created local admin:

- **Email:** `admin@schwingkeller.local`
- **Password:** `schwingadmin`

Use **Studio** at <http://localhost:54323> to inspect the database, auth users and storage.

> **First run is slow** — it pulls the Supabase images and builds the app image. Subsequent runs
> reuse the cached images and volumes, so they start quickly.

The init steps are **idempotent**: re-running `docker compose up` will not re-seed the database or
fail on the existing admin user. To start completely fresh — wiping the database volume so the
schema, seed and admin are re-created — reset the stack:

```bash
docker compose down -v   # remove containers and named volumes
docker compose up        # rebuild a clean, seeded stack
```

The local stack uses Supabase's well-known **public demo keys**, baked into `docker/supabase.env`
and `docker-compose.yml` and clearly marked as local-dev-only. You therefore do **not** need to
create `.env.local` or copy any keys for local development — `docker compose up` is self-contained.

### Running the tests

The test suite runs on the **host** with Node (no Docker needed):

```bash
npm install       # once
npm test          # run the test suite once
npm run coverage  # run with a coverage report
```

Other useful scripts: `npm run lint` (ESLint), `npm run typecheck` (TypeScript), `npm run build`
(production build), `npm run preview` (preview the production build).

### Alternative: Supabase CLI

Prefer to run the app on your host (outside Docker) and/or use the [Supabase
CLI](https://supabase.com/docs/guides/cli) for the backend? This is the previous manual flow:

1. **Create your local env file** and start the CLI stack:

   ```bash
   cp .env.example .env.local   # gitignored, never committed
   supabase start               # boots Postgres, Auth, Storage and Studio; prints API URL + keys
   ```

   Copy the printed API URL and publishable (anon) key into `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<key printed by supabase start>
   ```

2. **Apply migrations and seed data:**

   ```bash
   supabase db reset
   ```

   This re-applies every migration in `supabase/migrations/` and runs `supabase/seed.sql`
   (29 example venues).

3. **Create an admin user** (the app only allows authenticated users to write). The simplest way is
   via Studio at <http://localhost:54323> → **Authentication** → **Add user**, entering an email and
   password and auto-confirming so it can sign in immediately. (The local service-role key printed by
   `supabase start` is only valid against your local stack — it is not a production secret.)

4. **Run the app on your host:**

   ```bash
   npm install && npm run dev
   ```

   The dev server is served on <http://localhost:5173>.

## Supabase (cloud) setup

1. **Create a project** at [supabase.com](https://supabase.com/).
2. **Copy the API keys.** Go to **Project Settings → API keys**:
   - Copy the **publishable** key (`sb_publishable_…`) into `VITE_SUPABASE_PUBLISHABLE_KEY` — this
     is browser-safe.
   - Keep the **secret** key (`sb_secret_…`) private. It is only for server-side tooling and must
     **never** be committed or shipped to the browser.
   - Copy the project URL into `VITE_SUPABASE_URL`.
3. **Disable public sign-ups.** This app is invite-only for admins. In the dashboard go to
   **Authentication → Providers → Email** and turn off sign-ups, or under **Authentication → Sign
   In / Providers** (Auth settings) set **"Allow new users to sign up"** to **off**.
4. **Invite admins** under **Authentication → Users → Invite**.
5. **Link the project and push migrations:**

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

   `<ref>` is your project reference (visible in the project URL / settings).
   After this first push, the `migrate` job in CI pushes new migrations whenever a pull request is
   merged and every check passed.
6. **Confirm the `venue-photos` bucket exists** under **Storage** — the migration creates it, so it
   should appear after the push.

## GitHub setup

1. **Create the environment `production`** under **Settings → Environments**. Under **Deployment
   branches and tags**, choose **Selected branches and tags** and add `main`. No reviewers: a merge
   to `main` deploys without a further approval.
2. **Add the production secrets** to that environment: `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
   `SENTRY_PROJECT` and `NETLIFY_AUTH_TOKEN`. Add `NETLIFY_SITE_ID` as an environment
   **variable**.
3. **Add `CODECOV_TOKEN`** as a repository secret (see [Codecov setup](#codecov-setup)).
4. **Protect `main`** with a ruleset that requires the `all-green` check, requires branches to be up
   to date before merging, and allows squash merges only.

## Netlify setup

1. **Connect the GitHub repo** in Netlify. Netlify builds a deploy preview for every pull request.
2. Set the **build command** to `npm run build` and the **publish directory** to `dist` (these are
   already declared in `netlify.toml`).
3. Add the frontend **environment variables** in **Site settings → Environment variables**:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SENTRY_DSN`. They're used by the
   previews. Production reads its values from the GitHub environment `production`.
4. **Stop auto publishing** under **Deploys**. Netlify keeps building `main` but no longer publishes
   it. The `deploy` job in CI publishes production with the Netlify CLI, after the tests and the
   migration passed.
5. **Create a personal access token** under **User settings → Applications** and add it to the
   GitHub environment `production` as `NETLIFY_AUTH_TOKEN`, with the site ID as `NETLIFY_SITE_ID`.

## Codecov setup

1. Add the repository on [codecov.io](https://codecov.io/).
2. For **public** repositories a token is optional. To be safe (and required for private repos), add
   `CODECOV_TOKEN` as a **GitHub Actions secret** so the CI upload step is authenticated.

## Sentry setup

1. Create a **React** project in [Sentry](https://sentry.io/).
2. Copy the project's **DSN** into `VITE_SENTRY_DSN` (browser-safe).
3. For **source-map upload** when production is built, create an **auth token** and add
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` (your org and project slugs) as secrets
   of the GitHub environment `production`.

## Security note

- **Row Level Security (RLS) is the security boundary.** The `venues` table is public-read and
  authenticated-write; the `venue-photos` bucket policies enforce the same. The frontend can ship
  the publishable key precisely because RLS — not the key — gates what each request may do.
- **Browser-safe values:** the Supabase **publishable** key and the Sentry **DSN** are designed to
  be public and may be embedded in the static bundle.
- **Secrets stay in secret stores only:** production values and CI tokens live in the GitHub
  environment `production`, which only `main` can use and only the `migrate` and `deploy` jobs
  read. Preview values live in Netlify, and `CODECOV_TOKEN` is the one repository secret. The
  Supabase **secret** key (`sb_secret_…`) is never committed or shipped.
- **Nothing sensitive is committed.** Only `.env.example` (with placeholders) is tracked;
  `.env.local` and every real secret are gitignored. The keys committed in `docker/supabase.env`
  and `docker-compose.yml` are Supabase's well-known public demo values for local development only
  and are never used in production.

## License

See [LICENSE](LICENSE).
