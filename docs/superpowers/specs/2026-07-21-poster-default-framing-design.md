# Canton Poster — Default Framing & Legibility — Design

**Status:** Approved (brainstorming)
**Date:** 2026-07-21
**Builds on:** [2026-07-20-canton-poster-image-design.md](2026-07-20-canton-poster-image-design.md), [2026-07-20-canton-poster-editor-design.md](2026-07-20-canton-poster-editor-design.md)

## Context

Admin feedback on the canton poster/image export feature, part 1 of 4
(sub-project A of a decomposition covering: A. framing + legibility,
B. aspect ratio, C. header/footer customization, D. canton borders — each
gets its own spec):

- "Ortsnamen (place names) are barely readable"
- "The map feels too zoomed out"

## Problem

Today the poster editor's default framing (`PosterEditorModal`'s mount
effect and its "Reset framing" button) fits `boundsForCanton(code)` — the
canton's official geographic outline. For large or oddly-shaped cantons
(Graubünden, Bern) that includes a lot of empty terrain far from any
venue, forcing a zoomed-out default view. Place-name labels are baked
into the OSM/Esri raster tiles themselves (the app does not render this
text) — at a zoomed-out view they shrink to the point of being unreadable
once the poster is exported and viewed at social-media size.

Root cause confirmed during brainstorming: this is a **default-framing**
problem, not a text-rendering or basemap-contrast problem — admins can
already pan/zoom the live editor map manually, but the default view they
land on is too wide.

## Goal

Default framing fits the canton's **venues**, not its outline, so the
poster opens already zoomed to the relevant area with readable labels —
while still looking sensible for cantons with very few or
tightly-clustered venues.

## Design

### New helper: `src/features/venues/posterFraming.ts`

```ts
export const CANTON_POSTER_MAX_DEFAULT_ZOOM = 14; // town/neighborhood level cap

export const venueBoundsForCanton = (code: string, venues: Venue[]): L.LatLngBounds | null
```

Filters `venues` to the given canton; returns `null` when there are 0
matching venues (caller falls back to `boundsForCanton`).

### Applying it in `PosterEditorModal.tsx`

Both the mount effect and `resetFraming()` — the only two places that set
default framing — switch from the unconditional
`map.fitBounds(boundsForCanton(code), { padding: [20, 20] })` to:

- **0 venues:** unchanged fallback — `fitBounds(boundsForCanton(code), { padding: [20, 20] })`.
- **1 venue:** `map.setView([v.lat, v.lng], CANTON_POSTER_MAX_DEFAULT_ZOOM)`
  — a single point has no meaningful bounding box, so `fitBounds` is
  skipped entirely for this case.
- **2+ venues:** `map.fitBounds(venueBounds, { paddingTopLeft, paddingBottomRight })`
  (see padding below); if the resulting `map.getZoom()` exceeds
  `CANTON_POSTER_MAX_DEFAULT_ZOOM` (tightly-clustered venues), follow up
  with `map.setZoom(CANTON_POSTER_MAX_DEFAULT_ZOOM)`, which keeps the
  fitted center.

### Chrome-aware padding

Base padding matches today's flat `20` px, plus:
- extra top padding equal to the header band height (`POSTER_LAYOUT.headerH`) when `showHeader` is true,
- extra bottom padding equal to the footer band height (`POSTER_LAYOUT.footerH`) when `showFooter` is true,

converted from `POSTER_LAYOUT`'s 1080-space constants down to preview
pixels via the existing `previewSize / POSTER_SIZE` scale factor (same
ratio `posterLayout.ts`'s `cqw()`/`previewPin()` already use), so a venue
near the fitted edge doesn't end up hidden under a translucent chrome
band.

This is evaluated using whichever `showHeader`/`showFooter` state is
current **at fit time** (mount, or whenever "Reset framing" is clicked).
Toggling header/footer afterward does not auto-refit — an in-progress
edit shouldn't be yanked around; the admin can hit "Reset framing" to
reapply the fit against the new toggle state.

### Left unchanged

`cantonPoster.ts`'s own `fitBounds(bounds, { padding: [40, 40] })`
fallback (used only when `generateCantonPosterBlob` is called without a
`view`) stays as-is. In the running app, `PosterEditorModal` always
supplies a `view`, so this path is unreachable from the UI today — it
exists only as a defensive default exercised by its own unit tests, and
has no access to preview-size/header-state context to make it worth
coupling to this logic.

## Non-goals

- Basemap contrast/style changes. During brainstorming, "too small at the
  current zoom" was identified as the core legibility problem, not label
  contrast — if contrast turns out to matter later, it belongs in the
  separate "change visual style" sub-project.
- A minimum-zoom clamp for very spread-out venues (e.g. Graubünden venues
  80 km apart). Venue-fit alone already directly addresses the
  "too zoomed out" complaint; adding a floor is speculative without
  evidence it's still a problem after this change.
- Aspect ratio (sub-project B) and header/footer customization
  (sub-project C) are unrelated here. This design's padding math will
  need to read whichever aspect ratio is active once B ships — a
  forward-compat seam, not built now.
- Canton border overlay (sub-project D) — unrelated to framing.

## Testing (TDD)

- `posterFraming.test.ts`: `venueBoundsForCanton` returns `null` for 0
  matching venues; returns correct bounds for 2+ venues; filters
  strictly by canton code (venues from other cantons excluded).
- `PosterEditorModal.test.tsx` (extend existing mocked-map tests):
  - mount calls `setView` (not `fitBounds`) when the canton has exactly 1
    venue, at `CANTON_POSTER_MAX_DEFAULT_ZOOM`;
  - mount calls `fitBounds` with chrome-aware padding for 2+ venues;
  - mount falls back to canton `fitBounds` for 0 venues;
  - `resetFraming()` mirrors the same three-way logic;
  - a tightly-clustered-venues case asserts `setZoom(CANTON_POSTER_MAX_DEFAULT_ZOOM)`
    is called after `fitBounds` overshoots the cap.

## Verification before shipping

Run the dev server, log in as admin, open the poster editor for: a canton
with 0 venues, exactly 1 venue, 2+ spread-out venues, and 2+ tightly
clustered venues (same town). Confirm each opens at a sensible default
zoom, no pin is hidden under the header/footer bands, and "Reset framing"
reproduces the same view.

## Summary of changes

- New `src/features/venues/posterFraming.ts`: `venueBoundsForCanton()` +
  `CANTON_POSTER_MAX_DEFAULT_ZOOM` constant.
- `PosterEditorModal.tsx`: mount effect and `resetFraming()` switch to
  venue-fit framing with chrome-aware padding and a zoom cap, falling
  back to canton-bounds framing when there are no venues.
- New `posterFraming.test.ts`; extended `PosterEditorModal.test.tsx`
  coverage for the three framing branches.
