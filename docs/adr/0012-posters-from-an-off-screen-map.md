---
status: accepted
date: 2026-07-20
decision-makers: André Hofer
---

# Build posters from an off-screen map drawn onto a canvas

## Context and problem statement

Admins want an image of a canton and its venues to post on social media and print. It should look
like the map people know, carry a QR code back to the app, and match what the admin saw while
framing it.

## Considered options

For the picture:

* A stylised poster drawn from `cantons.geojson`
* A capture of a real Leaflet map, drawn onto a canvas

For the editor:

* A 1080 px editor map scaled down with CSS
* A small live map whose view is replayed at export size

For the coats of arms:

* Load them from Wikimedia
* Bundle them

## Decision outcome

Chosen options: a canvas built from an off-screen map, and an editor that is a scaled replica of it.

### Capture

* A hidden map, 1080 px wide and positioned off screen, loads the tiles at export size.
* Tiles are drawn onto a canvas with their scale transforms, then the pins, the labels, the header
  and footer, and the QR code.
* Only the capture's tile layers use `crossOrigin: 'anonymous'`. Without it the canvas is tainted and
  can't be exported. The normal map doesn't need it.
* The 26 coats of arms are bundled in `public/wappen/`. Wikimedia answers with a redirect that lacks
  CORS headers, so remote images taint the canvas too.
* The GeoJSON poster was rejected: the file has no polygon for Basel-Stadt, and canton rendering
  would have been built from scratch.

### Editor and layout

* The editor is a small live map. Downloading re-captures at the same centre and zoom.
* One layout module (`posterLayout`, `computeChromeLayout`, `posterLabels`) drives both the preview
  and the export, so they can't drift apart.
* A CSS-scaled 1080 px editor map was rejected because pointer events landed offset from the cursor.
* The width stays 1080 px in every format, and only the height changes. The layout constants are
  anchored to the width.
* Zoom is fractional: 0.25 steps in the editor, and `zoomSnap: 0` in the capture map. Whole zoom
  levels were too coarse to frame a canton well.
* The default framing fits the canton's venues, capped at zoom 14.
* Tile attribution is always drawn, even when the footer is switched off.
* Editor settings aren't saved between sessions.

### Consequences

* Good, because the poster looks exactly like the app's map, and the preview is what gets exported.
* Bad, because export depends on the tile servers sending CORS headers.
* The QR code is built from the current location. A poster generated on a deploy preview points at
  that preview.
* Two of the original non-goals have since shipped without a separate design: a landscape format
  besides the square one, and venue names next to the pins (on by default).

## More information

* `src/features/venues/cantonPoster.ts`, `posterCanvas.ts`, `posterLayout.ts`, `PosterEditorModal.tsx`,
  `usePosterQr.ts`, `src/features/map/tileLayers.ts`
* Issue [#69](https://github.com/hoferan/schwingkeller/issues/69) moves posters from cantons to
  Verbände.
