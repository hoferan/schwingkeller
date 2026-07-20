# Canton Poster Editor — Design

**Status:** Approved (brainstorming)
**Date:** 2026-07-20
**Builds on:** [2026-07-20-canton-poster-image-design.md](2026-07-20-canton-poster-image-design.md)

## Goal

Turn the current one-shot canton poster (render once → static preview → save)
into an **interactive editor**, admin-only, where the user can:

- move/zoom the map to reframe the shot,
- switch the base layer (map / satellite),
- edit the title text (default = canton name),
- show/hide the header and footer chrome,
- include a QR code linking to the canton's shareable permalink,

then download a crisp **1080×1080 PNG** of the composed result.

## Non-goals (v1 / YAGNI)

Pin show/hide, custom fonts/colours, repositionable or multi-corner chrome,
aspect-ratio options (fixed 1080²), and saved/persisted presets are explicitly
out of scope. Editor state is ephemeral — it lives only while the modal is open.

## Interaction model

**Live interactive editor** (chosen over a controls-only re-render approach):
the modal hosts a real, draggable/zoomable Leaflet map with the header/footer/QR
rendered as DOM chrome layered on top, so the editor is WYSIWYG.

**Display vs. export resolution** (chosen: small live map + off-screen
re-capture on save, over a CSS-scaled 1080² map): the editor map renders at a
comfortable on-screen size (~480px square, responsive). On **Download** we spin
up the existing off-screen 1080² capture map set to the *same center / zoom /
base layer*, draw tiles + pins + the enabled chrome + QR, and export. This
reuses the hardened capture path and keeps interaction on a plain, untransformed
map (CSS-transformed Leaflet causes drag/zoom pointer-offset glitches). The
framing matches exactly because we capture the editor map's precise view.

## Components

### `PosterEditorModal` (new — replaces `PosterPreviewModal`)

Owns editor state and the live map. `PosterPreviewModal` is retired.

State:

```ts
interface PosterEditorState {
  baseKind: BaseKind;        // 'map' | 'sat'  (seeded from the app's current base layer)
  center: LatLng;            // read from the live map on moveend/zoomend
  zoom: number;
  showHeader: boolean;       // default true
  showFooter: boolean;       // default true  (branding band; attribution is separate — see below)
  showQr: boolean;           // default true
  title: string;             // default = canton.name
}
```

Props: `code`, `venues`, `initialBaseKind`, `unitLabel`, `onClose`,
`onSave(blob, filename)`. The modal performs the capture internally and hands
the finished blob to `onSave`; `App` keeps ownership of the actual file
download (`downloadBlob`).

Layout (responsive; square capped ~480px, controls stack below on narrow
screens):

```
┌───────────────────────────── modal ─────────────────────────────┐
│  ┌───────────────────────┐   Poster: BERN                        │
│  │▓ BERN            [3] ▓ │   Title: [ Bern             ]        │
│  │▓ (header chrome)     ▓ │   Base:  (Map) ( Satellite )         │
│  │        ● ●            │   ☑ Header   ☑ Footer   ☑ QR code     │
│  │   live draggable map  │   [ Reset framing ]                   │
│  │▓ © OSM   ▓   ┌────┐   │                                       │
│  │▓ (footer)▓   │ QR │   │   [ Cancel ]      [ Download PNG ]     │
│  └───────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────┘
```

