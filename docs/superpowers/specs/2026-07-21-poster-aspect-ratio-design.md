# Canton Poster — Aspect Ratio (Square / Portrait) — Design

**Status:** Approved (brainstorming)
**Date:** 2026-07-21
**Builds on:** [2026-07-20-canton-poster-image-design.md](2026-07-20-canton-poster-image-design.md), [2026-07-20-canton-poster-editor-design.md](2026-07-20-canton-poster-editor-design.md)
**Coordinates with:** [2026-07-21-poster-default-framing-design.md](2026-07-21-poster-default-framing-design.md) (sub-project A — see "Interaction with sub-project A" below)

## Context

Admin feedback on the canton poster/image export feature, sub-project B of
a 4-part decomposition (A. framing + legibility, B. aspect ratio,
C. header/footer customization, D. canton borders — each gets its own
spec):

- "export 1:1 or 2:3 (portrait)"

The original poster-editor spec explicitly listed "aspect-ratio options
(fixed 1080²)" as an out-of-scope non-goal at the time. This spec
reverses that decision.

## Goal

Let the admin choose between the current 1:1 square export and a new 2:3
portrait export, selected in the poster editor before download. Square
stays the default so existing behavior is unchanged unless the admin
opts in.

## Design

### Sizing decision

Width stays fixed at `POSTER_SIZE` (1080px) in **both** modes; only the
canvas height changes: 1080px for square (1:1), 1620px for portrait
(1080:1620 = 2:3). This was chosen over shrinking the width to hold the
total pixel area constant, because it means every existing
width-anchored `POSTER_LAYOUT` constant (`padX`, `wappenX`, `titleFont`,
`qrSize`, `qrMargin`, header/footer band heights, etc.) needs **no
changes at all** — portrait is simply a taller canvas with more map real
estate, not a rescaled layout. The header/footer chrome bands also stay
at their current fixed pixel heights (190px / 46px) in both modes, per
the same reasoning, rather than scaling up with the taller canvas.

`POSTER_SIZE` keeps its current name and meaning ("width, and height when
square") rather than being renamed to `POSTER_WIDTH` — a rename would
touch every file that already reads `POSTER_SIZE`, including code
snippets in sub-project A's already-written (not yet implemented) plan,
invalidating it regardless of which sub-project lands first. Keeping the
name avoids that coupling.

### New in `src/features/venues/posterLayout.ts`

```ts
export type PosterAspectRatio = 'square' | 'portrait';

export const posterHeightFor = (ratio: PosterAspectRatio): number =>
  ratio === 'portrait' ? POSTER_SIZE * 1.5 : POSTER_SIZE; // 1620 : 1080 — exactly 2:3
```

### `src/features/venues/posterCanvas.ts`

- `createOffscreenContainer` changes from a single `size` parameter to
  explicit `width, height` parameters, setting the off-screen `<div>`'s
  CSS width/height independently.
- `PosterOverlayOptions` (consumed by `drawPosterOverlay`) gains a
  required `posterHeight: number` field. The three places
  `drawPosterOverlay` currently uses `POSTER_SIZE` for a *vertical*
  measurement switch to `posterHeight`:
  - the footer band's `fillRect` y-position (`POSTER_SIZE - L.footerH` → `posterHeight - L.footerH`),
  - the QR code's y-position (`POSTER_SIZE - L.qrSize - L.qrMargin - L.footerH` → `posterHeight - L.qrSize - L.qrMargin - L.footerH`),
  - the minimal-attribution-strip's y-position and text baseline (`POSTER_SIZE - L.minAttribStripH` → `posterHeight - L.minAttribStripH`).
  Every other use of `POSTER_SIZE` in `drawPosterOverlay` (header band
  width, title/pill x-positions, etc.) is a width measurement and stays
  as `POSTER_SIZE` unchanged.
- `drawTiles`, `drawPin`, `extractTileDraws` are **left unchanged** —
  they operate on Leaflet's own container-relative pixel coordinates
  (tile `translate3d` offsets, `latLngToContainerPoint`), which are
  already orientation-agnostic regardless of container shape.

### `src/features/venues/cantonPoster.ts`

- `GeneratePosterOptions` gains `aspectRatio: PosterAspectRatio`.
- `generateCantonPosterBlob` computes `const posterHeight = posterHeightFor(aspectRatio);`,
  calls `createOffscreenContainer(POSTER_SIZE, posterHeight)`, sets
  `canvas.width = POSTER_SIZE; canvas.height = posterHeight;`, and passes
  `posterHeight` through to `drawPosterOverlay`.

### `src/features/venues/PosterEditorModal.tsx`

- New state: `const [aspectRatio, setAspectRatio] = useState<PosterAspectRatio>('square');`.
- New segmented toggle (same visual pattern as the existing Map/Satellite
  base-layer toggle) for Square / Portrait.
- The preview square's container changes from a fixed
  `width: previewSize, height: previewSize` to
  `width: previewSize, height: previewSize * (posterHeightFor(aspectRatio) / POSTER_SIZE)`.
- Switching the toggle **only resizes the container** — it does not
  re-fit or re-center the map. A `useEffect` keyed on `aspectRatio`
  calls `mapRef.current?.invalidateSize()` (required by Leaflet after
  any container resize, to keep its internal size cache correct); the
  admin can click "Reset framing" separately if the new shape needs a
  different view.
- The DOM chrome overlay (header/footer/QR) needs **no style changes**:
  its `cqw()`-based sizes resolve against the container's *width*, which
  never changes between modes, and the footer/QR are already positioned
  via `bottom:`-relative offsets that remain correct regardless of
  container height.
- `download()` forwards the current `aspectRatio` to
  `generateCantonPosterBlob`.

## Non-goals

- Additional ratios beyond square and 2:3 portrait (e.g. landscape,
  9:16 Story) — only what was requested.
- Encoding the aspect ratio in the downloaded filename — stays
  `schwingkeller-<code>.png` in both modes; it's a one-off admin
  download, not worth the added naming complexity.
- Framing/zoom behavior (sub-project A) and header/footer
  customization (sub-project C) — unrelated to aspect ratio, though see
  the coordination note below for A.

## Interaction with sub-project A

Both this spec and sub-project A's
(`2026-07-21-poster-default-framing-design.md`) modify
`PosterEditorModal.tsx`'s mount effect and `resetFraming()`. Neither
spec depends on the other being implemented first, but whichever lands
**second** will need to merge its changes against the first's — an
ordinary rebase/merge concern at implementation time, not a conflict in
the designs themselves. Once both are implemented, A's venue-fit padding
math should read the currently-selected `aspectRatio`'s height (via
`posterHeightFor`) rather than assuming a square viewport, but that
wiring is deferred to whichever implementation plan runs second.

