# Canton Poster — Canton Border Overlay — Design

**Status:** Approved (brainstorming)
**Date:** 2026-07-21
**Builds on:** [2026-07-20-canton-poster-image-design.md](2026-07-20-canton-poster-image-design.md), [2026-07-20-canton-poster-editor-design.md](2026-07-20-canton-poster-editor-design.md)

## Context

Admin feedback on the canton poster/image export feature, sub-project D
(last) of a 4-part decomposition (A. framing + legibility, B. aspect
ratio, C. header/footer customization, D. canton borders — each gets its
own spec):

- "display canton borders"

The original canton-poster-image spec explicitly rejected building the
poster **entirely** from `public/cantons.geojson` outlines instead of
real map tiles — the deciding factor at the time was that Basel-Stadt
has no polygon in that file, and reimplementing canton-shape rendering
from scratch wasn't worth it when capturing the real Leaflet map sidesteps
the problem entirely. That decision was about replacing the whole map
with a stylized graphic. It says nothing about **overlaying** a border
line on top of the real map tiles, which is what this feedback asks for
— this spec doesn't reverse the earlier decision, it adds to it.

## Technical feasibility (investigated up front, since it's the crux)

The existing capture pipeline already solves this problem's shape: venue
pins are drawn onto the export canvas by calling
`map.latLngToContainerPoint(latlng)` for each pin's coordinate and
drawing with the Canvas 2D API. A canton border is just *more*
coordinates through that same primitive — walk the GeoJSON polygon's
vertex list, project each `[lat, lng]`, and stroke the resulting path.
No SVG capture, no new capture mechanism, no risk — it reuses the exact
technique already proven for pins.

For the **live editor preview** — an interactive, pannable/zoomable map,
unlike the static one-shot capture — the natural fit is Leaflet's native
`L.geoJSON(feature).addTo(map)`, which auto-reprojects on pan/zoom for
free. This mirrors an existing split in this codebase: the live preview
already renders pins via `L.marker`/`divIcon` while the capture path
manually projects and draws them — two rendering strategies for the same
visual element, already established.

## Data source: replacing `public/cantons.geojson`

The current bundled file has two problems for this use case: Basel-Stadt's
`geometry` is `null` (confirmed by inspection), and its precision/style
wasn't vetted for "traced as a visible border line," only for the
Basel-Stadt-excluding, never-rendered role it played before (it isn't
used anywhere in the running app today).

Research into replacement sources (see below) turned up three
candidates. **Finalizing which one, fetching it, and vetting its
precision/file size is deferred to the implementation plan** as an
explicit early task — it doesn't change any of the rendering design
below, which operates on a plain GeoJSON `FeatureCollection` of `Polygon`
features regardless of which source produced it.

- **geo.admin.ch's official REST/download API**
  (`api3.geo.admin.ch` / `data.geo.admin.ch`, supports
  `geometryFormat=geojson`) — the authoritative swisstopo
  `swissBOUNDARIES3D` source, and per opendata.swiss the same parent
  dataset the current bundled file already claims as its provenance.
  Since Basel-Stadt indisputably has real geometry in the government's
  own dataset, the current file's gap is almost certainly an artifact of
  whatever one-off extraction produced this specific bundled copy, not a
  gap upstream — re-exporting fresh very likely fixes it outright. This
  is cadastral-grade precision, which may need simplification to keep a
  reasonable bundle size.
- **interactivethings/swiss-maps** (github.com/interactivethings/swiss-maps) —
  a maintained project that generates pre-simplified GeoJSON/TopoJSON
  from swisstopo data specifically for web-map display, with a tunable
  simplification level (its own build defaults to 50% simplification).
  Fetchable as a static file directly from its CDN distribution without
  an npm install, so it can be vetted and re-hosted as a static file the
  same way `public/cantons.geojson` already is today — no new runtime
  dependency.
- **labs.karavia.ch's community mirror** of `swissBOUNDARIES3D`
  Kantonsgebiet, already republished as ready WGS84 GeoJSON — possibly
  the most direct drop-in source.

**Recommended order to try at plan time:** geo.admin.ch's official export
first (authoritative, likely fixes Basel-Stadt outright); fall back to
interactivethings/swiss-maps if the raw export proves too large/detailed
to bundle without doing our own polygon simplification. Whichever is
chosen, the plan must also confirm/adjust the property key
`cantonFeaturesFor` (below) matches on — the current file uses a `NAME`
string; if the replacement carries `KANTONSNUM` (the official Swiss
canton numeric ID), matching by that would be more robust than
name-string matching (immune to spelling/locale variants like
"Genève"/"Genf"/"Geneva") and worth adopting if available.

## Design

### Data layer: new `src/data/cantonGeoJson.ts`

```ts
export interface CantonFeature {
  type: 'Feature';
  properties: { NAME: string }; // property key to be confirmed against the final source, see above
  geometry: { type: 'Polygon'; coordinates: number[][][] } | null;
}
export interface CantonFeatureCollection {
  type: 'FeatureCollection';
  features: CantonFeature[];
}

export const loadCantonGeoJson = (): Promise<CantonFeatureCollection>
export const cantonFeaturesFor = (code: string, fc: CantonFeatureCollection): CantonFeature[]
```

- `loadCantonGeoJson` fetches the bundled file (`${import.meta.env.BASE_URL}cantons.geojson`,
  matching the existing `wappenUrl()` base-path pattern) once and caches
  the resulting promise in a module-level variable — repeated calls
  (across cantons, across editor opens) reuse the same fetch.
