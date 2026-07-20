# Canton Poster Image — Design

## Problem

Admins want a quick way to produce a high-resolution image of a single
canton with its Schwingkeller venues plotted on it, for posting on social
media (Instagram, Facebook). Today there's no export path beyond the raw
JSON/CSV data export — nothing image-based exists.

## Goals

- Admin-only: generate a **1080×1080 PNG** for a chosen canton, showing the
  real map (street or satellite, whichever base layer is currently active)
  framed the same way the `?ctn=<code>` permalink already frames it, with
  that canton's venues plotted as pins.
- Overlay: canton name, coat of arms (Wappen), venue count, app branding,
  and map-tile attribution.
- Preview the generated image before saving (not a silent auto-download).
- No new npm dependencies.

## Non-goals

- Per-venue detail (names, addresses, a legend, etc.) on the poster —
  count-only, matching how the sidebar already summarizes a canton.
- Multiple export formats/aspect ratios (Story, landscape, etc.) — one fixed
  square size only.
- Non-admin access to this feature.
- A canton-outline/shape rendering (`public/cantons.geojson` is not used —
  it's also missing geometry for Basel-Stadt, so relying on it would need a
  fallback anyway; the real map view sidesteps that entirely).

## Why a real map capture, not a stylized graphic

An earlier direction considered drawing a stylized poster from
`public/cantons.geojson`'s canton outlines instead of real map tiles. That
data has a gap (Basel-Stadt has no polygon in the file) and required
reimplementing canton-shape rendering from scratch. Capturing the actual
Leaflet map view instead:

- Reuses `boundsForCanton()` (`src/data/cantonBounds.ts`), the same bounds
  already used for the `?ctn=` permalink — no new geo data needed.
- Reuses Leaflet's own tile loading, positioning, and
  `latLngToContainerPoint()` projection — no hand-rolled Web Mercator tile
  math.
- Both current base layers are viable for canvas export: OSM
  (`tile.openstreetmap.org`) and Esri World Imagery
  (`server.arcgisonline.com`) both send `Access-Control-Allow-Origin: *`
  (confirmed for OSM via a live response-header check; Esri's tile
  service is documented to support cross-origin export use). Canvas
  `toBlob()`/`toDataURL()` only throw a `SecurityError` ("tainted canvas")
  when a drawn image came from a cross-origin source *without* CORS
  headers — irrelevant here since both providers send them. Whether the
  capturing map is visible on-screen or off-screen makes no difference to
  this rule; only the tile response headers matter.

## Capture mechanism

New module `src/features/venues/cantonPoster.ts`.

1. **Off-screen Leaflet instance**: create a detached `<div>` (appended to
   `document.body`, positioned off-viewport via `position: fixed; left:
   -9999px`, given real layout dimensions — Leaflet requires a laid-out
   container to load tiles) sized to `1080×1080`. Removed after capture
   completes (success or failure).
2. Construct a `L.Map` on it with the same tile layer construction already
   used in `MapView.tsx`'s `setTile()` (factored into a small shared
   helper so both call sites stay in sync), using whichever `baseKind`
   (`'map' | 'sat'`) is currently active in the app — passed in as an
   argument.
3. `map.fitBounds(boundsForCanton(code), { padding: [40, 40] })` — the same
   padding used by `MapView`'s existing `initialFocusBounds` effect, so
   the framing matches what an admin already sees when following a
   `?ctn=` link.
4. Add a marker (reusing `pinHtml()` from `markers.tsx`, scaled up) for
   every venue in that canton.
5. Wait for the tile layer's `load` event (all visible tiles finished
   loading) before capturing — with a timeout fallback (e.g. 8s) in case a
   tile request hangs, so the flow can't stall forever.
6. Draw the result onto an output `<canvas>`:
   - Walk `map.getPane('tilePane')`'s `<img class="leaflet-tile">`
     children; each has its draw position available via its CSS
     transform. Draw each onto the canvas at the corresponding offset.
   - For each venue, `map.latLngToContainerPoint(latlng)` gives the pixel
     position directly; draw the pin (red dot, white ring — same style as
     `pinHtml()`) at that point.
