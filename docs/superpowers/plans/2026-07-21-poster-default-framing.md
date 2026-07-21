# Canton Poster — Default Framing & Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canton poster editor's default framing fit the canton's venues (not its full outline), so exported posters open already zoomed to the relevant area with readable place-name labels, while staying sensible for cantons with 0, 1, or tightly-clustered venues.

**Architecture:** A new pure-function module (`posterFraming.ts`) computes a Leaflet bounds object from a canton's venues. `PosterEditorModal.tsx` gains a local `applyDefaultFraming()` helper — shared by the mount effect and the "Reset framing" button — that branches on venue count (0 / 1 / 2+), applies chrome-aware padding, and clamps zoom for tight clusters.

**Tech Stack:** TypeScript, React 19, Leaflet, Vitest + React Testing Library.

## Global Constraints

- No `any` — use proper types or `unknown` (CLAUDE.md).
- No new npm dependencies (CLAUDE.md) — this plan uses only `leaflet`, already a dependency.
- TDD: write the failing test first, then the implementation (CLAUDE.md, test-driven-development skill).
- `npm run test` and `npm run lint` must pass before the work is considered complete (CLAUDE.md).
- No new UI copy is introduced, so no i18n keys are needed for this plan.
- Design source of truth: `docs/superpowers/specs/2026-07-21-poster-default-framing-design.md`.

---

### Task 1: `posterFraming.ts` — venue-bounds helper

**Files:**
- Create: `src/features/venues/posterFraming.ts`
- Test: `src/features/venues/posterFraming.test.ts`

**Interfaces:**
- Consumes: `Venue` type from `src/features/venues/types.ts` (`{ id, name, canton, address, lat, lng, indoor, outdoor, person, phone, website, photos }`); `L.latLngBounds` from the real `leaflet` package (no mocking needed — pure geometry, no DOM).
- Produces: `CANTON_POSTER_MAX_DEFAULT_ZOOM: number` (constant, value `14`); `venueBoundsForCanton(code: string, venues: Venue[]): L.LatLngBounds | null` — filters `venues` to those with `canton === code`, returns `null` for zero matches, otherwise an `L.LatLngBounds` covering all matches. Task 2 imports both.

- [ ] **Step 1: Write the failing tests**

Create `src/features/venues/posterFraming.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { venueBoundsForCanton, CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';
import type { Venue } from './types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], ...over,
});

describe('CANTON_POSTER_MAX_DEFAULT_ZOOM', () => {
  it('is a town/neighborhood-level zoom', () => {
    expect(CANTON_POSTER_MAX_DEFAULT_ZOOM).toBe(14);
  });
});

describe('venueBoundsForCanton', () => {
  it('returns null when no venues match the canton', () => {
    const venues = [v({ id: '1', canton: 'LU' })];
    expect(venueBoundsForCanton('BE', venues)).toBeNull();
  });

  it('returns bounds covering only the matching canton\'s venues', () => {
    const venues = [
      v({ id: '1', canton: 'BE', lat: 46.9, lng: 7.4 }),
      v({ id: '2', canton: 'BE', lat: 46.95, lng: 7.45 }),
      v({ id: '3', canton: 'LU', lat: 47.05, lng: 8.3 }),
    ];
    const bounds = venueBoundsForCanton('BE', venues);
    expect(bounds).not.toBeNull();
    expect(bounds!.getSouthWest()).toEqual(expect.objectContaining({ lat: 46.9, lng: 7.4 }));
    expect(bounds!.getNorthEast()).toEqual(expect.objectContaining({ lat: 46.95, lng: 7.45 }));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/posterFraming.test.ts`
