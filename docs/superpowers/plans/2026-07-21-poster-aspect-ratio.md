# Canton Poster — Aspect Ratio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin choose a 1:1 square or 2:3 portrait export in the canton poster editor, defaulting to square so existing behavior is unchanged unless the admin opts in.

**Architecture:** Width stays fixed at `POSTER_SIZE` (1080) in both modes; only the canvas/container height varies via a new `posterHeightFor(ratio)` helper (1080 for square, 1620 for portrait). This flows through the off-screen capture (`cantonPoster.ts`/`posterCanvas.ts`) and the live editor preview (`PosterEditorModal.tsx`), which gains a Square/Portrait toggle that only resizes the preview container — it never re-fits or re-centers the map.

**Tech Stack:** TypeScript, React 19, Leaflet, Vitest + React Testing Library.

## Global Constraints

- No `any` — use proper types or `unknown` (CLAUDE.md).
- No new npm dependencies (CLAUDE.md) — this plan uses only what's already in the codebase.
- TDD: write the failing test first, then the implementation (CLAUDE.md, test-driven-development skill).
- `npm run test` and `npm run lint` must pass before the work is considered complete (CLAUDE.md).
- Keep i18n keys in sync across DE/FR/IT when touching UI text (CLAUDE.md) — this plan adds 3 new keys (`posterFormatLabel`, `posterFormatSquare`, `posterFormatPortrait`) and must add all three languages together.
- `POSTER_SIZE` keeps its current name/meaning ("width, and height when square") — it is **not** renamed. Sub-project A's already-written plan (`docs/superpowers/plans/2026-07-21-poster-default-framing.md`) references `POSTER_SIZE` directly; a rename would invalidate it regardless of implementation order.
- Design source of truth: `docs/superpowers/specs/2026-07-21-poster-aspect-ratio-design.md`.

---

### Task 1: `posterLayout.ts` — `PosterAspectRatio` type and `posterHeightFor()`

**Files:**
- Modify: `src/features/venues/posterLayout.ts`
- Create: `src/features/venues/posterLayout.test.ts` (no existing test file for this module)

**Interfaces:**
- Produces: `PosterAspectRatio = 'square' | 'portrait'` (type); `posterHeightFor(ratio: PosterAspectRatio): number`. Tasks 3 and 4 import both.

- [ ] **Step 1: Write the failing test**

Create `src/features/venues/posterLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { POSTER_SIZE, posterHeightFor } from './posterLayout';

describe('posterHeightFor', () => {
  it('returns POSTER_SIZE for square (1:1)', () => {
    expect(posterHeightFor('square')).toBe(POSTER_SIZE);
    expect(posterHeightFor('square')).toBe(1080);
  });

  it('returns 1.5x POSTER_SIZE for portrait (2:3)', () => {
    expect(posterHeightFor('portrait')).toBe(1620);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/venues/posterLayout.test.ts`
