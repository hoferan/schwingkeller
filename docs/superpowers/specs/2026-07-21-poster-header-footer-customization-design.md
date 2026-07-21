# Canton Poster — Header/Footer Customization — Design

**Status:** Approved (brainstorming)
**Date:** 2026-07-21
**Builds on:** [2026-07-20-canton-poster-image-design.md](2026-07-20-canton-poster-image-design.md), [2026-07-20-canton-poster-editor-design.md](2026-07-20-canton-poster-editor-design.md)
**Coordinates with:** [2026-07-21-poster-default-framing-design.md](2026-07-21-poster-default-framing-design.md) (sub-project A), [2026-07-21-poster-aspect-ratio-design.md](2026-07-21-poster-aspect-ratio-design.md) (sub-project B) — see "Interaction with sub-projects A & B" below.

## Context

Admin feedback on the canton poster/image export feature, sub-project C
of a 4-part decomposition (A. framing + legibility, B. aspect ratio,
C. header/footer customization, D. canton borders — each gets its own
spec):

- "more customizable header/footer => i.e. no background, position,
  small/light version, etc."

Today the header (Wappen + title + venue-count pill) is a fixed
full-width dark translucent band always at the top; the footer (app
name + tile attribution) is a fixed full-width dark translucent band
always at the bottom. Both are only togglable on/off — no styling exists
beyond that. When the footer is off, a minimal always-visible
attribution-only strip still renders at the bottom (legally required by
the tile providers).

## Goal

Give the admin four independent customization axes, each defaulting to
today's exact look so nothing changes unless the admin opts in:

1. **Position** — header and footer each independently choose top or
   bottom.
2. **Style** — Solid (today) / Transparent / Light, shared by both
   bands.
3. **Size** — Normal (today) / Compact, shared by both bands.
4. **QR corner** — any of the four corners.

## Design

### Data model

New types in `src/features/venues/posterLayout.ts`:

```ts
export type ChromePosition = 'top' | 'bottom';
export type ChromeStyle = 'solid' | 'transparent' | 'light';
export type ChromeSize = 'normal' | 'compact';
export type QrCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
```

Defaults: `headerPosition: 'top'`, `footerPosition: 'bottom'`,
`chromeStyle: 'solid'`, `chromeSize: 'normal'`, `qrCorner: 'bottom-right'`
— together these reproduce the current PNG output exactly.

### Position & stacking

Header and footer each independently pick `'top'` or `'bottom'`. When
both land on the same edge, they **stack** (no overlap) rather than
being mutually exclusive — the admin can freely put both bands anywhere.
Stacking order is deterministic and applies identically in both the
canvas export and the DOM preview: **header always stacks closer to its
assigned edge; footer stacks adjacent to it** when they share an edge.

A new function computes each visible band's y-offset and, per edge, the
*total* height occupied by all bands on that edge:

```ts
export interface ChromeLayoutResult {
  headerY: number | null;   // null when showHeader is false
  footerY: number | null;   // null when showFooter is false
  topOccupied: number;      // total height of all visible bands on the top edge
  bottomOccupied: number;   // total height of all visible bands on the bottom edge
}

export const computeChromeLayout = (opts: {
  showHeader: boolean; showFooter: boolean;
  headerPosition: ChromePosition; footerPosition: ChromePosition;
  chromeSize: ChromeSize; posterHeight: number;
}): ChromeLayoutResult
```

This lives in `posterCanvas.ts` (alongside `drawPosterOverlay`, which it
feeds) and is imported unchanged into `PosterEditorModal.tsx` for the DOM
preview, preserving the existing "preview is a scaled replica of the
export" invariant.

### Style presets (shared by both bands)

| Style | Fill | Text |
|---|---|---|
| Solid (default) | `rgba(17,17,17,0.72)` | light (`theme.color.bg`) |
| Transparent | none | light, with a drop-shadow for legibility over arbitrary map colors (canvas: `shadowColor`/`shadowBlur`/`shadowOffsetY`; DOM preview: CSS `text-shadow` with equivalent values) |
| Light | `rgba(255,255,255,0.85)` | dark (`theme.color.ink`) |