- `cantonFeaturesFor` filters to features whose match property equals
  the given canton's, **excluding** any with `geometry: null` (so it
  returns `[]` for Basel-Stadt if the replacement source still lacks it,
  and `[]` for an unknown code — no special-casing needed elsewhere).
  It also naturally **aggregates multiple `Feature` entries per canton**:
  several cantons are represented as multiple polygon pieces (main body
  plus exclaves) sharing the same match property, and a complete border
  requires drawing all of them, not just the first match.

### Capture path: new `drawCantonBorder` in `posterCanvas.ts`

```ts
export const drawCantonBorder = (
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  features: CantonFeature[],
): void
```

No-ops immediately if `features` is empty. Otherwise, for every ring of
every feature's polygon, swaps each `[lng, lat]` GeoJSON coordinate to
Leaflet's `[lat, lng]` order, projects it via `map.latLngToContainerPoint()`
(the same primitive already used for pins), and builds one `Path2D`
covering all rings/features. Strokes it **twice** for a halo effect that
reads on both the OSM street basemap and Esri satellite imagery: a dark
pass underneath (`rgba(17,17,17,0.85)`, 6px), a white pass on top
(2.5px).

Draw order in `generateCantonPosterBlob` (`cantonPoster.ts`): tiles →
**border** → pins → chrome overlay. Pins stay visually on top of the
border; the chrome overlay stays topmost, unchanged from today.
`GeneratePosterOptions` gains `showBorder?: boolean`. Loading the geojson
and calling `drawCantonBorder` only happens when `showBorder` is true.

### Failure handling

A `cantons.geojson` fetch failure (or any rejection from
`loadCantonGeoJson`) is treated as non-critical, exactly like a failed
Wappen image load today: caught and swallowed, the border silently
skipped rather than failing the whole poster generation.

### Live preview: `PosterEditorModal.tsx`

New `usePosterCantonBorder(code)` hook (mirrors the existing
`usePosterQr` pattern) loads and memoizes `cantonFeaturesFor(code, ...)`
for the current canton. A new `showBorder` state (default **off** —
consistent with every other new toggle in sub-projects A/B/C, so nothing
changes for admins who don't opt in) drives a `useEffect` that, while
`showBorder` is on and features are loaded, adds **two** native
`L.geoJSON` layers to the live map (the same halo trick: thick dark
layer added first, thin white layer added on top) and removes both on
cleanup (toggle off, canton change, or unmount). Leaflet handles all
pan/zoom re-projection automatically for these layers — no manual
redraw logic needed, unlike the static capture. `download()` forwards
the current `showBorder` value to `generateCantonPosterBlob`.

### Left unchanged

`drawTiles`, `drawPin`, `extractTileDraws` — untouched, as already
established in sub-project B's spec.

## Non-goals

- Custom border color/weight/style controls — the fixed halo look
  answers "display canton borders" without adding another style axis on
  top of sub-project C's header/footer style controls.
- Borders for anything other than the currently-generated canton (e.g.
  neighboring cantons' outlines for context) — out of scope, not
  requested.
- Re-deriving `cantonBounds.ts`'s bounding boxes from the replacement
  geometry — that file serves a different purpose (framing) and isn't
  touched by this spec.

## Interaction with sub-projects A, B, C

**None required.** Border drawing uses the same orientation-agnostic
`latLngToContainerPoint` primitive already established (in sub-project
B's spec) as unaffected by aspect ratio, and it's drawn on the map layer
strictly before the chrome overlay, so header/footer position, style, or
size (sub-project C) never interacts with it. This is the only one of
the four sub-projects with no cross-spec coordination note.

## Testing (TDD)

- `cantonGeoJson.test.ts`: `loadCantonGeoJson` fetches only once across
  repeated calls (mock `fetch`); `cantonFeaturesFor` aggregates
  multi-piece cantons into one array, returns `[]` for a canton with
  null geometry and for an unknown code.
- `posterCanvas.test.ts`: `drawCantonBorder` no-ops on an empty features
  array; for a fixture feature, projects every ring vertex via
  `latLngToContainerPoint` and strokes twice with the two distinct
  style passes (dark halo, then white line).
- `cantonPoster.test.ts`: border is drawn only when `showBorder` is true
  and matching geometry exists; a geojson fetch rejection doesn't reject
  poster generation as a whole.
- `PosterEditorModal.test.tsx`: toggle renders and updates `showBorder`
  state; `download()` forwards `showBorder`; the two halo/line layers
  are added to the live map when both `showBorder` is on and features
  have loaded, and removed on toggle-off/unmount.

## Verification before shipping

Run the dev server, log in as admin, open the poster editor for a
canton with a simple single-piece border (e.g. Zug), a canton with
known exclaves (e.g. Fribourg, per the multi-feature aggregation this
design relies on), and Basel-Stadt (confirm the toggle stays enabled but
the border silently doesn't render). Confirm the border is visible and
readable on both the map and satellite base layers, doesn't visually
collide with pins or chrome, and that the live preview's border position
matches the exported PNG's.

## Summary of changes

- Replace `public/cantons.geojson` with a vetted source that covers all
  26 cantons at adequate precision (implementation-plan task, sources
  and recommendation above).
- New `src/data/cantonGeoJson.ts`: `loadCantonGeoJson()`,
  `cantonFeaturesFor()`.
- `posterCanvas.ts`: new `drawCantonBorder()`.
- `cantonPoster.ts`: `GeneratePosterOptions` gains `showBorder`; capture
  draws the border (tiles → border → pins → chrome).
- `PosterEditorModal.tsx`: new `showBorder` state and toggle, new
  `usePosterCantonBorder()` hook, live `L.geoJSON` halo layers, forwarded
  to `download()`.
- Test coverage added/extended in `cantonGeoJson.test.ts`,
  `posterCanvas.test.ts`, `cantonPoster.test.ts`,
  `PosterEditorModal.test.tsx`.