Expected: FAIL — `posterHeightFor` is not exported by `./posterLayout`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/posterLayout.ts`, insert immediately after the existing `export const POSTER_SIZE = 1080;` line (before `export const POSTER_LAYOUT = {`):

```ts
export const POSTER_SIZE = 1080;

export type PosterAspectRatio = 'square' | 'portrait';

export const posterHeightFor = (ratio: PosterAspectRatio): number =>
  ratio === 'portrait' ? POSTER_SIZE * 1.5 : POSTER_SIZE; // 1620 : 1080 — exactly 2:3

export const POSTER_LAYOUT = {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/venues/posterLayout.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterLayout.ts src/features/venues/posterLayout.test.ts
git commit -m "feat: add PosterAspectRatio type and posterHeightFor helper"
```

---

### Task 2: `posterCanvas.ts` — explicit width/height in the capture geometry

**Files:**
- Modify: `src/features/venues/posterCanvas.ts`
- Modify: `src/features/venues/posterCanvas.test.ts`

**Interfaces:**
- Consumes: nothing new from Task 1 (this task doesn't import `posterHeightFor` — it just makes the low-level drawing functions accept an explicit height/width instead of assuming a square).
- Produces: `createOffscreenContainer(width: number, height: number): HTMLDivElement` (signature change — was `(size: number = POSTER_SIZE)`); `PosterOverlayOptions` gains a required `posterHeight: number` field, consumed by `drawPosterOverlay`. Task 3 calls both with the real values.

- [ ] **Step 1: Update existing tests for the new `createOffscreenContainer` signature and add a width≠height regression test**

In `src/features/venues/posterCanvas.test.ts`, replace the `describe('createOffscreenContainer', ...)` block:

```ts
describe('createOffscreenContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends a fixed, off-viewport container sized to POSTER_SIZE by default', () => {
    const el = createOffscreenContainer();
    expect(document.body.contains(el)).toBe(true);
    expect(el.style.position).toBe('fixed');
    expect(el.style.left).toBe('-9999px');
    expect(el.style.width).toBe(`${POSTER_SIZE}px`);
    expect(el.style.height).toBe(`${POSTER_SIZE}px`);
  });

  it('honors a custom size', () => {
    const el = createOffscreenContainer(500);
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('500px');
  });
});
```

with:

```ts
describe('createOffscreenContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('appends a fixed, off-viewport container sized to the given width and height', () => {
    const el = createOffscreenContainer(POSTER_SIZE, POSTER_SIZE);
    expect(document.body.contains(el)).toBe(true);
    expect(el.style.position).toBe('fixed');
    expect(el.style.left).toBe('-9999px');
    expect(el.style.width).toBe(`${POSTER_SIZE}px`);
    expect(el.style.height).toBe(`${POSTER_SIZE}px`);
  });

  it('supports independent width and height, for a portrait canvas', () => {
    const el = createOffscreenContainer(1080, 1620);
    expect(el.style.width).toBe('1080px');
    expect(el.style.height).toBe('1620px');
  });
});
```

- [ ] **Step 2: Update the existing `drawPosterOverlay` tests to pass the now-required `posterHeight`, and add two new tests for portrait behavior**

In the same file's `describe('drawPosterOverlay', ...)` block, add `posterHeight: POSTER_SIZE,` to each of the 5 existing test calls' options objects. For example, the first test:

```ts
  it('draws the canton name (uppercased), the count pill, and the attribution by default', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors',
    });
```

becomes:

```ts
  it('draws the canton name (uppercased), the count pill, and the attribution by default', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE,
    });
```

Apply the same `posterHeight: POSTER_SIZE,` addition to the options object in each of the other 4 existing `drawPosterOverlay` tests (`'uses the title override...'`, `'skips the header...'`, `'still draws attribution when the footer is hidden'`, `'draws the Wappen and the QR image...'`).

Then add three new tests at the end of the `describe('drawPosterOverlay', ...)` block, before its closing `});`:

```ts
  it('positions the footer band and QR backing relative to posterHeight (square)', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: POSTER_SIZE, qrImg,
    });
    // footer band: fillRect(0, posterHeight - footerH, POSTER_SIZE, footerH) = fillRect(0, 1080-46, 1080, 46)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 1034, POSTER_SIZE, 46);
    // QR y = posterHeight - qrSize - qrMargin - footerH = 1080-150-28-46 = 856
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 856, 150, 150);
  });

  it('shifts the footer band and QR backing down for a taller posterHeight (portrait)', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: 1620, qrImg,
    });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 1620 - 46, POSTER_SIZE, 46);
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 1620 - 150 - 28 - 46, 150, 150);
  });

  it('positions the minimal attribution strip relative to posterHeight when the footer is hidden', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', posterHeight: 1620, showFooter: false,
    });
    // minAttribStripH = 26; fillRect(0, posterHeight - minAttribStripH, POSTER_SIZE, minAttribStripH)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 1620 - 26, POSTER_SIZE, 26);
  });
