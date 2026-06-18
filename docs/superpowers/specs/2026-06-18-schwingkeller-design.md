# Schwingkeller Schweiz — Design Spec

**Date:** 2026-06-18
**Status:** Approved (pending spec review)

## Summary

Turn the existing `Schwingkeller Schweiz` prototype (`.tmp/schwingkeller-design/`) into a
real, deployable web application. The app is a public, read-only map of Swiss wrestling
(*Schwingen*) venues with an admin mode for managing entries. It is a **strict 1:1 feature
port** of the prototype, with `localStorage` replaced by a Supabase backend.

Deployment/infra stack is fixed: **Netlify** (hosting), **Supabase** (DB/Auth/Storage),
**Codecov** (coverage), **Sentry** (error tracking). Frontend stack is **Vite + React 18 +
TypeScript**.

## Goals

- Public visitors see an interactive map of venues, grouped by canton, searchable, in DE/FR/IT.
- Invited admins can sign in and add/edit/delete venues, upload photos, geocode addresses,
  pick locations on the map, and import/export JSON/CSV.
- Fully deployable from a **public GitHub repo** with **zero credentials committed**.
- Reproducible local development via Docker.
- Setup is documented well enough that the owner can stand up all infrastructure from scratch.

## Non-Goals (v1)

- No new features beyond the prototype (strict port).
- No public self-registration / wiki-style editing.
- No server-side rendering; this is a static SPA.
- No moderation/approval workflow.

## Feature Scope (ported 1:1 from prototype)

- Leaflet map of Switzerland: canton borders (`cantons.geojson`), masked background outside CH,
  marker clustering, map/satellite layer toggle, "fit all" control.
- Sidebar: search box; venues grouped by canton with cantonal coats of arms (Wappen from
  Wikimedia), per-canton count badges, expand/collapse, total count.
- Venue detail modal: photo (or placeholder), name, address, indoor/outdoor tags, contact
  (person/phone/website), "Navigate" deep link to Google Maps.
- Admin mode: add/edit/delete venues; photo upload; address geocoding (Nominatim forward +
  reverse); PLZ→canton auto-detection; pick-on-map location; save & close / save & new.
- Import/export: JSON and CSV.
- i18n: German / French / Italian, language persisted (localStorage for UI preference only).
- Responsive layouts: desktop / tablet drawer / mobile bottom-sheet (as in prototype).

## Tech Stack

- **Build/UI:** Vite + React 18 + TypeScript; npm; ESLint + Prettier.
- **Map:** Leaflet + react-leaflet + leaflet.markercluster (same libraries as prototype).
- **Data layer:** Supabase JS client (`@supabase/supabase-js`) wrapped in typed hooks, with
  **TanStack Query** for caching and loading/error states.
- **i18n:** the prototype's DE/FR/IT dictionary as a small typed module + `useTranslation` hook.
- **Tests:** Vitest + React Testing Library; coverage reported to Codecov.
- **Errors:** `@sentry/react`.

## Module Layout

Each folder has one clear responsibility and is independently testable.

```
src/
  lib/         supabase.ts (client), sentry.ts (init)
  data/        cantons.ts, plz-ranges.ts          (pure constants from prototype)
  i18n/        translations.ts, useTranslation.ts
  features/
    auth/      AuthProvider, LoginModal, useAuth
    map/       MapView, markers, clustering, layer toggle, fit-all
    sidebar/   search + canton groups
    venues/    api (Supabase queries), useVenues, types,
               geocoding (Nominatim), import-export (JSON/CSV), plzToCanton
    venue-detail/  detail modal
    venue-edit/    add/edit form, pick-on-map
  components/  shared UI primitives
```

Pure logic (`plzToCanton`, CSV parse/serialize, canton lookup, geocoding response mapping,
i18n resolution) lives in plain functions, decoupled from React, so it is trivially unit-tested.

## Data Model (Supabase Postgres)

Table `venues`:

| column      | type                    | notes                                  |
|-------------|-------------------------|----------------------------------------|
| id          | uuid pk default gen     | `gen_random_uuid()`                    |
| name        | text not null           |                                        |
| canton      | text not null           | 2-letter code (e.g. `BE`)              |
| address     | text                    |                                        |
| lat         | double precision        |                                        |
| lng         | double precision        |                                        |
| indoor      | boolean not null def f  |                                        |
| outdoor     | boolean not null def f  |                                        |
| person      | text                    |                                        |
| phone       | text                    |                                        |
| website     | text                    |                                        |
| photo_url   | text                    | public URL into Storage; nullable      |
| created_at  | timestamptz default now |                                        |
| updated_at  | timestamptz default now | maintained via trigger                 |