- Live map opens fit to `boundsForCanton(code)` (today's default framing), built
  with `createTileLayer(baseKind, 'anonymous')`. Pins for the canton's venues are
  always shown (reuse the existing pin rendering); not toggleable in v1.
- Chrome overlays are absolutely-positioned DOM over the map square; toggles
  show/hide them live.
- **Attribution** (`© OpenStreetMap` / `© Esri…`) stays visible even when the
  footer/branding is toggled off — required by the tile providers' terms.
- **Reset framing** re-fits the map to `boundsForCanton(code)`.
- **Download PNG** runs the off-screen capture and shows a spinner while
  rendering; on success calls `onSave(blob, filename)`.

### `usePosterQr(code)` (new hook)

Builds the absolute canton permalink and returns a memoized QR data-URL.

- URL: `withCantonParam(window.location.href, code)` — a new helper added to
  `src/lib/permalink.ts` mirroring the existing `withVenueParam` (sets `ctn`,
  clears `venue`). Encodes the absolute URL (origin + path + `?ctn=<CODE>`).
- QR: `qrcode` library → `toDataURL(url, { margin, width })`. A same-origin
  `data:` URL is safe to draw on the export canvas (no CORS taint) and can be
  shown directly via `<img>` in the editor.

### `qrcode` dependency (new)

Approved new npm dependency. Small, MIT-licensed, generates QR locally (no
network). This is the only new dependency.

## Capture refactor (`cantonPoster.ts` / `posterCanvas.ts`)

`generateCantonPosterBlob` is parameterized by an explicit view + overlay
options instead of a fixed `fitBounds`:

```ts
generateCantonPosterBlob(code, venues, {
  baseKind,
  view: { center, zoom },
  showHeader, showFooter,
  title,
  qrDataUrl,          // undefined when QR is off
  unitLabel,
}): Promise<{ blob: Blob; filename: string }>
```

- Off-screen 1080² map does `setView(center, zoom)` instead of `fitBounds`.
  Everything else is unchanged: `extractTileDraws` / `drawTiles` / `drawPin`,
  `crossOrigin: 'anonymous'`, and the tile-load wait with timeout.
- `drawPosterOverlay` gains `{ showHeader, showFooter, title, qrImg }`:
  - header band drawn only when `showHeader`; uses `title` (default canton name),
  - footer branding band drawn only when `showFooter`,
  - **minimal attribution credit always drawn** regardless of `showFooter`,
  - QR drawn in the **bottom-right** corner (inset above the footer band) when
    `qrImg` is provided (loaded from `qrDataUrl` via the existing `loadImage`).

## Data flow

1. Admin clicks the sidebar generate icon → `App` opens `PosterEditorModal`
   (fast; no eager render). `App.generatePoster(code)` becomes "open editor".
2. Editor initializes: live map fit to canton bounds, state seeded.
3. Edits: map `moveend`/`zoomend` update `center`/`zoom`; controls update
   `baseKind`/`title`/toggles; DOM chrome mirrors state live.
4. Download: read current view + options → `generateCantonPosterBlob(...)` →
   off-screen 1080² render at that exact view → `toBlob` → `onSave(blob,
   filename)` → `App.downloadBlob(filename, blob)`. Spinner on the Download
   button during the render; failures surface via the existing
   `showFlash('err', …)` path (`t.posterGenerateFailed`).

## App wiring changes

- Replace the `posterPreview` blob-state + `PosterPreviewModal` with an
  `posterEditor: { code } | null` state + `PosterEditorModal`.
- `generatePoster(code)` → `openPosterEditor(code)` (synchronous; just sets
  state). The 1080² render + download move into the editor.
- `posterLoadingCode` is no longer needed on the sidebar icon (opening is
  instant); the busy state lives on the editor's Download button. Remove the
  `posterLoadingCode` prop from `Sidebar` and drop the now-obsolete
  "disables ALL generate-poster icons while any canton is loading" test (and
  the loading-disable branch it covers). The sidebar's `onGeneratePoster` prop
  and admin gating are unchanged; the icon simply calls `onGeneratePoster(code)`
  to open the editor.

## i18n

New DE/FR/IT keys, kept in sync: editor heading (`Poster: <canton>`), title
label, base-layer labels (map / satellite), header / footer / QR toggle labels,
reset-framing, download-PNG, cancel. Reuse existing `close`/`saveImage` where
they fit.

## Testing

Mock-based, matching the existing `cantonPoster.test.ts` style (jsdom cannot
exercise real Leaflet drag or canvas tainting):

- `generateCantonPosterBlob` calls `setView` with the passed `center`/`zoom`
  and forwards `showHeader`/`showFooter`/`title`/`qrDataUrl` to
  `drawPosterOverlay`; still returns the lowercase-canton filename + PNG blob.
- `drawPosterOverlay`: header skipped when `showHeader` is false; attribution
  **still drawn** when `showFooter` is false; QR `drawImage` called when
  `qrImg` present; `title` override respected over the canton name.
- `withCantonParam` sets `ctn=<CODE>` and clears `venue`; `usePosterQr` builds
  the correct absolute URL and returns a data-URL (mock `qrcode`).
- `PosterEditorModal` (React Testing Library, mocked map + capture): renders
  controls; toggling Header hides the header chrome; editing Title updates the
  header text; Download invokes capture with the current state and calls
  `onSave` with the resulting blob.
- Update the existing `cantonPoster.test.ts` for the new signature.

## Risks / notes

- CSS-transform pointer glitches avoided by the off-screen re-capture approach.
- QR/attribution stay same-origin/self-contained, preserving the tainted-canvas
  fix from the prior poster work.
- `moveend`/`zoomend` handlers must be cleaned up with the map (mirror the
  StrictMode-safe teardown already used in `MapView`).