```

- [ ] **Step 3: Run the tests to verify the 3 new tests fail**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: the `'supports independent width and height...'` test and the 3 new `drawPosterOverlay` tests FAIL (the old code ignores the second `createOffscreenContainer` argument and hardcodes `POSTER_SIZE` for every vertical measurement, so a 1620 posterHeight still produces 1080-based positions). The other, updated-in-place tests continue to PASS (the current implementation doesn't read `opts.posterHeight` at all, so adding the extra field is harmless until Step 5 changes that).

- [ ] **Step 4: Update `createOffscreenContainer`'s signature**

In `src/features/venues/posterCanvas.ts`, replace:

```ts
export const createOffscreenContainer = (size: number = POSTER_SIZE): HTMLDivElement => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  document.body.appendChild(el);
  return el;
};
```

with:

```ts
export const createOffscreenContainer = (width: number, height: number): HTMLDivElement => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  document.body.appendChild(el);
  return el;
};
```

- [ ] **Step 5: Add `posterHeight` to `PosterOverlayOptions` and use it for every vertical measurement**

In `src/features/venues/posterCanvas.ts`, replace the interface:

```ts
export interface PosterOverlayOptions {
  cantonName: string;
  title?: string;
  wappenImg: HTMLImageElement | null;
  count: number;
  unitLabel: string;
  attribution: string;
  showHeader?: boolean;
  showFooter?: boolean;
  qrImg?: HTMLImageElement | null;
}
```

with:

```ts
export interface PosterOverlayOptions {
  cantonName: string;
  title?: string;
  wappenImg: HTMLImageElement | null;
  count: number;
  unitLabel: string;
  attribution: string;
  posterHeight: number;
  showHeader?: boolean;
  showFooter?: boolean;
  qrImg?: HTMLImageElement | null;
}
```

Then replace the destructuring line:

```ts
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution,
    showHeader = true, showFooter = true, qrImg,
  } = opts;
```

with:

```ts
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution, posterHeight,
    showHeader = true, showFooter = true, qrImg,
  } = opts;