- **Storage:** bucket `venue-photos` — public read, authenticated write. Replaces the
  prototype's base64 data-URLs. Photo uploads return a public URL stored in `photo_url`.
- **Migrations:** SQL files in `supabase/migrations/`. A `supabase/seed.sql` containing the 8
  prototype venues is applied in **local dev + CI only**; **production starts empty**.

## Authentication & Authorization

- Supabase Auth, **email + password**.
- **Public signup is disabled.** Admins are invited from the Supabase dashboard.
- Therefore: **authenticated = invited admin.** No separate allowlist/roles table needed in v1.
- **RLS policies** on `venues`:
  - `SELECT`: allowed for everyone (anon + authenticated) → public read-only map.
  - `INSERT` / `UPDATE` / `DELETE`: allowed for `authenticated` only.
- Storage bucket policies mirror this: public read, authenticated write/delete.

## API Keys (new Supabase key model)

- Use Supabase's **new API keys**, not the legacy ones:
  - **Publishable key** (`sb_publishable_…`) — safe for the browser, used by the SPA.
    Replaces the legacy `anon` key. RLS remains the real security boundary.
  - **Secret key** (`sb_secret_…`) — replaces the legacy `service_role` key. **Never** shipped
    to the frontend; used only by trusted tooling/CI if needed.
- Frontend env vars (Vite, must be `VITE_`-prefixed):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SENTRY_DSN` (publishable; safe in browser)

## Secrets Policy (public repo)

- **No credentials of any kind committed to the repo.** Enforced by `.gitignore` for all
  `.env*` files except a committed `.env.example` template with placeholder values only.
- Real values live exclusively in:
  - **Netlify** build/deploy environment variables (production/preview).
  - **GitHub Actions** repository secrets (CI: Codecov token, Sentry auth token, etc.).
  - A developer's local gitignored `.env.local` for local development.
- The Supabase publishable key and Sentry DSN, while browser-safe, are still injected via env
  vars (not hardcoded) so environments stay swappable.

## Local Development (Docker)

- **Local Supabase stack** via the Supabase CLI (`supabase start`), which runs Postgres, Auth,
  Storage, and Studio in Docker. Migrations + `seed.sql` applied automatically.
- **App dev server** containerized: a `Dockerfile` (Node) + `docker-compose.yml` that runs the
  Vite dev server with hot reload, reading config from `.env.local`, pointing at the local
  Supabase stack.
- Goal: `docker compose up` (plus `supabase start`) yields a fully working local environment
  with seeded data, no host Node install required.

## CI/CD

- **GitHub Actions** pipeline: install → lint → typecheck → test with coverage →
  **upload coverage to Codecov** → build. On release, upload **Sentry source maps**.
- **Netlify** performs the actual deploys via its Git integration (production on `main`, deploy
  previews on PRs). `netlify.toml` defines build command, publish dir, and SPA redirect.
- No secrets in workflow files; all via GitHub/Netlify secret stores.

## Documentation (mandatory)

A thorough **README.md** (and/or **CONTRIBUTING.md**) is a required deliverable. It must let the
owner set up all infrastructure from scratch, covering:

1. Project overview + screenshots.
2. Prerequisites (Docker, Node/npm, Supabase CLI, accounts for Supabase/Netlify/Codecov/Sentry).
3. **Supabase setup:** create project, where to find the **publishable** and **secret** keys,
   disable public signup, invite admins, apply migrations, create the Storage bucket, RLS.
4. **Local dev:** `.env.local` from `.env.example`, `supabase start`, `docker compose up`,
   seeded data, running tests.
5. **Netlify setup:** connect repo, build settings, required env vars (names + where to get
   each value), deploy previews.
6. **Codecov setup:** add repo, token as GitHub secret.
7. **Sentry setup:** create project, DSN env var, source-map upload token as GitHub secret.
8. Complete table of all environment variables: name, purpose, where used, where to obtain.

## Testing Strategy

- **Unit (highest value):** `plzToCanton`, CSV parse/serialize, canton lookup, geocoding
  response mapping, i18n resolution.
- **Component:** search filtering, canton grouping/expand, admin CRUD flows with a mocked
  Supabase client, detail modal rendering.
- Coverage gates kept reasonable for a solo project; reported to Codecov on every push/PR.

## Risks / Notes

- **Nominatim** geocoding stays client-side (free); keep the prototype's debounce and
  `Accept-Language` headers to respect usage policy.
- **Wikimedia** coat-of-arms images load remotely (unchanged from prototype).
- Public repo means RLS correctness is critical — it is the only thing protecting writes. RLS
  policies should have explicit tests/verification during implementation.
- Photo handling changes from base64 data-URLs to Storage uploads; CSV/JSON import that carries
  data-URLs must be handled gracefully (upload-on-import or store URL as-is).
