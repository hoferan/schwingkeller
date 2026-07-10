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
  CLAUDE.md, plus a TopoJSON→GeoJSON conversion step.
- **Live API call at runtime** (swisstopo/geo.admin.ch or Nominatim,
  which this project already uses for geocoding) — rejected: turns a
  core map interaction into one with external-service latency and
  uptime/rate-limit risk on every page load.
- **Fetch once, vendor as a static asset** (chosen) — no new runtime
  dependency, no runtime network call, and cantonal borders essentially
  never change so the data doesn't go stale.

A one-off script, `scripts/fetch-canton-boundaries.mjs`, fetches the 26
canton geometries from the official swisstopo/geo.admin.ch API
(`swissBOUNDARIES3D`, free/open license), simplifies them to a
web-appropriate precision, and writes `src/data/canton-boundaries.json` — a
GeoJSON `FeatureCollection` with one `Feature` per canton, each
`properties.code` matching the existing `CANTONS` codes. The script is
documented so it can be re-run if boundaries are ever revised; it isn't
part of the app build/runtime.

### New modules

- **`src/lib/permalink.ts`** — `parseCantonParam(search: string): string | null`.
  Reads `ctn` from a `URLSearchParams`-parseable string, uppercases it,
  and returns the code only if `cantonByCode` recognizes it; otherwise
  `null`.
- **`src/data/cantonBoundaries.ts`** — `boundsForCanton(code: string, collection = cantonBoundaries): [[number, number], [number, number]] | null`.
  Walks the matching feature's `Polygon`/`MultiPolygon` rings (some
  cantons have multi-part geometry) and returns a min/max lat/lng box, or
  `null` if the code isn't in the collection. The `collection` parameter
  defaults to the real imported data but lets tests pass a small
  synthetic `FeatureCollection` fixture instead.

### App wiring

In `AppShell` (`src/App.tsx`):
- `ctnParam` is parsed once via a lazy `useState` initializer:
  `useState(() => parseCantonParam(window.location.search))`.
- `expanded`'s initial state becomes `{ [ctnParam]: true }` instead of
  the current hardcoded `{ BE: true }`, when `ctnParam` is set.
- `initialFocusBounds` is derived the same way, synchronously, since
  `boundsForCanton` doesn't depend on the (async) venues query at all:
  `ctnParam ? boundsForCanton(ctnParam) : null`.

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
- `src/data/cantonBoundaries.test.ts` (new): `boundsForCanton` — using a
  small synthetic `FeatureCollection` fixture (a known square/triangle
  geometry with a predictable min/max result) rather than asserting on
  real Switzerland coordinates; also an unknown-code case returning
  `null`.
- No new `MapView`/Leaflet-level test — consistent with this codebase's
  existing convention of not unit-testing Leaflet internals directly
  (there's no `MapView.test.tsx` or `App.test.tsx` today).