## Testing (TDD)

- `posterLayout.test.ts`: `posterHeightFor('square')` returns `1080`;
  `posterHeightFor('portrait')` returns `1620`.
- `posterCanvas.test.ts`: `createOffscreenContainer(w, h)` sets width and
  height independently; `drawPosterOverlay` positions the footer band,
  QR code, and minimal-attribution strip relative to the passed
  `posterHeight` (tested for both a square and a portrait height, not
  just the default).
- `cantonPoster.test.ts`: the generated canvas's `width`/`height` come
  from `POSTER_SIZE`/`posterHeightFor(aspectRatio)` for both
  `aspectRatio` values.
- `PosterEditorModal.test.tsx`: the toggle renders and updates
  `aspectRatio` state; the preview container's height changes
  accordingly; `invalidateSize()` is called on toggle without any
  `setView`/`fitBounds` call (center/zoom untouched); `download()`
  forwards the current `aspectRatio` into `generateCantonPosterBlob`.

## Verification before shipping

Run the dev server, log in as admin, open the poster editor for a canton
with several venues, generate a poster in Square mode (confirm identical
output to today), switch to Portrait, confirm the preview reshapes with
the chrome staying correctly positioned top/bottom, download, and
confirm the PNG is exactly 1080×1620 with the footer/QR/attribution
correctly anchored to the bottom edge (not floating mid-canvas).

## Summary of changes

- `posterLayout.ts`: new `PosterAspectRatio` type and `posterHeightFor()`
  helper.
- `posterCanvas.ts`: `createOffscreenContainer` takes explicit
  width/height; `drawPosterOverlay` takes `posterHeight` and uses it for
  vertical (bottom-anchored) measurements.
- `cantonPoster.ts`: `GeneratePosterOptions` gains `aspectRatio`; canvas
  and off-screen container sized from `POSTER_SIZE` ×
  `posterHeightFor(aspectRatio)`.
- `PosterEditorModal.tsx`: new `aspectRatio` state, Square/Portrait
  toggle, height-adjusted preview container, `invalidateSize()` on
  toggle, `aspectRatio` forwarded to `generateCantonPosterBlob`.
- Test coverage added/extended in `posterLayout.test.ts`,
  `posterCanvas.test.ts`, `cantonPoster.test.ts`,
  `PosterEditorModal.test.tsx`.
