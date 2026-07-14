# "Nearest to me" geolocation sort — design

**Date:** 2026-07-14
**Issues:** #11 ("Nearest to me" geolocation sort) + #18 (Sidebar sort options: name / distance) — delivered together, since they are interdependent.

## Problem / motivation

Users physically near several venues (e.g. traveling for a wrestling event) have no way to
find the closest one; today they must recognize town names inside a canton-grouped list. The
venue list is also only ever grouped by canton in a fixed alphabetical order, with no way to
sort by name or by distance.

## UX model

The sidebar gains a single **view/sort control** with three options. The third is
location-gated:

| Option | List structure | Location? |
|---|---|---|
| **Canton** *(default)* | grouped by canton, alphabetical — today's view, all 26 cantons | no |
| **Name** | flat list, A–Z across all cantons, each row shows a mini canton Wappen | no |
| **Distance** | flat list, nearest-first, each row shows mini Wappen + distance badge | **yes** |

Canton mode *is* "group by canton" and remains the default landing experience — this preserves
the canton-first identity reinforced by recent work (#33, #34, #35, #37: all 26 cantons always
visible, canton-centered `?ctn=` permalinks, canton-centered sharing). Choosing Name or Distance
flattens the list; canton identity survives as a per-row Wappen rather than as a group header.

This intentionally revises issue #18's original "sort applies within each canton group and does
not change the grouping" line. Reordering canton *groups* by their nearest member was considered
and rejected: ordering groups by their single closest venue is not a true nearest-first ordering
(a group's 2nd venue can be far away, yet it sorts above a closer venue in the next group), so it
*looks* sorted while misleading the user. Flattening for Distance is the only honest
nearest-first result; the mini Wappen keeps canton legibility at the row level.

`?ctn=FR` is untouched: it lands the user in Canton (grouped) mode with FR expanded and the map
centered. Switching to Name/Distance afterwards flattens the list across all cantons; the map
focus is independent. No dedicated canton-filter dropdown is added in this scope.

## Components

### Sort control

A compact segmented control placed directly above the list header. Three segments.
**Distance** is disabled/greyed until a position is available; clicking it while disabled
triggers the location request rather than silently no-op-ing.

- Implemented as a keyboard-navigable radio group (`role="radiogroup"`, arrow-key movement,
  visible focus ring) so the accessibility pass (#17) can build on it.
- Selection is **ephemeral** — resets to Canton on reload; not persisted. A returning user
  expects the familiar canton landing.

### Shared geolocation hook

A single `useGeolocation` hook lifted into `App`, feeding **both** the map locate button and the
sidebar Distance option — one acquisition, one permission prompt, two consumers.

State exposed: `unsupported` | `idle` | `prompting` | `granted(position)` | `denied` | `error`.

- **Never auto-requests on load.** Fires only on an explicit user action (map locate button, or
  selecting Distance).
- **One-shot `getCurrentPosition`**, not live `watchPosition` — sufficient for finding the
  nearest keller, and no battery drain. Options: `{ enableHighAccuracy: false, timeout: 10000,
  maximumAge: 300000 }` so a recent fix is reused across both consumers without re-prompting.

### Map "locate me" button + "you are here" marker

- A Leaflet control button in the existing bottom-right control stack in `MapView`
  (`LocateFixed`/`Crosshair` lucide icon, matching existing button styling).
- On click → calls the shared hook's `request()`. On `granted` → the map flies to the position
  and drops a distinct **"you are here" marker** (small accent-colored dot, visually distinct
  from venue markers so it never joins a cluster or is mistaken for a venue). No accuracy circle
  (kept minimal).
- Button reflects hook state: spinner while `prompting`, error tint on `denied`/`error`.

### Distance module

New pure module `src/features/venues/distance.ts`:

- `haversineKm(a, b)` → kilometers between two `{ lat, lng }`.
- `formatDistance(km, locale)` → `"850 m"` below 1 km, `"4.2 km"` from 1–99 km, `"120 km"` at
  ≥ 100 km. Uses `Intl.NumberFormat` for the active locale's decimal separator (FR/IT → `4,2 km`).
- `sortByDistance(venues, origin)` → new array, nearest-first. All venues carry `lat`/`lng`
  (required by the `Venue` type), so distance is always computable — no missing-coordinate case.

Zero new dependencies (aligns with the issue's rejection of a third-party geo library).

### Flat-list rendering

- `grouping.ts` keeps `groupByCanton` for Canton mode and gains `flatSorted(venues, mode, origin?)`
  returning a plain `Venue[]` (name A–Z, or distance nearest-first).
- `Sidebar` branches on the selected view: Canton mode renders today's grouped markup; Name and
  Distance render a flat list. Flat rows reuse the existing row style plus a **mini Wappen**
  (≈16px, via existing `wappenUrl`) and — in Distance mode only — a right-aligned distance badge
  styled like the existing count pills.
- Search works in every mode: in flat modes `filterVenues` runs first, then the flat sort.

## Data flow

- New state in `AppShell`: `sortMode: 'canton' | 'name' | 'distance'` (default `'canton'`) and the
  `useGeolocation` hook result.
- Passed to `Sidebar` (mode + setter + geo state) and `MapView` (geo state + request handler).
- No changes to `useVenues` / TanStack Query / Supabase — entirely client-side view logic.

## Graceful degradation (issue requirement)

- **`unsupported`** (no `navigator.geolocation`) → Distance segment hidden; map locate button hidden.
- **`denied`** → Distance segment visible but disabled with a short hint; map button shows a
  disabled/error state. No nagging — user re-enables via the browser.
- **`error`/timeout** → transient toast (reuse App's existing `flash` mechanism); Distance stays
  disabled.
- **Distance badges appear only in Distance mode.** In Canton/Name mode the position may be known
  (for the map marker) but rows stay clean — out-of-order badges in a name/canton list are noise.

## i18n — new keys (DE / FR / IT)

- `sortBy` (control label), `sortCanton`, `sortName`, `sortDistance`
- `useMyLocation` (map button aria/title + disabled-Distance hint)
- `locationDenied`, `locationError`, `locationUnsupported`
- `youAreHere` (marker aria)

The distance badge itself is the bare locale-formatted value (`4.2 km` / `4,2 km`), not a
translated phrase — the unit is formatted, not translated.

## Testing (TDD, Vitest + RTL)

- **`distance.test.ts`** — haversine against known city pairs (Bern↔Zürich ≈ 95 km); formatter
  thresholds + locale separators; sort ordering.
- **`grouping.test.ts`** — extend for `flatSorted` (name A–Z, distance nearest-first, search+flat
  interaction).
- **`Sidebar.test.tsx`** — control switches modes; Distance disabled without position, enabled
  with; badges render only in Distance mode; flat rows show a Wappen.
- **`useGeolocation` test** — mock `navigator.geolocation`: granted/denied/unsupported/timeout
  transitions; assert no request on mount.
- **`MapView` test** — locate button triggers request; "you are here" marker renders on `granted`
  (following the existing Leaflet-mock pattern in the map tests).

## Out of scope (YAGNI)

Live tracking (`watchPosition`), canton-scoped "nearest within FR", persisting sort/location
across reloads, distance badges in Canton/Name modes, IP-based fallback, a permalink param for
sort mode.