7. Overlay branding on top of the same canvas: canton name (Oswald,
   uppercase, matching the sidebar canton-header style), Wappen image
   (`wappenUrl()`, drawn via `crossOrigin: 'anonymous'` — Wikimedia's
   `upload.wikimedia.org` is expected to send permissive CORS headers,
   same pattern as the map tiles), a venue-count pill (reusing the visual
   style of the sidebar's count badge), an app name/URL footer line, and
   the active tile provider's attribution text (`© OpenStreetMap
   contributors` or `© Esri, Maxar, Earthstar Geographics`, matching the
   strings already in `MapView.tsx`). The Wappen draw is wrapped so a
   failure there (slow load, unexpected CORS behavior) skips just that
   image rather than failing the whole capture — it's a non-critical
   decorative element, unlike the map/pins.
8. `canvas.toBlob('image/png')` → resolve with the `Blob`. Tear down the
   off-screen map/container in a `finally`.
9. If anything in this pipeline throws (tile timeout, `SecurityError`,
   network failure), reject with an error the caller turns into a
   translated flash-toast message (`showFlash('err', ...)`) — the existing
   pattern already used for import/export failures in `App.tsx`.

## UI

- **Entry point**: `Sidebar.tsx`'s canton group header (Wappen · name ·
  count pill · chevron) gains a small icon button, rendered only when
  `isAdmin` is true, shown for every canton regardless of venue count
  (including 0). Click calls a new `onGeneratePoster(code)` prop. Shows a
  small inline spinner while generating.
- **Preview**: a new `PosterPreviewModal` (in `src/features/venues/` or
  `src/components/`, following the existing `Modal` component pattern used
  elsewhere) opens once the blob resolves, showing the PNG via an
  `<img src={URL.createObjectURL(blob)}>` and a "Save image" button that
  triggers the actual file download (`downloadBlob()`, a small binary
  sibling to the existing string-based `download()` helper in `App.tsx`),
  filename `schwingkeller-<canton-code-lowercase>.png`. Closing the modal
  revokes the object URL.
- Wiring: `App.tsx` holds the generation/preview state (loading canton
  code, resulting blob or error) the same way it already holds
  `pendingImport`/`flash` state, and passes `onGeneratePoster` down to
  `Sidebar`.

## i18n

New DE/FR/IT keys: the generate-icon's title/aria-label, the preview
modal's title and "Save image" button, and a generation-failed flash
message. No new keys needed inside the rendered image itself beyond
reusing existing venue-count phrasing already present in the UI strings.

## Testing (TDD)

- `cantonPoster.test.ts`: mocked Leaflet map/canvas — asserts the tile
  layer is constructed with the currently-passed `baseKind`, `fitBounds`
  is called with `boundsForCanton(code)` and the expected padding, a
  marker is added per venue in that canton (and none for other cantons),
  the tile-load timeout path rejects cleanly, and the off-screen container
  is always removed (success and failure paths).
- `Sidebar.test.tsx`: extend existing tests — the generate icon renders
  only when `isAdmin`, renders even when a canton's count is 0, and
  clicking it calls `onGeneratePoster` with the right canton code.
- `PosterPreviewModal.test.tsx`: renders the passed image, "Save image"
  triggers the download callback, closing revokes the object URL.
- No pixel-diffing/visual regression testing — Vitest/jsdom can't render
  real canvas output meaningfully; correctness here is verified by manual
  check (see Verification below), not automated pixel assertions.

## Verification before shipping

Run the dev server, log in as admin, generate a poster for a canton with
several venues (e.g. Bern) and one with zero (to confirm the 0-count path
doesn't break), for both base layers (map and satellite), and confirm the
downloaded PNG looks correct — framing matches `?ctn=BE`, pins are in the
right places, overlay text is legible, attribution is present.

## New dependencies

None — native `fetch`, `Canvas`, and the Leaflet APIs already in use
(`L.Map`, `latLngToContainerPoint`, tile pane DOM) cover everything.

## Summary of changes

- New `src/features/venues/cantonPoster.ts`: off-screen Leaflet capture →
  canvas composite (tiles + pins + branding) → PNG `Blob`.
- New `PosterPreviewModal` component + `downloadBlob()` helper.
- `Sidebar.tsx`: admin-only generate icon per canton row (all counts,
  including 0).
- `App.tsx`: generation/preview state and wiring, reusing the existing
  flash-toast pattern for errors.
- `MapView.tsx`: tile-layer construction factored into a small shared
  helper so the live map and the off-screen capture map stay in sync.
- New DE/FR/IT i18n keys.