```

Then in the QR block, replace:

```ts
  // QR sits bottom-right, inset above the footer band area.
  if (qrImg) {
    const qrX = POSTER_SIZE - L.qrSize - L.qrMargin;
    const qrY = POSTER_SIZE - L.qrSize - L.qrMargin - L.footerH;
```

with:

```ts
  // QR sits bottom-right, inset above the footer band area.
  if (qrImg) {
    const qrX = POSTER_SIZE - L.qrSize - L.qrMargin;
    const qrY = posterHeight - L.qrSize - L.qrMargin - L.footerH;
```

Finally, replace the footer/attribution block:

```ts
  if (showFooter) {
    ctx.fillStyle = 'rgba(17,17,17,0.72)';
    ctx.fillRect(0, POSTER_SIZE - L.footerH, POSTER_SIZE, L.footerH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `600 ${L.appNameFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(APP_NAME, L.appNameX, POSTER_SIZE - L.footerH / 2);
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, POSTER_SIZE - L.footerH / 2);
    ctx.textAlign = 'left';
  } else {
    // Attribution is legally required even without the branding band — draw a
    // minimal credit with a subtle backing strip for legibility.
    ctx.fillStyle = 'rgba(17,17,17,0.55)';
    ctx.fillRect(0, POSTER_SIZE - L.minAttribStripH, POSTER_SIZE, L.minAttribStripH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, POSTER_SIZE - L.minAttribStripH / 2);
    ctx.textAlign = 'left';
  }
};
```

with:

```ts
  if (showFooter) {
    ctx.fillStyle = 'rgba(17,17,17,0.72)';
    ctx.fillRect(0, posterHeight - L.footerH, POSTER_SIZE, L.footerH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `600 ${L.appNameFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(APP_NAME, L.appNameX, posterHeight - L.footerH / 2);
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, posterHeight - L.footerH / 2);
    ctx.textAlign = 'left';
  } else {
    // Attribution is legally required even without the branding band — draw a
    // minimal credit with a subtle backing strip for legibility.
    ctx.fillStyle = 'rgba(17,17,17,0.55)';
    ctx.fillRect(0, posterHeight - L.minAttribStripH, POSTER_SIZE, L.minAttribStripH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, posterHeight - L.minAttribStripH / 2);
    ctx.textAlign = 'left';
  }
};
```

(The header band, title/pill x-positions, and Wappen position are untouched — they're width measurements and correctly stay on `POSTER_SIZE`.)

- [ ] **Step 6: Run the tests to verify everything passes**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: PASS (all tests, including the 2 updated `createOffscreenContainer` tests, the 5 updated `drawPosterOverlay` tests, and the 3 new ones)

- [ ] **Step 7: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: parameterize poster capture geometry by explicit width/height"
```

---

### Task 3: `cantonPoster.ts` — wire `aspectRatio` into the capture

**Files:**
- Modify: `src/features/venues/cantonPoster.ts`
- Modify: `src/features/venues/cantonPoster.test.ts`

**Interfaces:**
- Consumes: `posterHeightFor`, `PosterAspectRatio` from `./posterLayout` (Task 1); `createOffscreenContainer(width, height)` and `PosterOverlayOptions.posterHeight` from `./posterCanvas` (Task 2).
- Produces: `GeneratePosterOptions.aspectRatio?: PosterAspectRatio` (optional, defaults to `'square'` — matches the existing pattern where `showHeader`/`showFooter` default at the point of use, and keeps every existing caller that doesn't pass it working unchanged). Task 4 (`PosterEditorModal.tsx`) passes it explicitly.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/cantonPoster.test.ts`, add `POSTER_SIZE` to the existing import from `./cantonPoster`:

```ts
import { generateCantonPosterBlob, waitForTilesLoad } from './cantonPoster';
```

becomes:

```ts
import { generateCantonPosterBlob, waitForTilesLoad, POSTER_SIZE } from './cantonPoster';
```

Then add a new `describe` block at the end of the file, before the final closing of `describe('generateCantonPosterBlob', ...)` (i.e., as sibling tests inside that same block, added right after the existing `'uses setView (not fitBounds) when an explicit view is supplied'` test and before its closing `});`):

```ts
  it('sizes the canvas to POSTER_SIZE x POSTER_SIZE when aspectRatio is omitted (defaults to square)', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: POSTER_SIZE }),
    );
  });

  it('sizes the canvas to POSTER_SIZE x 1620 for aspectRatio "portrait"', async () => {
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, 'width', 'set');
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, 'height', 'set');

    await generateCantonPosterBlob('BE', venues, {
      baseKind: 'map', unitLabel: 'Schwingkeller', aspectRatio: 'portrait',
    });

    expect(widthSpy).toHaveBeenCalledWith(POSTER_SIZE);
    expect(heightSpy).toHaveBeenCalledWith(1620);
    expect(drawPosterOverlayMock).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ posterHeight: 1620 }),
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: FAIL — TypeScript error/runtime mismatch, since `GeneratePosterOptions` has no `aspectRatio` field yet and the canvas is unconditionally sized to `POSTER_SIZE` × `POSTER_SIZE` regardless of the (currently nonexistent) option; the portrait test's `heightSpy` assertion fails (canvas height is set to `1080`, not `1620`), and neither test's `drawPosterOverlayMock` assertion sees a `posterHeight` field at all.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/cantonPoster.ts`, add the import:

```ts
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage,
  extractTileDraws, drawTiles, drawPin, drawPosterOverlay,
} from './posterCanvas';
```

becomes:

```ts
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage,
  extractTileDraws, drawTiles, drawPin, drawPosterOverlay,
} from './posterCanvas';
import { posterHeightFor, type PosterAspectRatio } from './posterLayout';
```

Add `aspectRatio` to the options interface:

```ts
export interface GeneratePosterOptions {
  baseKind: BaseKind;
  // Exact framing from the editor: `center` is the preview map's center and `zoom` is already
  // scaled up by log2(POSTER_SIZE / previewWidthPx), so this larger canvas covers the identical
  // ground area the preview showed. Falls back to the canton's default bounds when absent.
  view?: PosterView;
  unitLabel: string;
  title?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  qrDataUrl?: string | null;
}
```

becomes:

```ts
export interface GeneratePosterOptions {
  baseKind: BaseKind;
  // Exact framing from the editor: `center` is the preview map's center and `zoom` is already
  // scaled up by log2(POSTER_SIZE / previewWidthPx), so this larger canvas covers the identical
  // ground area the preview showed. Falls back to the canton's default bounds when absent.
  view?: PosterView;
  unitLabel: string;
  title?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  qrDataUrl?: string | null;
  aspectRatio?: PosterAspectRatio; // defaults to 'square', matching today's output
}
```

Then update the function body. Replace:

```ts
  const { baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl } = options;
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }

  const container = createOffscreenContainer(POSTER_SIZE);
```

with:

```ts
  const {
    baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl,
    aspectRatio = 'square',
  } = options;
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }
  const posterHeight = posterHeightFor(aspectRatio);

  const container = createOffscreenContainer(POSTER_SIZE, posterHeight);
```

Then replace:

```ts
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_SIZE;
    canvas.height = POSTER_SIZE;
```

with:

```ts
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_SIZE;
    canvas.height = posterHeight;
```

Then replace the `drawPosterOverlay` call:

```ts
    drawPosterOverlay(ctx, {
      cantonName: canton.name,
      title,
      wappenImg,
      count: cantonVenues.length,
      unitLabel,
      attribution: TILE_ATTRIBUTION[baseKind],
      showHeader,
      showFooter,
      qrImg,
    });
```

with:

```ts
    drawPosterOverlay(ctx, {
      cantonName: canton.name,
      title,
      wappenImg,
      count: cantonVenues.length,
      unitLabel,
      attribution: TILE_ATTRIBUTION[baseKind],
      posterHeight,
      showHeader,
      showFooter,
      qrImg,
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: PASS (all tests, including the 2 new ones and every pre-existing test — the existing tests never pass `aspectRatio`, and the `'square'` default reproduces today's exact `POSTER_SIZE` × `POSTER_SIZE` output)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/cantonPoster.ts src/features/venues/cantonPoster.test.ts
git commit -m "feat: thread aspectRatio through canton poster generation"
```

---

### Task 4: `PosterEditorModal.tsx` — Square/Portrait toggle

**Files:**
- Modify: `src/i18n/translations.ts`
- Modify: `src/features/venues/PosterEditorModal.tsx`
- Modify: `src/features/venues/PosterEditorModal.test.tsx`

**Interfaces:**
- Consumes: `PosterAspectRatio`, `posterHeightFor` from `./posterLayout` (Task 1); `GeneratePosterOptions.aspectRatio` from `./cantonPoster` (Task 3); new i18n keys `t.posterFormatLabel`, `t.posterFormatSquare`, `t.posterFormatPortrait`.
- Produces: nothing consumed by other tasks — this is the last task in the chain.

- [ ] **Step 1: Add the new i18n keys to all three languages**

In `src/i18n/translations.ts`, in the `de` block, replace:

```ts
    posterBaseLabel: 'Kartentyp',
    posterToggleHeader: 'Kopfzeile',
```

with:

```ts
    posterBaseLabel: 'Kartentyp',
    posterFormatLabel: 'Format',
    posterFormatSquare: 'Quadrat',
    posterFormatPortrait: 'Hochformat',
    posterToggleHeader: 'Kopfzeile',
```

In the `fr` block, replace:

```ts
    posterBaseLabel: 'Type de carte',
    posterToggleHeader: 'En-tête',
```

with:

```ts
    posterBaseLabel: 'Type de carte',
    posterFormatLabel: 'Format',
    posterFormatSquare: 'Carré',
    posterFormatPortrait: 'Portrait',
    posterToggleHeader: 'En-tête',
```

In the `it` block, replace:

```ts
    posterBaseLabel: 'Tipo di mappa',
    posterToggleHeader: 'Intestazione',
```

with:

```ts
    posterBaseLabel: 'Tipo di mappa',
    posterFormatLabel: 'Formato',
    posterFormatSquare: 'Quadrato',
    posterFormatPortrait: 'Verticale',
    posterToggleHeader: 'Intestazione',
```

- [ ] **Step 2: Write the failing tests**

In `src/features/venues/PosterEditorModal.test.tsx`, add `invalidateSize: vi.fn()` to the hoisted `fakeMap` mock:

```ts
const { fakeMap } = vi.hoisted(() => ({
  fakeMap: {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getCenter: vi.fn().mockReturnValue({ lat: 46.9, lng: 7.4 }),
    getZoom: vi.fn().mockReturnValue(11),
    setMaxZoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  },
}));
```

becomes:

```ts
const { fakeMap } = vi.hoisted(() => ({
  fakeMap: {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getCenter: vi.fn().mockReturnValue({ lat: 46.9, lng: 7.4 }),
    getZoom: vi.fn().mockReturnValue(11),
    setMaxZoom: vi.fn(),
    invalidateSize: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  },
}));
```

Then add a new `describe` block at the end of the file, after the closing `});` of `describe('PosterEditorModal', ...)`:

```tsx
describe('aspect ratio', () => {
  beforeEach(() => { generateCantonPosterBlob.mockClear(); fakeMap.invalidateSize.mockClear(); });

  it('renders Square and Portrait controls, defaulting to Square', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: STR.de.posterFormatSquare })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: STR.de.posterFormatPortrait })).toHaveAttribute('aria-pressed', 'false');
  });

  it('resizes the preview container height when switching to Portrait, without moving the map', async () => {
    const user = userEvent.setup();
    renderEditor();
    const previewSquare = screen.getByTestId('poster-preview-square');
    expect(previewSquare).toHaveStyle({ width: '540px', height: '540px' });

    await user.click(screen.getByRole('button', { name: STR.de.posterFormatPortrait }));

    expect(previewSquare).toHaveStyle({ width: '540px', height: '810px' });
    expect(fakeMap.invalidateSize).toHaveBeenCalledTimes(1);
    expect(fakeMap.setView).not.toHaveBeenCalled();
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  it('forwards the current aspectRatio to generateCantonPosterBlob', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: STR.de.posterFormatPortrait }));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));
    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2]).toMatchObject({ aspectRatio: 'portrait' });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: FAIL — the Square/Portrait buttons don't exist yet, `getByTestId('poster-preview-square')` finds nothing, and `generateCantonPosterBlob` is never called with an `aspectRatio` field.

- [ ] **Step 4: Write the minimal implementation**

In `src/features/venues/PosterEditorModal.tsx`, update the import from `./posterLayout`:

```ts
import { POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin } from './posterLayout';
```

becomes:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin, posterHeightFor, type PosterAspectRatio,
} from './posterLayout';
```

Add the new state, right after the existing `showQr`/`busy` state declarations:

```ts
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [busy, setBusy] = useState(false);
```

becomes:

```ts
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<PosterAspectRatio>('square');
  const [busy, setBusy] = useState(false);
```

Add a ref to guard the initial mount (mirroring the existing `didMountBaseKindRef` pattern), right after that ref's declaration:

```ts
  const didMountBaseKindRef = useRef(false);
```

becomes:

```ts
  const didMountBaseKindRef = useRef(false);
  const didMountAspectRatioRef = useRef(false);
```

Add a new effect right after the existing base-layer-swap effect (after its closing `}, [baseKind]);`):

```ts
  // Resize the live map's container when the aspect ratio changes; skip the initial mount (the
  // create-map effect already sizes the container for the initial 'square' aspectRatio). Leaflet
  // requires invalidateSize() after any container resize to keep its internal size cache correct.
  // Per the design, this only resizes the container — it never re-fits or re-centers the view.
  useEffect(() => {
    if (!didMountAspectRatioRef.current) {
      didMountAspectRatioRef.current = true;
      return;
    }
    mapRef.current?.invalidateSize();
  }, [aspectRatio]);
```

Update `download()` to forward `aspectRatio`. Replace:

```ts
      const { blob, filename } = await generateCantonPosterBlob(code, venues, {
        baseKind,
        view,
        unitLabel,
        title,
        showHeader,
        showFooter,
        qrDataUrl: showQr ? qrDataUrl : null,
      });
```

with:

```ts
      const { blob, filename } = await generateCantonPosterBlob(code, venues, {
        baseKind,
        view,
        unitLabel,
        title,
        showHeader,
        showFooter,
        qrDataUrl: showQr ? qrDataUrl : null,
        aspectRatio,
      });
```

Update the preview container's size and add a test id. Replace:

```tsx
          <div style={{ position: 'relative', width: previewSize, height: previewSize, flex: '0 0 auto', borderRadius: theme.radius.sm, overflow: 'hidden', border: '1px solid ' + theme.color.line, containerType: 'inline-size' }}>
```

with:

```tsx
          <div data-testid="poster-preview-square" style={{ position: 'relative', width: previewSize, height: previewSize * (posterHeightFor(aspectRatio) / POSTER_SIZE), flex: '0 0 auto', borderRadius: theme.radius.sm, overflow: 'hidden', border: '1px solid ' + theme.color.line, containerType: 'inline-size' }}>
```

Finally, add the Square/Portrait toggle. It goes right after the existing Map/Satellite toggle block, before the header/footer/QR toggles. Replace:

```tsx
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={fieldLabel}>{t.posterBaseLabel}</span>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.paper, borderRadius: '999px', padding: '4px', gap: '2px' }}>
                {(['map', 'sat'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={baseKind === k} onClick={() => setBaseKind(k)}
                    style={{ border: 'none', borderRadius: '999px', padding: '7px 18px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease', background: baseKind === k ? theme.color.bg : 'transparent', color: baseKind === k ? theme.color.ink : theme.color.muted, boxShadow: baseKind === k ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
                    {k === 'map' ? t.mapView : t.satView}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
```

with:

```tsx
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={fieldLabel}>{t.posterBaseLabel}</span>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.paper, borderRadius: '999px', padding: '4px', gap: '2px' }}>
                {(['map', 'sat'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={baseKind === k} onClick={() => setBaseKind(k)}
                    style={{ border: 'none', borderRadius: '999px', padding: '7px 18px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease', background: baseKind === k ? theme.color.bg : 'transparent', color: baseKind === k ? theme.color.ink : theme.color.muted, boxShadow: baseKind === k ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
                    {k === 'map' ? t.mapView : t.satView}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={fieldLabel}>{t.posterFormatLabel}</span>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.paper, borderRadius: '999px', padding: '4px', gap: '2px' }}>
                {(['square', 'portrait'] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={aspectRatio === r} onClick={() => setAspectRatio(r)}
                    style={{ border: 'none', borderRadius: '999px', padding: '7px 18px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease', background: aspectRatio === r ? theme.color.bg : 'transparent', color: aspectRatio === r ? theme.color.ink : theme.color.muted, boxShadow: aspectRatio === r ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
                    {r === 'square' ? t.posterFormatSquare : t.posterFormatPortrait}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: PASS (all tests, including the 4 pre-existing ones and the 3 new `describe('aspect ratio', ...)` tests)

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translations.ts src/features/venues/PosterEditorModal.tsx src/features/venues/PosterEditorModal.test.tsx
git commit -m "feat: add Square/Portrait toggle to the canton poster editor"
```

---

### Task 5: Full verification and manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including every file touched in Tasks 1-4 and every other existing suite (unaffected by this change).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the type checker**

Run: `npm run typecheck`
Expected: no errors (in particular: `PosterOverlayOptions.posterHeight` being required is satisfied everywhere it's constructed; `GeneratePosterOptions.aspectRatio` being optional doesn't break any existing caller).

- [ ] **Step 4: Manual verification in the dev server**

Run: `npm run dev`, open the app, log in as admin, and open the poster editor (per `docs/superpowers/specs/2026-07-21-poster-aspect-ratio-design.md`'s "Verification before shipping" section) for a canton with several venues:
- generate a poster in Square mode (default) — confirm it looks identical to before this change,
- switch to Portrait — confirm the live preview reshapes (taller, same width) with the header staying pinned to the top and the footer/QR staying pinned to the bottom of the new shape,
- download the Portrait export and confirm the PNG is exactly 1080×1620, with the footer band, QR code, and attribution text all correctly anchored to the bottom edge rather than floating mid-canvas or clipped.

- [ ] **Step 5: Commit any fixups found during manual verification**

If manual verification surfaces an issue, fix it, re-run Steps 1-3, and commit:

```bash
git add -A
git commit -m "fix: address manual verification findings for poster aspect ratio"
```

If no issues are found, skip this step — Task 4's commit is the final commit for this plan.