The venue-count pill's own colors (accent red background, white text)
are unaffected by the chosen band style — they read clearly against all
three.

### Size ("Compact")

A single scale factor (`COMPACT_SCALE = 0.62`, chosen to keep text
legible while meaningfully shrinking the band) applied to the
chrome-only subset of `POSTER_LAYOUT` — header/footer height, Wappen
size, fonts, pill size, QR size, and the relevant padding/margins — via
a new helper:

```ts
export const chromeLayoutFor = (size: ChromeSize): ChromeLayoutConstants
```

`chromeLayoutFor('normal')` returns the existing `POSTER_LAYOUT` values
unchanged (so `POSTER_LAYOUT.headerH`/`.footerH` keep meaning exactly
what they mean today — important for sub-project A's coordination, see
below). `chromeLayoutFor('compact')` returns the same shape scaled by
`COMPACT_SCALE`. Venue-pin geometry (`pinRadius`, `pinRing`,
`pinDotRatio`) is explicitly **excluded** from this scaling — pins never
shrink with "Compact," only branding chrome does.

### QR corner & attribution fallback

The QR toggle gains a 4-corner picker. Horizontal anchor is simple
(`qrMargin` from the left or right edge per the chosen corner). Vertical
clearance uses `computeChromeLayout(...)`'s `topOccupied`/`bottomOccupied`
for whichever edge the QR's corner is on — the QR insets past that
combined band height plus `qrMargin`; if nothing occupies that edge, it
sits `qrMargin` from the map edge itself.

The **minimal attribution strip** (shown when the footer is toggled off,
carrying the legally-required tile-provider credit) is left **exactly as
it is today**: always a small solid-dark strip at the bottom, unaffected
by `footerPosition`/`chromeStyle`/`chromeSize`. This is a deliberate
simplification — hiding the footer's *content* must never also relocate
the legally-required attribution somewhere unexpected. QR clearance
additionally accounts for this strip's height whenever the footer is
off and the strip is what's actually occupying the bottom edge.

### Left unchanged

`drawTiles`, `drawPin`, `extractTileDraws` — orientation/layout-agnostic,
as already established in sub-project B's spec.

## Non-goals

- Per-band independent style or size (both explicitly chosen to be
  shared controls during brainstorming, for visual consistency and a
  simpler control set).
- Corner-badge layouts for header/footer themselves (only the QR code
  gets corner placement; header/footer remain full-width bands, just
  relocatable to either edge).
- Custom colors/fonts beyond the three style presets — YAGNI without a
  concrete request for it.
- Persisting a chosen combination as a reusable preset across sessions —
  editor state stays ephemeral, matching the existing poster-editor
  design's non-goals.

## Interaction with sub-projects A & B

- **Sub-project A** (`2026-07-21-poster-default-framing-design.md`)
  computes chrome-aware padding from `PL.headerH`/`PL.footerH` under the
  assumption that header is always top and footer is always bottom. Once
  C lands, that padding math must switch to reading
  `computeChromeLayout(...)`'s `topOccupied`/`bottomOccupied` instead of
  the fixed per-band constants. This is a required follow-up in whichever
  of A or C is implemented **second** — not a conflict in either design,
  just an integration step.
- **Sub-project B** (aspect ratio) fixed chrome bands at a constant pixel
  height regardless of aspect ratio (square vs. portrait) — an axis
  orthogonal to C's Compact size (an explicit admin choice, not
  ratio-driven). No contradiction, but both B and C touch
  `POSTER_LAYOUT`-derived sizing, so whichever lands second will need an
  ordinary merge against the first's changes to `PosterEditorModal.tsx`
  and `posterCanvas.ts`.

## Testing (TDD)

- `posterLayout.test.ts`: `chromeLayoutFor('normal')` matches today's
  `POSTER_LAYOUT` chrome values exactly; `chromeLayoutFor('compact')`
  returns each value scaled by `COMPACT_SCALE`; pin geometry
  (`pinRadius`/`pinRing`/`pinDotRatio`) is identical in both.