Expected: FAIL — `Cannot find module './posterFraming'` (the module doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/features/venues/posterFraming.ts`:

```ts
import L from 'leaflet';
import type { Venue } from './types';

// Town/neighborhood-level zoom cap for the poster editor's default venue-fit framing — keeps a
// single venue or a tight cluster from zooming in so far that surrounding context disappears.
export const CANTON_POSTER_MAX_DEFAULT_ZOOM = 14;

export const venueBoundsForCanton = (code: string, venues: Venue[]): L.LatLngBounds | null => {
  const cantonVenues = venues.filter((v) => v.canton === code);
  if (cantonVenues.length === 0) return null;
  return L.latLngBounds(cantonVenues.map((v): [number, number] => [v.lat, v.lng]));
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/posterFraming.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterFraming.ts src/features/venues/posterFraming.test.ts
git commit -m "feat: add venue-bounds helper for canton poster default framing"
```

---

### Task 2: Wire venue-fit framing into `PosterEditorModal`

**Files:**
- Modify: `src/features/venues/PosterEditorModal.tsx`
- Test: `src/features/venues/PosterEditorModal.test.tsx`

**Interfaces:**
- Consumes: `venueBoundsForCanton`, `CANTON_POSTER_MAX_DEFAULT_ZOOM` from `./posterFraming` (Task 1); `boundsForCanton` from `../../data/cantonBounds` (already imported in this file); `POSTER_SIZE`, `POSTER_LAYOUT as PL` from `./posterLayout` (already imported); `Venue` from `./types` (already imported).
- Produces: nothing new consumed elsewhere — `applyDefaultFraming` is a module-local (non-exported) helper used only by this component's mount effect and `resetFraming()`.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/PosterEditorModal.test.tsx`, make three changes:

**1a.** Add `setZoom` to the hoisted `fakeMap` mock and `latLngBounds` to the `leaflet` mock (needed because `venueBoundsForCanton` calls the real `L.latLngBounds`, which the existing `vi.mock('leaflet', ...)` in this file replaces):

```ts
const { fakeMap } = vi.hoisted(() => ({
  fakeMap: {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getCenter: vi.fn().mockReturnValue({ lat: 46.9, lng: 7.4 }),
    getZoom: vi.fn().mockReturnValue(11),
    setZoom: vi.fn(),
    setMaxZoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  },
}));
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => fakeMap),
    marker: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn(() => ({})),
    layerGroup: vi.fn(() => ({ addTo: vi.fn(), clearLayers: vi.fn(), addLayer: vi.fn() })),
    // The live editor map builds its base layer via createTileLayer() (features/map/tileLayers.ts),
    // which calls L.tileLayer(...).addTo(map) — stub it so that real wiring doesn't throw. We don't
    // assert anything about tile behavior here, only that the editor renders/downloads correctly.
    tileLayer: vi.fn(() => ({ addTo: vi.fn(), once: vi.fn() })),
    // venueBoundsForCanton (posterFraming.ts, real/unmocked) calls L.latLngBounds — stub it so the
    // default-framing helper can run inside these tests. Bounds identity round-trips through the
    // points passed in, which is all the assertions below need.
    latLngBounds: vi.fn((points: [number, number][]) => ({ points })),
  },
}));
```

**1b.** Add two imports near the top of the file (after the existing `import type { Venue } from './types';` line is fine, or grouped with other same-folder imports):

```ts
import { boundsForCanton } from '../../data/cantonBounds';
import { CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';
```

**1c.** Add a new `describe('default framing', ...)` block after the existing `describe('PosterEditorModal', ...)` block closes (i.e., at the end of the file):

```tsx
describe('default framing', () => {
  beforeEach(() => { generateCantonPosterBlob.mockClear(); });

  it('frames the map with setView (not fitBounds) when the canton has exactly one venue', () => {
    renderEditor(); // default: 1 venue at (46.9, 7.4)
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], CANTON_POSTER_MAX_DEFAULT_ZOOM);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('falls back to the canton bounds fit when there are no venues', () => {
    renderEditor({ venues: [] });
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(boundsForCanton('BE'), { padding: [20, 20] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });

  it('fits to venue bounds with chrome-aware padding when there are 2+ venues', () => {
    const venues2 = [
      v({ id: '1', lat: 46.9, lng: 7.4 }),
      v({ id: '2', lat: 46.95, lng: 7.45 }),
    ];
    renderEditor({ venues: venues2 });

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, options] = fakeMap.fitBounds.mock.calls[0];
    expect(bounds).toEqual({ points: [[46.9, 7.4], [46.95, 7.45]] });
    // jsdom's window is 1024px wide, so previewSize locks to 540 (see previewSizeFor); scale =
    // 540/1080 = 0.5, so headerH(190)*0.5=95 and footerH(46)*0.5=23, each plus the base 20px pad.
    expect(options).toEqual({
      paddingTopLeft: [20, 115],
      paddingBottomRight: [20, 43],
    });
    expect(fakeMap.setView).not.toHaveBeenCalled();
    expect(fakeMap.setZoom).not.toHaveBeenCalled(); // default mocked getZoom() (11) is under the cap
  });

  it('reset framing re-applies the same three-way logic as the initial mount', async () => {
    const user = userEvent.setup();
    renderEditor(); // default: 1 venue at (46.9, 7.4)
    expect(fakeMap.setView).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: STR.de.posterResetFraming }));

    expect(fakeMap.setView).toHaveBeenCalledTimes(2);
    expect(fakeMap.setView).toHaveBeenLastCalledWith([46.9, 7.4], CANTON_POSTER_MAX_DEFAULT_ZOOM);
  });

  it('caps the zoom after fitBounds overshoots for tightly clustered venues', () => {
    const venues2 = [
      v({ id: '1', lat: 46.9, lng: 7.4 }),
      v({ id: '2', lat: 46.9001, lng: 7.4001 }),
    ];
    fakeMap.getZoom.mockReturnValueOnce(16); // fitBounds would zoom in past the cap for this tight cluster
    renderEditor({ venues: venues2 });

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.setZoom).toHaveBeenCalledWith(CANTON_POSTER_MAX_DEFAULT_ZOOM);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: FAIL — the new `describe('default framing', ...)` tests fail because the component still unconditionally calls `fitBounds(boundsForCanton(code), { padding: [20, 20] })` (e.g. the 1-venue test fails because `setView` was never called; the 2+ venue test fails because `fitBounds` was called with `boundsForCanton('BE')` instead of the venue-bounds mock object).

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/PosterEditorModal.tsx`:

**3a.** Add the import (next to the existing `import { generateCantonPosterBlob } from './cantonPoster';` line):

```ts
import { generateCantonPosterBlob } from './cantonPoster';
import { venueBoundsForCanton, CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';
```

**3b.** Insert the new helper just above the component, right after the existing `previewSizeFor` function:

```ts
const previewSizeFor = (w: number): number => (w >= 700 ? 540 : 270);

const DEFAULT_FIT_PADDING = 20; // px, matches the flat padding the canton-bounds fallback has always used

// Default framing for the live editor map: fit tightly to the canton's own venues (not the whole
// canton outline) so exported labels aren't shrunk by empty terrain, while keeping a sensible view
// for cantons with very few or tightly-clustered venues. Shared by the mount effect and the "Reset
// framing" button so both apply identical logic.
const applyDefaultFraming = (
  map: L.Map,
  code: string,
  venues: Venue[],
  previewSize: number,
  showHeader: boolean,
  showFooter: boolean,
): void => {
  const cantonVenues = venues.filter((v) => v.canton === code);

  if (cantonVenues.length === 0) {
    const bounds = boundsForCanton(code);
    if (bounds) map.fitBounds(bounds, { padding: [DEFAULT_FIT_PADDING, DEFAULT_FIT_PADDING] });
    return;
  }

  if (cantonVenues.length === 1) {
    const [only] = cantonVenues;
    map.setView([only.lat, only.lng], CANTON_POSTER_MAX_DEFAULT_ZOOM);
    return;
  }

  const venueBounds = venueBoundsForCanton(code, venues);
  if (!venueBounds) return;
  const scale = previewSize / POSTER_SIZE;
  const topPad = DEFAULT_FIT_PADDING + (showHeader ? PL.headerH * scale : 0);
  const bottomPad = DEFAULT_FIT_PADDING + (showFooter ? PL.footerH * scale : 0);
  map.fitBounds(venueBounds, {
    paddingTopLeft: [DEFAULT_FIT_PADDING, topPad],
    paddingBottomRight: [DEFAULT_FIT_PADDING, bottomPad],
  });
  if (map.getZoom() > CANTON_POSTER_MAX_DEFAULT_ZOOM) {
    map.setZoom(CANTON_POSTER_MAX_DEFAULT_ZOOM);
  }
};

export const PosterEditorModal = ({
```

**3c.** In the mount effect, replace:

```ts
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const bounds = boundsForCanton(code);
    // zoomControl:false — the header/footer chrome span the full width top and bottom, so any
    // on-map corner control would collide with them. Zoom lives in the controls panel instead
    // (the map still zooms via scroll/pinch).
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: false, maxZoom: maxPreviewZoom(baseKind) });
    mapRef.current = map;
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
```

with:

```ts
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    // zoomControl:false — the header/footer chrome span the full width top and bottom, so any
    // on-map corner control would collide with them. Zoom lives in the controls panel instead
    // (the map still zooms via scroll/pinch).
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: false, maxZoom: maxPreviewZoom(baseKind) });
    mapRef.current = map;
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
    applyDefaultFraming(map, code, venues, previewSize, showHeader, showFooter);
```

**3d.** Replace `resetFraming`:

```ts
  const resetFraming = () => {
    const map = mapRef.current;
    const bounds = boundsForCanton(code);
    if (map && bounds) map.fitBounds(bounds, { padding: [20, 20] });
  };
```

with:

```ts
  const resetFraming = () => {
    const map = mapRef.current;
    if (!map) return;
    applyDefaultFraming(map, code, venues, previewSize, showHeader, showFooter);
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: PASS (all tests, including the 4 pre-existing ones and the 5 new `describe('default framing', ...)` tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/PosterEditorModal.tsx src/features/venues/PosterEditorModal.test.tsx
git commit -m "feat: default canton poster framing to venue bounds instead of canton outline"
```

---

### Task 3: Full verification and manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including `posterFraming.test.ts`, the updated `PosterEditorModal.test.tsx`, and every other existing suite (unaffected by this change).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors (in particular: no unused-import errors from the `boundsForCanton`/`Venue`/`POSTER_SIZE`/`PL` imports in `PosterEditorModal.tsx`, all of which remain used by `applyDefaultFraming`).

- [ ] **Step 3: Run the type checker**

Run: `npm run typecheck`
Expected: no errors (in particular: `applyDefaultFraming`'s `L.Map` / `Venue[]` parameter types and the `L.LatLngBounds | null` return of `venueBoundsForCanton` type-check cleanly against Leaflet's own types).

- [ ] **Step 4: Manual verification in the dev server**

Run: `npm run dev`, open the app, log in as admin, and open the poster editor (per `docs/superpowers/specs/2026-07-21-poster-default-framing-design.md`'s "Verification before shipping" section) for:
- a canton with 0 venues — confirm it opens fit to the canton outline (unchanged behavior),
- a canton with exactly 1 venue — confirm it opens centered on that venue at a town/neighborhood zoom, not zoomed to street level,
- a canton with 2+ spread-out venues — confirm it opens tightly framed around them with visibly larger place-name labels than before, and no venue pin sits under the header or footer band,
- a canton with 2+ tightly-clustered venues (same town) — confirm it does not zoom in past a reasonable town-level view.

For the 2+ cases, click "Reset framing" after manually panning/zooming and confirm it snaps back to the same default view.

- [ ] **Step 5: Commit any fixups found during manual verification**

If manual verification surfaces an issue, fix it, re-run Steps 1-3, and commit:

```bash
git add -A
git commit -m "fix: address manual verification findings for poster default framing"
```

If no issues are found, skip this step — Task 2's commit is the final commit for this plan.
