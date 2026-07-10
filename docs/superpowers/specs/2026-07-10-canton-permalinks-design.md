# Canton-centered permalinks (?ctn=FR) — design

## Problem

There's no way to link to "the map centered on Fribourg" — useful for
sharing a canton-specific view (e.g. a club sharing "all our canton's
cellars"). See issue #10.

## Scope

- Support a `?ctn=<code>` URL query param (e.g. `?ctn=FR`).
- Parsed once, read-only, at app startup — this is not a live two-way
  URL sync. Clicking around the map/sidebar afterward does not rewrite
  the URL. (No router exists in this app today; adding two-way sync
  would be separate scope and would need to account for the not-yet-built
  `?venue=` permalink too.)
- On load, if the code is one of the 26 real cantons: pan/zoom the map to
  that canton's real geographic shape, and expand that canton's group in
  the sidebar.
- An unrecognized code (`?ctn=XX`) is silently ignored — falls back to the
  normal default view, no error shown.
- Matching is case-insensitive (`?ctn=fr` behaves like `?ctn=FR`).
- Mobile sidebar drawer stays closed by default (unchanged) — the map
  still fits the canton even though the drawer isn't auto-opened.
- Mutually exclusive with the (not yet built) `?venue=` venue permalink,
  which should take precedence once it exists, since it's more specific.
  No actual precedence code is needed yet since `?venue=` doesn't exist;
  `parseCantonParam` is the seam where that check gets added later.

### Out of scope

- Two-way URL sync (see above).
- Showing all 26 cantons in the sidebar (including ones with zero
  venues) with an empty-state "request access" message — split out to
  issue #34, since it's an independent UI/data change with its own open
  questions (what "request access" actually does).
- Drawing the canton boundary as a visible outline on the map — the
  boundary geometry is only used to compute where to pan/zoom to, not
  rendered.

## Approach

### Where the canton geometry comes from

`src/data/cantons.ts` currently has no coordinate/boundary data — only
`{ code, name, w }` (a Wikimedia coat-of-arms filename). Fitting the map to
"Fribourg" requires real canton geometry from somewhere.

Considered:
- **npm package (`swiss-maps`)** — real dependency, needs discussion per
  CLAUDE.md; its geodata is also non-commercial-licensed (sourced from
  BFS/FSO generalized boundaries), which is more restrictive than
  swisstopo's own free-geodata license.
- **Live API call at runtime** (swisstopo/geo.admin.ch or Nominatim,
  which this project already uses for geocoding) — rejected: turns a
  core map interaction into one with external-service latency and
  uptime/rate-limit risk on every page load. Also not reachable from
  this project's sandboxed dev/agent environment (confirmed via network
  policy check).
- **Fetch once, vendor as a static asset** (chosen) — no new runtime
  dependency, no runtime network call, and cantonal borders essentially
  never change so the data doesn't go stale.
- **Ship full boundary polygons and compute bounds at runtime** — ruled
  out in favor of the option below once outline-rendering was already
  scoped out: there's no consumer for full polygon precision, only for
  a bounding box.

Since no outline is ever drawn (see Scope), there's no need to ship or
parse full polygon geometry — only its bounding box per canton is ever
used. The bounding boxes were computed once, offline, from the official
swisstopo `swissBOUNDARIES3D` dataset (`TLM_KANTONSGEBIET` layer, Jan
2026 release, EPSG:2056/LV95), reprojected to WGS84 (EPSG:4326) and
rounded to 5 decimal places (~1m precision, matching the rounding already
used for hand-picked venue coordinates in `MapView.tsx`'s `onMapClick`).
Each of the 26 features' `NAME` field was matched against the existing
`CANTONS[].name` values in `src/data/cantons.ts` (exact string match for
all 26) to attach the 2-letter code. This was a one-time, offline
conversion (not part of this repo's Node/Vite toolchain) — swisstopo's
free-geodata license permits this reuse, and cantonal borders don't
change, so there's no ongoing regeneration step to automate.

### New modules

- **`src/lib/permalink.ts`** — `parseCantonParam(search: string): string | null`.
  Reads `ctn` from a `URLSearchParams`-parseable string, uppercases it,
  and returns the code only if `cantonByCode` recognizes it; otherwise
  `null`.
- **`src/data/cantonBounds.ts`** — a static lookup,
  `CANTON_BOUNDS: Record<string, [[number, number], [number, number]]>`,
  the 26 precomputed `code → [[minLat, minLng], [maxLat, maxLng]]`
  entries described above, plus `boundsForCanton(code: string): [[number, number], [number, number]] | null`,
  a trivial lookup (`CANTON_BOUNDS[code] ?? null`) so call sites don't
  reach into the raw table directly.

### App wiring

In `AppShell` (`src/App.tsx`):
- `ctnParam` is parsed once via a lazy `useState` initializer:
  `useState(() => parseCantonParam(window.location.search))`.
- `expanded`'s initial state becomes `{ [ctnParam]: true }` instead of
  the current hardcoded `{ BE: true }`, when `ctnParam` is set.
- `initialFocusBounds` is derived the same way, synchronously, since
  `boundsForCanton` is a static lookup with no dependency on the (async)
  venues query at all: `ctnParam ? boundsForCanton(ctnParam) : null`.

### MapView change

`MapView.tsx` gains an optional prop:

```ts
initialFocusBounds?: [[number, number], [number, number]] | null;
```

A `useEffect` keyed on this prop, guarded by an internal "already
applied" ref (mirroring the existing `selectedId` → `focusVenue` effect),
calls `map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 15, duration: 0.8 })`
the first time it becomes non-null, then never fires again — so it can't
re-snap the view later if `venues` (or anything else) causes a re-render.

## Error handling / edge cases

- Unrecognized code → `parseCantonParam` returns `null` → no sidebar
  group forced open, `initialFocusBounds` stays `null`, default full-CH
  view is unchanged.
- Recognized code with zero current venues → still fits the real canton
  shape (geometry doesn't depend on venue data). The sidebar simply has
  no group to expand for it, since `groupByCanton` already filters to
  cantons with venues — harmless no-op, not a special case to code for.

## Testing

- `src/lib/permalink.test.ts` (new): `parseCantonParam` — valid uppercase,
  valid lowercase, unknown code, missing param, empty string, param mixed
  with other query params.
- `src/data/cantonBounds.test.ts` (new): `boundsForCanton` — a known
  code (e.g. `FR`) returns its exact precomputed bounds, an unknown code
  returns `null`; a table-driven check that all 26 `CANTONS` codes have a
  `CANTON_BOUNDS` entry (keeps the two tables from silently drifting
  apart).
- No new `MapView`/Leaflet-level test — consistent with this codebase's
  existing convention of not unit-testing Leaflet internals directly
  (there's no `MapView.test.tsx` or `App.test.tsx` today).