- `posterCanvas.test.ts`:
  - `computeChromeLayout(...)` for all position/visibility combinations,
    including both bands sharing the top edge and both sharing the
    bottom edge (stacking order: header closer to the edge).
  - `drawPosterOverlay` renders each style preset's fill/text
    combination correctly, including the no-fill + shadow path for
    Transparent.
  - QR position is correct for each of the 4 corners, clearing whichever
    band(s) (or the minimal attribution strip) share its edge.
  - The minimal attribution strip renders unchanged regardless of
    `footerPosition`/`chromeStyle`/`chromeSize` when `showFooter` is
    false.
- `PosterEditorModal.test.tsx`: new position/style/size/QR-corner
  controls render and update state; the DOM preview's computed chrome
  layout matches `computeChromeLayout(...)`'s output for a representative
  non-default combination (e.g. Compact + Transparent + footer moved to
  top).

## Verification before shipping

Run the dev server, log in as admin, open the poster editor for a canton
with venues and: (1) confirm the all-default combination produces an
export pixel-identical in layout to today's; (2) set both header and
footer to the same edge and confirm they stack without overlapping;
(3) cycle through all three styles and confirm Transparent text stays
legible over both map and satellite base layers; (4) switch to Compact
and confirm the band/text/QR shrink together sensibly; (5) cycle the QR
through all 4 corners, including a combination where a band shares its
edge, and confirm no overlap.

## Summary of changes

- `posterLayout.ts`: new `ChromePosition`/`ChromeStyle`/`ChromeSize`/
  `QrCorner` types, `chromeLayoutFor()`, `COMPACT_SCALE`.
- `posterCanvas.ts`: new `computeChromeLayout()`; `drawPosterOverlay`
  extended to take position/style/size/QR-corner options and render
  accordingly (fill-or-shadow per style, band offsets from
  `computeChromeLayout`, QR clearance per corner); minimal attribution
  strip logic unchanged.
- `cantonPoster.ts`: `GeneratePosterOptions` gains the new chrome fields,
  forwarded to `drawPosterOverlay`.
- `PosterEditorModal.tsx`: new controls for position (×2), style, size,
  and QR corner; DOM preview chrome repositioned/restyled via the same
  `computeChromeLayout()` used by the canvas.
- Test coverage added/extended in `posterLayout.test.ts`,
  `posterCanvas.test.ts`, `cantonPoster.test.ts`,
  `PosterEditorModal.test.tsx`.

## Revisions after admin smoke test (2026-07-21)

Five findings from the first smoke test changed the design as follows:

1. **Dependent controls disable** — the header/footer position pickers and the QR corner picker
   are disabled (grayed, non-interactive) while their element's toggle is off.
2. **Stacking order** — the footer now always reads *below* the header: on a shared top edge the
   header takes the edge (unchanged), on a shared bottom edge the footer takes the edge and the
   header stacks above it (reversed from the original "header always closer to the edge" rule).
3. **QR corner control** — the four-button segmented control was replaced by a 2×2 corner-grid
   picker: a miniature poster outline with one dot button per corner.
4. **Transparent style** — uses dark ink text with a *light* halo shadow (light text with a dark
   shadow was unreadable over bright basemaps).
5. **Compact size** — no longer scales content. Fonts, pill, Wappen, and QR keep their normal
   size; only the band heights shrink (header 190 → 120, footer 46 → 34) and the count pill moves
   inline next to the canton name. `COMPACT_SCALE` was removed in favor of explicit compact
   constants in `chromeLayoutFor`.

## Addendum: soft zoom (2026-07-21, same PR)

Admin feedback: whole-level zoom steps were too coarse to frame the poster precisely. Shipped in
the same PR:

- The editor map zooms in quarter steps (`zoomSnap`/`zoomDelta` 0.25, gentler wheel ratio), plus
  a precise +/- zoom control in the map-settings row.
- The export forwards the exact (possibly fractional) preview zoom — the former `Math.round`
  integer defense is gone. The off-screen capture map runs with `zoomSnap: 0`, and
  `extractTileDraws` composes each tile container's `translate3d(...) scale(...)` transform into
  the canvas draws, so fractional-zoom captures frame exactly what the preview shows.
- Trade-off: at fractional zooms, tiles are upscaled from the nearest whole zoom level (up to
  ~41%), exactly matching what the admin sees live in the preview. Integer-zoom exports are
  unchanged.
