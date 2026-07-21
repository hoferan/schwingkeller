# Canton Poster — Header/Footer Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin independently position the header/footer bands (top or bottom, stacking if both share an edge), pick a shared visual style (Solid/Transparent/Light), a shared size (Normal/Compact), and a QR-code corner — all defaulting to today's exact output.

**Architecture:** A new `chromeLayoutFor(size)` helper (`posterLayout.ts`) returns the chrome-only geometry constants (excluding pin geometry) scaled for Normal or Compact. A new pure `computeChromeLayout(...)` function (`posterCanvas.ts`) turns position/visibility/size into each band's absolute y-offset and the total height occupied per edge — used identically by the canvas capture (`drawPosterOverlay`) and, converted to `cqw()` units, by the live DOM preview (`PosterEditorModal.tsx`), keeping the two in sync exactly as `POSTER_LAYOUT`/`cqw()` already do today.

**Tech Stack:** TypeScript, React 19, Leaflet, Vitest + React Testing Library.

## Global Constraints

- No `any` — use proper types or `unknown` (CLAUDE.md).
- No new npm dependencies (CLAUDE.md).
- TDD: write the failing test first, then the implementation (CLAUDE.md, test-driven-development skill).
- `npm run test` and `npm run lint` must pass before the work is considered complete (CLAUDE.md).
- Keep i18n keys in sync across DE/FR/IT when touching UI text (CLAUDE.md) — this plan adds 16 new keys and must add all three languages together for every one.
- `POSTER_LAYOUT.headerH`/`.footerH` keep meaning exactly what they mean today (the **normal**-size values) — `chromeLayoutFor('normal')` must return the same numbers, because sub-project A's already-written (not yet implemented) plan reads `POSTER_LAYOUT.headerH`/`.footerH` directly.
- Design source of truth: `docs/superpowers/specs/2026-07-21-poster-header-footer-customization-design.md`.
- **Sequencing note:** this plan is written against the source tree as it stands with **none** of sub-projects A, B, or D implemented yet. If A and/or B have already landed by the time this plan is executed, the exact surrounding code shown in each diff below may have shifted (e.g. B adds a `posterHeight` parameter this plan doesn't assume) — the class of change stays the same, but line-level context will need re-checking against the actual file at execution time.

---

### Task 1: `posterLayout.ts` — chrome types, `COMPACT_SCALE`, `chromeLayoutFor()`

**Files:**
- Modify: `src/features/venues/posterLayout.ts`
- Create or extend: `src/features/venues/posterLayout.test.ts` (doesn't exist yet unless sub-project B has already been implemented, in which case it exists with a `describe('posterHeightFor', ...)` block — add the content below as new `describe` blocks in that file instead of creating it fresh)

**Interfaces:**
- Produces: `ChromePosition = 'top' | 'bottom'`; `ChromeStyle = 'solid' | 'transparent' | 'light'`; `ChromeSize = 'normal' | 'compact'`; `QrCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`; `ChromeLayoutConstants` interface; `COMPACT_SCALE = 0.62`; `chromeLayoutFor(size: ChromeSize): ChromeLayoutConstants`. Tasks 2, 3, 4, 7, 8 import these.

- [ ] **Step 1: Write the failing tests**

Create (or extend) `src/features/venues/posterLayout.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { POSTER_LAYOUT, chromeLayoutFor, COMPACT_SCALE } from './posterLayout';

describe('chromeLayoutFor', () => {
  it('returns unscaled ("normal") values matching POSTER_LAYOUT exactly', () => {
    const normal = chromeLayoutFor('normal');
    expect(normal.headerH).toBe(POSTER_LAYOUT.headerH);
    expect(normal.footerH).toBe(POSTER_LAYOUT.footerH);
    expect(normal.qrSize).toBe(POSTER_LAYOUT.qrSize);
    expect(normal.titleFont).toBe(POSTER_LAYOUT.titleFont);
    expect(normal.minAttribStripH).toBe(POSTER_LAYOUT.minAttribStripH);
  });

  it('scales every chrome constant by COMPACT_SCALE for "compact"', () => {
    const compact = chromeLayoutFor('compact');
    expect(compact.headerH).toBeCloseTo(POSTER_LAYOUT.headerH * COMPACT_SCALE);
    expect(compact.footerH).toBeCloseTo(POSTER_LAYOUT.footerH * COMPACT_SCALE);
    expect(compact.qrSize).toBeCloseTo(POSTER_LAYOUT.qrSize * COMPACT_SCALE);
    expect(compact.titleFont).toBeCloseTo(POSTER_LAYOUT.titleFont * COMPACT_SCALE);
  });

  it('does not expose venue-pin geometry — that stays outside the chrome-size axis entirely', () => {
    expect('pinRadius' in chromeLayoutFor('compact')).toBe(false);
    expect('pinRing' in chromeLayoutFor('normal')).toBe(false);
    expect('pinDotRatio' in chromeLayoutFor('normal')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/posterLayout.test.ts`
Expected: FAIL — `chromeLayoutFor` and `COMPACT_SCALE` are not exported by `./posterLayout`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/posterLayout.ts`, insert the following immediately after the `POSTER_LAYOUT` constant's closing `} as const;` (before the existing `cqw` function):

```ts
export type ChromePosition = 'top' | 'bottom';
export type ChromeStyle = 'solid' | 'transparent' | 'light';
export type ChromeSize = 'normal' | 'compact';
export type QrCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// The chrome-only subset of POSTER_LAYOUT (everything except venue-pin geometry, which never
// scales with the admin's header/footer size choice).
export interface ChromeLayoutConstants {
  headerH: number; footerH: number; minAttribStripH: number; padX: number;
  wappenX: number; wappenY: number; wappenW: number; wappenH: number; wappenGap: number;
  titleGap: number; titleFont: number; titleBaselineY: number;
  pillFont: number; pillPadX: number; pillH: number; pillY: number;
  appNameFont: number; appNameX: number; attribFont: number; attribMarginX: number;
  qrSize: number; qrMargin: number; qrPad: number;
}

const CHROME_KEYS: (keyof ChromeLayoutConstants)[] = [
  'headerH', 'footerH', 'minAttribStripH', 'padX', 'wappenX', 'wappenY', 'wappenW', 'wappenH',
  'wappenGap', 'titleGap', 'titleFont', 'titleBaselineY', 'pillFont', 'pillPadX', 'pillH', 'pillY',
  'appNameFont', 'appNameX', 'attribFont', 'attribMarginX', 'qrSize', 'qrMargin', 'qrPad',
];

const CHROME_LAYOUT_NORMAL: ChromeLayoutConstants = CHROME_KEYS.reduce((acc, key) => {
  acc[key] = POSTER_LAYOUT[key];
  return acc;
}, {} as ChromeLayoutConstants);

// Shrinks the chrome (header/footer band, fonts, Wappen, pill, QR, padding) for the admin's
// "Compact" size option, keeping text legible while meaningfully reducing the branding footprint.
export const COMPACT_SCALE = 0.62;

const CHROME_LAYOUT_COMPACT: ChromeLayoutConstants = CHROME_KEYS.reduce((acc, key) => {
  acc[key] = CHROME_LAYOUT_NORMAL[key] * COMPACT_SCALE;
  return acc;
}, {} as ChromeLayoutConstants);

export const chromeLayoutFor = (size: ChromeSize): ChromeLayoutConstants =>
  size === 'compact' ? CHROME_LAYOUT_COMPACT : CHROME_LAYOUT_NORMAL;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/posterLayout.test.ts`
Expected: PASS (3 new tests, plus any pre-existing ones in the file unaffected)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterLayout.ts src/features/venues/posterLayout.test.ts
git commit -m "feat: add chrome position/style/size types and chromeLayoutFor helper"
```

---

### Task 2: `posterCanvas.ts` — `computeChromeLayout()`

**Files:**
- Modify: `src/features/venues/posterCanvas.ts`
- Modify: `src/features/venues/posterCanvas.test.ts`

**Interfaces:**
- Consumes: `chromeLayoutFor(size: ChromeSize): ChromeLayoutConstants`, `ChromePosition`, `ChromeSize` from `./posterLayout` (Task 1).
- Produces: `ChromeLayoutResult { headerY: number | null; footerY: number | null; topOccupied: number; bottomOccupied: number }`; `ChromeLayoutOptions { showHeader: boolean; showFooter: boolean; headerPosition: ChromePosition; footerPosition: ChromePosition; chromeSize: ChromeSize; posterHeight: number }`; `computeChromeLayout(opts: ChromeLayoutOptions): ChromeLayoutResult`. Tasks 3, 4, and 8 consume this.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/posterCanvas.test.ts`, add `computeChromeLayout` to the existing import line:

```ts
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles, drawPin, drawPosterOverlay } from './posterCanvas';
```

becomes:

```ts
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles, drawPin, drawPosterOverlay, computeChromeLayout } from './posterCanvas';
```

Then add a new `describe` block anywhere at the top level of the file (e.g. right after the `describe('posterFilename', ...)` block):

```ts
describe('computeChromeLayout', () => {
  const base = { chromeSize: 'normal' as const, posterHeight: POSTER_SIZE };

  it('places header at the top and footer at the bottom by default', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
    });
    expect(result).toEqual({ headerY: 0, footerY: 1034, topOccupied: 190, bottomOccupied: 46 });
  });

  it('stacks header and footer when both are assigned to the top edge, header closer to the edge', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'top',
    });
    expect(result).toEqual({ headerY: 0, footerY: 190, topOccupied: 236, bottomOccupied: 0 });
  });

  it('stacks header and footer when both are assigned to the bottom edge, header closer to the edge', () => {
    const result = computeChromeLayout({
      ...base, showHeader: true, showFooter: true, headerPosition: 'bottom', footerPosition: 'bottom',
    });
    expect(result).toEqual({ headerY: 890, footerY: 844, topOccupied: 0, bottomOccupied: 236 });
  });

  it('returns null for a hidden band and excludes it from the occupied totals', () => {
    const result = computeChromeLayout({
      ...base, showHeader: false, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
    });
    expect(result).toEqual({ headerY: null, footerY: 1034, topOccupied: 0, bottomOccupied: 46 });
  });

  it('uses compact chrome sizing when chromeSize is "compact"', () => {
    const result = computeChromeLayout({
      showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'bottom',
      chromeSize: 'compact', posterHeight: POSTER_SIZE,
    });
    expect(result.headerY).toBe(0);
    expect(result.topOccupied).toBeCloseTo(190 * 0.62);
    expect(result.bottomOccupied).toBeCloseTo(46 * 0.62);
    expect(result.footerY).toBeCloseTo(POSTER_SIZE - 46 * 0.62);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: FAIL — `computeChromeLayout` is not exported by `./posterCanvas`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/posterCanvas.ts`, update the import from `./posterLayout`:

```ts
import { POSTER_SIZE, POSTER_LAYOUT } from './posterLayout';
```

becomes:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor, type ChromePosition, type ChromeSize,
} from './posterLayout';
```

Then add the following after the existing `drawPin` function and before the `PosterOverlayOptions` interface:

```ts
export interface ChromeLayoutResult {
  headerY: number | null;
  footerY: number | null;
  topOccupied: number;
  bottomOccupied: number;
}

export interface ChromeLayoutOptions {
  showHeader: boolean;
  showFooter: boolean;
  headerPosition: ChromePosition;
  footerPosition: ChromePosition;
  chromeSize: ChromeSize;
  posterHeight: number;
}

// Header and footer each independently sit on the top or bottom edge; when both land on the same
// edge they stack rather than overlap, with header always closer to the edge and footer stacked
// adjacent to it. Pure geometry — no canvas/DOM access — so both the capture (drawPosterOverlay)
// and the live DOM preview can share one source of truth for where each band actually is.
export const computeChromeLayout = (opts: ChromeLayoutOptions): ChromeLayoutResult => {
  const { showHeader, showFooter, headerPosition, footerPosition, chromeSize, posterHeight } = opts;
  const L = chromeLayoutFor(chromeSize);

  let headerY: number | null = null;
  let footerY: number | null = null;
  let topOccupied = 0;
  let bottomOccupied = 0;

  if (showHeader && headerPosition === 'top') {
    headerY = topOccupied;
    topOccupied += L.headerH;
  }
  if (showFooter && footerPosition === 'top') {
    footerY = topOccupied;
    topOccupied += L.footerH;
  }
  if (showHeader && headerPosition === 'bottom') {
    bottomOccupied += L.headerH;
    headerY = posterHeight - bottomOccupied;
  }
  if (showFooter && footerPosition === 'bottom') {
    bottomOccupied += L.footerH;
    footerY = posterHeight - bottomOccupied;
  }

  return { headerY, footerY, topOccupied, bottomOccupied };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: PASS (5 new tests, plus every pre-existing test in the file, unaffected — `computeChromeLayout` is additive so far, nothing yet calls it from `drawPosterOverlay`)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: add computeChromeLayout for header/footer position and stacking"
```

---

### Task 3: `posterCanvas.ts` — style presets and dynamic band positioning in `drawPosterOverlay`

**Files:**
- Modify: `src/features/venues/posterCanvas.ts`
- Modify: `src/features/venues/posterCanvas.test.ts`

**Interfaces:**
- Consumes: `computeChromeLayout` (Task 2); `chromeLayoutFor` (Task 1); `ChromeStyle`, `ChromePosition`, `ChromeSize` types (Task 1).
- Produces: `PosterOverlayOptions` gains `headerPosition?`, `footerPosition?`, `chromeStyle?`, `chromeSize?` (all optional, defaulting to today's look); exported `CHROME_STYLE_COLORS: Record<ChromeStyle, { fill: string | null; text: string; shadow: boolean }>` — Task 8 (DOM preview) imports this so the live preview uses the identical color/shadow rules as the canvas.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/posterCanvas.test.ts`, add `CHROME_STYLE_COLORS` to the existing import:

```ts
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles, drawPin, drawPosterOverlay, computeChromeLayout } from './posterCanvas';
```

becomes:

```ts
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles,
  drawPin, drawPosterOverlay, computeChromeLayout, CHROME_STYLE_COLORS,
} from './posterCanvas';
```

Add these tests inside the existing `describe('drawPosterOverlay', ...)` block, before its closing `});` (the `makeCtx()` helper already defined in that block is reused as-is):

```ts
  it('draws the header at its position-derived offset instead of always y=0', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', headerPosition: 'bottom', showFooter: false,
    });
    // headerPosition 'bottom', showFooter false: header alone occupies the bottom edge, so
    // headerY = POSTER_SIZE - headerH = 1080 - 190 = 890. The title baseline draws at
    // headerY + titleBaselineY = 890 + 110 = 1000.
    expect(ctx.fillText).toHaveBeenCalledWith('BERN', expect.any(Number), 1000);
  });

  it('stacks header and footer without overlapping when both share the top edge', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', headerPosition: 'top', footerPosition: 'top',
    });
    // header at y=0: title baseline at 0 + 110 = 110. footer at y=190 (stacked below header):
    // app-name/attribution vertically centered at 190 + footerH/2 = 190 + 23 = 213.
    expect(ctx.fillText).toHaveBeenCalledWith('BERN', expect.any(Number), 110);
    expect(ctx.fillText).toHaveBeenCalledWith('Schwingkeller Schweiz', expect.any(Number), 213);
  });

  it('draws no fill and applies a shadow for the transparent style', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', chromeStyle: 'transparent',
    });
    // Header/footer band backgrounds use fillRect with the band's own width/height; the transparent
    // style's fill is null, so those specific two fillRect calls (header 0,0,1080,190 and footer
    // 0,1034,1080,46) never happen — only the QR backing / minimal-strip fillRect calls would, and
    // neither applies here (no qrImg, footer shown).
    expect(ctx.fillRect).not.toHaveBeenCalledWith(0, 0, POSTER_SIZE, 190);
    expect(ctx.fillRect).not.toHaveBeenCalledWith(0, 1034, POSTER_SIZE, 46);
  });

  it('uses light-style colors (light fill, dark text) for the header/footer bands', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', chromeStyle: 'light',
    });
    expect(CHROME_STYLE_COLORS.light.fill).toBe('rgba(255,255,255,0.85)');
    expect(CHROME_STYLE_COLORS.light.text).not.toBe(CHROME_STYLE_COLORS.solid.text);
  });

  it('shrinks header/footer geometry for chromeSize "compact"', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', chromeSize: 'compact',
    });
    // compact footerH = 46 * 0.62 = 28.52; footer band at posterHeight - compactFooterH
    expect(ctx.fillRect).toHaveBeenCalledWith(0, POSTER_SIZE - 46 * 0.62, POSTER_SIZE, 46 * 0.62);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: FAIL — `CHROME_STYLE_COLORS` isn't exported yet, and `drawPosterOverlay` still hardcodes `headerY = 0` / `footerY = POSTER_SIZE - L.footerH` and a single solid fill color regardless of the new options.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/posterCanvas.ts`, add the style-color table right after the `ChromeLayoutOptions`/`computeChromeLayout` block added in Task 2, and update the `PosterOverlayOptions` interface. Replace:

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
  showHeader?: boolean;
  showFooter?: boolean;
  qrImg?: HTMLImageElement | null;
  headerPosition?: ChromePosition;
  footerPosition?: ChromePosition;
  chromeStyle?: ChromeStyle;
  chromeSize?: ChromeSize;
}

export const CHROME_STYLE_COLORS: Record<ChromeStyle, { fill: string | null; text: string; shadow: boolean }> = {
  solid: { fill: 'rgba(17,17,17,0.72)', text: theme.color.bg, shadow: false },
  transparent: { fill: null, text: theme.color.bg, shadow: true },
  light: { fill: 'rgba(255,255,255,0.85)', text: theme.color.ink, shadow: false },
};

const applyChromeShadow = (ctx: CanvasRenderingContext2D, on: boolean): void => {
  ctx.shadowColor = on ? 'rgba(0,0,0,0.6)' : 'transparent';
  ctx.shadowBlur = on ? 4 : 0;
  ctx.shadowOffsetY = on ? 1 : 0;
};
```

Update the import from `./posterLayout` (added in Task 2) to also bring in `ChromeStyle`:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor, type ChromePosition, type ChromeSize,
} from './posterLayout';
```

becomes:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor,
  type ChromePosition, type ChromeSize, type ChromeStyle,
} from './posterLayout';
```

Now replace the entire body of `drawPosterOverlay` (from its opening destructure through its closing `};`):

```ts
export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution,
    showHeader = true, showFooter = true, qrImg,
  } = opts;

  if (showHeader) {
    ctx.fillStyle = 'rgba(17,17,17,0.72)';
    ctx.fillRect(0, 0, POSTER_SIZE, L.headerH);

    let textX = L.padX;
    if (wappenImg) {
      ctx.drawImage(wappenImg, L.wappenX, L.wappenY, L.wappenW, L.wappenH);
      textX = L.padX + L.wappenW + L.wappenGap;
    }

    ctx.fillStyle = theme.color.bg;
    ctx.font = `700 ${L.titleFont}px Oswald, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText((title || cantonName).toUpperCase(), textX, L.titleBaselineY);

    const pillText = `${count} ${unitLabel}`;
    ctx.font = `700 ${L.pillFont}px Oswald, sans-serif`;
    const pillWidth = ctx.measureText(pillText).width + L.pillPadX * 2;
    ctx.fillStyle = theme.color.accent;
    ctx.beginPath();
    ctx.roundRect(textX, L.pillY, pillWidth, L.pillH, L.pillH / 2);
    ctx.fill();
    ctx.fillStyle = theme.color.accentInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, textX + L.pillPadX, L.pillY + L.pillH / 2 + 1);
  }

  // QR sits bottom-right, inset above the footer band area.
  if (qrImg) {
    const qrX = POSTER_SIZE - L.qrSize - L.qrMargin;
    const qrY = POSTER_SIZE - L.qrSize - L.qrMargin - L.footerH;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - L.qrPad, qrY - L.qrPad, L.qrSize + L.qrPad * 2, L.qrSize + L.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, L.qrSize, L.qrSize);
  }

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
export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution, qrImg,
    showHeader = true, showFooter = true,
    headerPosition = 'top', footerPosition = 'bottom',
    chromeStyle = 'solid', chromeSize = 'normal',
  } = opts;

  const CL = chromeLayoutFor(chromeSize);
  const colors = CHROME_STYLE_COLORS[chromeStyle];
  const chrome = computeChromeLayout({
    showHeader, showFooter, headerPosition, footerPosition, chromeSize, posterHeight: POSTER_SIZE,
  });

  if (showHeader && chrome.headerY !== null) {
    const y = chrome.headerY;
    if (colors.fill) {
      ctx.fillStyle = colors.fill;
      ctx.fillRect(0, y, POSTER_SIZE, CL.headerH);
    }
    applyChromeShadow(ctx, colors.shadow);

    let textX = CL.padX;
    if (wappenImg) {
      ctx.drawImage(wappenImg, CL.wappenX, y + CL.wappenY, CL.wappenW, CL.wappenH);
      textX = CL.padX + CL.wappenW + CL.wappenGap;
    }

    ctx.fillStyle = colors.text;
    ctx.font = `700 ${CL.titleFont}px Oswald, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText((title || cantonName).toUpperCase(), textX, y + CL.titleBaselineY);

    const pillText = `${count} ${unitLabel}`;
    ctx.font = `700 ${CL.pillFont}px Oswald, sans-serif`;
    const pillWidth = ctx.measureText(pillText).width + CL.pillPadX * 2;
    applyChromeShadow(ctx, false); // the count pill always keeps its own solid accent fill, never shadowed
    ctx.fillStyle = theme.color.accent;
    ctx.beginPath();
    ctx.roundRect(textX, y + CL.pillY, pillWidth, CL.pillH, CL.pillH / 2);
    ctx.fill();
    ctx.fillStyle = theme.color.accentInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, textX + CL.pillPadX, y + CL.pillY + CL.pillH / 2 + 1);
    applyChromeShadow(ctx, false);
  }

  // QR sits bottom-right, inset above the footer band area — Task 4 replaces this fixed corner
  // with the admin-chosen one.
  if (qrImg) {
    const qrX = POSTER_SIZE - CL.qrSize - CL.qrMargin;
    const qrY = POSTER_SIZE - CL.qrSize - CL.qrMargin - chrome.bottomOccupied;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - CL.qrPad, qrY - CL.qrPad, CL.qrSize + CL.qrPad * 2, CL.qrSize + CL.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, CL.qrSize, CL.qrSize);
  }

  if (showFooter && chrome.footerY !== null) {
    const y = chrome.footerY;
    if (colors.fill) {
      ctx.fillStyle = colors.fill;
      ctx.fillRect(0, y, POSTER_SIZE, CL.footerH);
    }
    applyChromeShadow(ctx, colors.shadow);
    ctx.fillStyle = colors.text;
    ctx.font = `600 ${CL.appNameFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(APP_NAME, CL.appNameX, y + CL.footerH / 2);
    ctx.font = `400 ${CL.attribFont}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - CL.attribMarginX, y + CL.footerH / 2);
    ctx.textAlign = 'left';
    applyChromeShadow(ctx, false);
  } else if (!showFooter) {
    // Attribution is legally required even without the branding band — draw a minimal credit
    // with a subtle backing strip for legibility. Always at the bottom, at NORMAL size (uses `L`,
    // not `CL`), and unaffected by footerPosition/chromeStyle/chromeSize — a deliberate
    // simplification so hiding the footer's content can never also relocate the legally-required
    // attribution somewhere unexpected.
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

(`L` here is still the module-level `const L = POSTER_LAYOUT;` alias already at the top of the file — untouched. Note the QR block's `qrY` now subtracts `chrome.bottomOccupied` instead of the old hardcoded `L.footerH`; with default options `chrome.bottomOccupied === CL.footerH === L.footerH`, so this is a behavior-preserving generalization, not yet the full corner-aware logic — Task 4 finishes that.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: PASS (every pre-existing test in the file — none of their assertions depended on values that changed under default options — plus all new tests from Task 2 and this task)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: dynamic header/footer band position and style presets in drawPosterOverlay"
```

---

### Task 4: `posterCanvas.ts` — QR corner placement

**Files:**
- Modify: `src/features/venues/posterCanvas.ts`
- Modify: `src/features/venues/posterCanvas.test.ts`

**Interfaces:**
- Consumes: `chrome.topOccupied`/`chrome.bottomOccupied` from `computeChromeLayout` (Task 2); `QrCorner` type (Task 1).
- Produces: `PosterOverlayOptions` gains `qrCorner?: QrCorner` (defaults to `'bottom-right'`, reproducing today's exact QR position).

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/posterCanvas.test.ts`, add to the `describe('drawPosterOverlay', ...)` block, before its closing `});`:

```ts
  it('places the QR in the requested corner, clearing whichever band occupies that edge', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', qrImg, qrCorner: 'top-left', showFooter: false,
    });
    // top-left: x = qrMargin = 28; header occupies the top edge (headerH=190), so
    // y = topOccupied(190) + qrMargin(28) = 218.
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 28, 218, 150, 150);
  });

  it('clears the minimal attribution strip when the QR shares the bottom edge and the footer is hidden', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', qrImg, qrCorner: 'bottom-right', showFooter: false,
    });
    // showFooter false: chrome.bottomOccupied is 0 (footer isn't a "band" when hidden), but the
    // minimal attribution strip (minAttribStripH=26) still occupies the bottom edge, so the QR
    // must clear it: y = POSTER_SIZE - qrSize - qrMargin - minAttribStripH = 1080-150-28-26 = 876.
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 876, 150, 150);
  });

  it('defaults to the bottom-right corner, reproducing today\'s QR position', () => {
    const ctx = makeCtx();
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', qrImg,
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(qrImg, 1080 - 150 - 28, 856, 150, 150);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: FAIL — the `'top-left'` test fails (QR still drawn bottom-right regardless of `qrCorner`), and the "clears the minimal attribution strip" test fails (current code only subtracts `chrome.bottomOccupied`, which is `0` when the footer is hidden, ignoring the strip entirely — its `y` would come out as `1080-150-28=902`, not `876`). The default-corner test passes already (no regression risk to watch for, but included for completeness).

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/posterCanvas.ts`, add `qrCorner` to `PosterOverlayOptions`:

```ts
  headerPosition?: ChromePosition;
  footerPosition?: ChromePosition;
  chromeStyle?: ChromeStyle;
  chromeSize?: ChromeSize;
}
```

becomes:

```ts
  headerPosition?: ChromePosition;
  footerPosition?: ChromePosition;
  chromeStyle?: ChromeStyle;
  chromeSize?: ChromeSize;
  qrCorner?: QrCorner;
}
```

Add `QrCorner` to the `./posterLayout` import:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor,
  type ChromePosition, type ChromeSize, type ChromeStyle,
} from './posterLayout';
```

becomes:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor,
  type ChromePosition, type ChromeSize, type ChromeStyle, type QrCorner,
} from './posterLayout';
```

Update the destructure to read `qrCorner` (default `'bottom-right'`):

```ts
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution, qrImg,
    showHeader = true, showFooter = true,
    headerPosition = 'top', footerPosition = 'bottom',
    chromeStyle = 'solid', chromeSize = 'normal',
  } = opts;
```

becomes:

```ts
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution, qrImg,
    showHeader = true, showFooter = true,
    headerPosition = 'top', footerPosition = 'bottom',
    chromeStyle = 'solid', chromeSize = 'normal', qrCorner = 'bottom-right',
  } = opts;
```

Finally, replace the QR block:

```ts
  // QR sits bottom-right, inset above the footer band area — Task 4 replaces this fixed corner
  // with the admin-chosen one.
  if (qrImg) {
    const qrX = POSTER_SIZE - CL.qrSize - CL.qrMargin;
    const qrY = POSTER_SIZE - CL.qrSize - CL.qrMargin - chrome.bottomOccupied;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - CL.qrPad, qrY - CL.qrPad, CL.qrSize + CL.qrPad * 2, CL.qrSize + CL.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, CL.qrSize, CL.qrSize);
  }
```

with:

```ts
  if (qrImg) {
    const isTop = qrCorner.startsWith('top');
    const isLeft = qrCorner.endsWith('left');
    // The minimal attribution strip (drawn below, when !showFooter) occupies the bottom edge too,
    // even though it isn't tracked by computeChromeLayout — the QR must clear it as well.
    const bottomOccupied = chrome.bottomOccupied + (!showFooter ? L.minAttribStripH : 0);
    const occupied = isTop ? chrome.topOccupied : bottomOccupied;
    const qrX = isLeft ? CL.qrMargin : POSTER_SIZE - CL.qrSize - CL.qrMargin;
    const qrY = isTop ? occupied + CL.qrMargin : POSTER_SIZE - occupied - CL.qrSize - CL.qrMargin;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - CL.qrPad, qrY - CL.qrPad, CL.qrSize + CL.qrPad * 2, CL.qrSize + CL.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, CL.qrSize, CL.qrSize);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: PASS (all tests, including the 3 new ones and every test from Tasks 2-3)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: add 4-corner QR placement, clearing bands and the attribution strip"
```

---

### Task 5: `cantonPoster.ts` — thread the new options through generation

**Files:**
- Modify: `src/features/venues/cantonPoster.ts`
- Modify: `src/features/venues/cantonPoster.test.ts`

**Interfaces:**
- Consumes: `PosterOverlayOptions`'s new fields from `./posterCanvas` (Tasks 3-4); `ChromePosition`, `ChromeStyle`, `ChromeSize`, `QrCorner` from `./posterLayout` (Task 1).
- Produces: `GeneratePosterOptions` gains `headerPosition?`, `footerPosition?`, `chromeStyle?`, `chromeSize?`, `qrCorner?` (all optional, forwarded as-is to `drawPosterOverlay` — no defaulting needed here since `drawPosterOverlay` already defaults each one). Task 7 (`PosterEditorModal.tsx`) passes them explicitly.

- [ ] **Step 1: Write the failing test**

In `src/features/venues/cantonPoster.test.ts`, add to the `describe('generateCantonPosterBlob', ...)` block, before its closing `});`:

```ts
  it('forwards the chrome position/style/size and QR corner options to drawPosterOverlay', async () => {
    await generateCantonPosterBlob('BE', venues, {
      baseKind: 'map', unitLabel: 'Schwingkeller',
      headerPosition: 'bottom', footerPosition: 'top', chromeStyle: 'light', chromeSize: 'compact',
      qrCorner: 'top-left',
    });

    expect(drawPosterOverlayMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      headerPosition: 'bottom', footerPosition: 'top', chromeStyle: 'light', chromeSize: 'compact',
      qrCorner: 'top-left',
    }));
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: FAIL — `generateCantonPosterBlob` doesn't accept these options (TypeScript will flag the extra properties, and at runtime `drawPosterOverlayMock` is never called with them since `GeneratePosterOptions` doesn't destructure or forward them yet).

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/cantonPoster.ts`, add the import:

```ts
import { cantonByCode, wappenUrl } from '../../data/cantons';
```

stays as-is; instead update the `./posterLayout`-adjacent import area. Since this file currently has no import from `./posterLayout`, add one right after the `./posterCanvas` import:

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
import type { ChromePosition, ChromeStyle, ChromeSize, QrCorner } from './posterLayout';
```

Update `GeneratePosterOptions`:

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
  headerPosition?: ChromePosition;
  footerPosition?: ChromePosition;
  chromeStyle?: ChromeStyle;
  chromeSize?: ChromeSize;
  qrCorner?: QrCorner;
}
```

Update the destructure:

```ts
  const { baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl } = options;
```

becomes:

```ts
  const {
    baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl,
    headerPosition, footerPosition, chromeStyle, chromeSize, qrCorner,
  } = options;
```

And update the `drawPosterOverlay` call:

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

becomes:

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
      headerPosition,
      footerPosition,
      chromeStyle,
      chromeSize,
      qrCorner,
    });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: PASS (the new test, plus every pre-existing test — they never pass the new options, so `drawPosterOverlay` receives `undefined` for each, which its own defaults in Tasks 3-4 already handle)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/cantonPoster.ts src/features/venues/cantonPoster.test.ts
git commit -m "feat: thread chrome position/style/size and QR corner through poster generation"
```

---

### Task 6: i18n keys for the new controls

**Files:**
- Modify: `src/i18n/translations.ts`

**Interfaces:**
- Produces: `t.posterHeaderPositionLabel`, `t.posterFooterPositionLabel`, `t.posterPositionTop`, `t.posterPositionBottom`, `t.posterStyleLabel`, `t.posterStyleSolid`, `t.posterStyleTransparent`, `t.posterStyleLight`, `t.posterSizeLabel`, `t.posterSizeNormal`, `t.posterSizeCompact`, `t.posterQrCornerLabel`, `t.posterQrCornerTopLeft`, `t.posterQrCornerTopRight`, `t.posterQrCornerBottomLeft`, `t.posterQrCornerBottomRight` — 16 keys, each in `de`/`fr`/`it`. Task 7 consumes all of them.

- [ ] **Step 1: Add the keys to all three languages**

This is plain data — no test cycle (there's no dedicated i18n-completeness test in this codebase; `STR`'s shape is enforced structurally by every later task's TypeScript usage, which will fail to compile if a key is missing in any language once Task 7 references `t.posterStyleLabel` etc.).

In `src/i18n/translations.ts`, in the `de` block, replace:

```ts
    posterToggleQr: 'QR-Code',
    posterResetFraming: 'Ausschnitt zurücksetzen',
```

with:

```ts
    posterToggleQr: 'QR-Code',
    posterHeaderPositionLabel: 'Kopfzeile-Position',
    posterFooterPositionLabel: 'Fusszeile-Position',
    posterPositionTop: 'Oben',
    posterPositionBottom: 'Unten',
    posterStyleLabel: 'Stil',
    posterStyleSolid: 'Deckend',
    posterStyleTransparent: 'Transparent',
    posterStyleLight: 'Hell',
    posterSizeLabel: 'Grösse',
    posterSizeNormal: 'Normal',
    posterSizeCompact: 'Kompakt',
    posterQrCornerLabel: 'QR-Ecke',
    posterQrCornerTopLeft: 'Oben links',
    posterQrCornerTopRight: 'Oben rechts',
    posterQrCornerBottomLeft: 'Unten links',
    posterQrCornerBottomRight: 'Unten rechts',
    posterResetFraming: 'Ausschnitt zurücksetzen',
```

In the `fr` block, replace:

```ts
    posterToggleQr: 'Code QR',
    posterResetFraming: 'Réinitialiser le cadrage',
```

with:

```ts
    posterToggleQr: 'Code QR',
    posterHeaderPositionLabel: 'Position de l’en-tête',
    posterFooterPositionLabel: 'Position du pied de page',
    posterPositionTop: 'Haut',
    posterPositionBottom: 'Bas',
    posterStyleLabel: 'Style',
    posterStyleSolid: 'Opaque',
    posterStyleTransparent: 'Transparent',
    posterStyleLight: 'Clair',
    posterSizeLabel: 'Taille',
    posterSizeNormal: 'Normal',
    posterSizeCompact: 'Compact',
    posterQrCornerLabel: 'Coin du QR',
    posterQrCornerTopLeft: 'Haut gauche',
    posterQrCornerTopRight: 'Haut droite',
    posterQrCornerBottomLeft: 'Bas gauche',
    posterQrCornerBottomRight: 'Bas droite',
    posterResetFraming: 'Réinitialiser le cadrage',
```

In the `it` block, replace:

```ts
    posterToggleQr: 'Codice QR',
    posterResetFraming: 'Reimposta inquadratura',
```

with:

```ts
    posterToggleQr: 'Codice QR',
    posterHeaderPositionLabel: 'Posizione intestazione',
    posterFooterPositionLabel: 'Posizione piè di pagina',
    posterPositionTop: 'Alto',
    posterPositionBottom: 'Basso',
    posterStyleLabel: 'Stile',
    posterStyleSolid: 'Pieno',
    posterStyleTransparent: 'Trasparente',
    posterStyleLight: 'Chiaro',
    posterSizeLabel: 'Dimensione',
    posterSizeNormal: 'Normale',
    posterSizeCompact: 'Compatto',
    posterQrCornerLabel: 'Angolo QR',
    posterQrCornerTopLeft: 'Alto sinistra',
    posterQrCornerTopRight: 'Alto destra',
    posterQrCornerBottomLeft: 'Basso sinistra',
    posterQrCornerBottomRight: 'Basso destra',
    posterResetFraming: 'Reimposta inquadratura',
```

- [ ] **Step 2: Verify the file still type-checks**

Run: `npx tsc -b --noEmit`
Expected: no new errors (this step alone doesn't reference the keys anywhere yet, so nothing can fail — this is just a sanity check that the object literals are syntactically valid).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add i18n keys for poster header/footer position, style, size, and QR corner"
```

---

### Task 7: `PosterEditorModal.tsx` — controls, state, and `download()` wiring

**Files:**
- Modify: `src/features/venues/PosterEditorModal.tsx`
- Modify: `src/features/venues/PosterEditorModal.test.tsx`

**Interfaces:**
- Consumes: `ChromePosition`, `ChromeStyle`, `ChromeSize`, `QrCorner` from `./posterLayout` (Task 1); `GeneratePosterOptions`'s new fields (Task 5); the 16 new i18n keys (Task 6).
- Produces: new `headerPosition`, `footerPosition`, `chromeStyle`, `chromeSize`, `qrCorner` state, forwarded to `generateCantonPosterBlob` — Task 8 reads this same state to drive the DOM preview's visual chrome.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/PosterEditorModal.test.tsx`, add a new `describe` block at the end of the file, after the closing `});` of `describe('PosterEditorModal', ...)`:

```tsx
describe('header/footer customization controls', () => {
  beforeEach(() => { generateCantonPosterBlob.mockClear(); });

  it('renders position, style, size, and QR-corner controls with today\'s defaults selected', () => {
    renderEditor();
    // Both the header-position and footer-position pickers render a "Oben" (Top) button, so this
    // just confirms both pickers are present rather than asserting on a single ambiguous match.
    expect(screen.getAllByRole('button', { name: STR.de.posterPositionTop })).toHaveLength(2);
    expect(screen.getByRole('button', { name: STR.de.posterStyleSolid })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: STR.de.posterSizeNormal })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: STR.de.posterQrCornerBottomRight })).toHaveAttribute('aria-pressed', 'true');
  });

  it('forwards the current header/footer/style/size/QR-corner selections to generateCantonPosterBlob', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: STR.de.posterStyleTransparent }));
    await user.click(screen.getByRole('button', { name: STR.de.posterSizeCompact }));
    await user.click(screen.getByRole('button', { name: STR.de.posterQrCornerTopLeft }));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));

    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2]).toMatchObject({
      chromeStyle: 'transparent', chromeSize: 'compact', qrCorner: 'top-left',
      headerPosition: 'top', footerPosition: 'bottom',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: FAIL — none of the new controls exist yet, and `generateCantonPosterBlob` is never called with `chromeStyle`/`chromeSize`/`qrCorner`/`headerPosition`/`footerPosition`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/PosterEditorModal.tsx`, update the import from `./posterLayout`:

```ts
import { POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin } from './posterLayout';
```

becomes:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin,
  type ChromePosition, type ChromeStyle, type ChromeSize, type QrCorner,
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
  const [headerPosition, setHeaderPosition] = useState<ChromePosition>('top');
  const [footerPosition, setFooterPosition] = useState<ChromePosition>('bottom');
  const [chromeStyle, setChromeStyle] = useState<ChromeStyle>('solid');
  const [chromeSize, setChromeSize] = useState<ChromeSize>('normal');
  const [qrCorner, setQrCorner] = useState<QrCorner>('bottom-right');
  const [busy, setBusy] = useState(false);
```

Update `download()`. Replace:

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
        headerPosition,
        footerPosition,
        chromeStyle,
        chromeSize,
        qrCorner,
      });
```

Add a reusable segmented-control helper, right after the existing `toggle` helper function (before the `return (` that starts the JSX):

```ts
  const segmented = <T extends string>(
    key: string, label: string, options: readonly T[], value: T, set: (v: T) => void, labelFor: (v: T) => string,
  ) => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <span style={fieldLabel}>{label}</span>
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.paper, borderRadius: '999px', padding: '4px', gap: '2px', flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <button key={opt} type="button" aria-pressed={value === opt} onClick={() => set(opt)}
            style={{ border: 'none', borderRadius: '999px', padding: '7px 14px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease', background: value === opt ? theme.color.bg : 'transparent', color: value === opt ? theme.color.ink : theme.color.muted, boxShadow: value === opt ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
            {labelFor(opt)}
          </button>
        ))}
      </div>
    </div>
  );
```

Replace the existing hand-written Map/Satellite block (now redundant with `segmented()`):

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
              {toggle('footer', t.posterToggleFooter, showFooter, setShowFooter)}
              {toggle('qr', t.posterToggleQr, showQr, setShowQr)}
            </div>
```

with:

```tsx
            {segmented('base', t.posterBaseLabel, ['map', 'sat'] as const, baseKind, setBaseKind,
              (k) => (k === 'map' ? t.mapView : t.satView))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
              {segmented('headerPos', t.posterHeaderPositionLabel, ['top', 'bottom'] as const, headerPosition, setHeaderPosition,
                (p) => (p === 'top' ? t.posterPositionTop : t.posterPositionBottom))}
              {toggle('footer', t.posterToggleFooter, showFooter, setShowFooter)}
              {segmented('footerPos', t.posterFooterPositionLabel, ['top', 'bottom'] as const, footerPosition, setFooterPosition,
                (p) => (p === 'top' ? t.posterPositionTop : t.posterPositionBottom))}
              {toggle('qr', t.posterToggleQr, showQr, setShowQr)}
              {segmented('qrCorner', t.posterQrCornerLabel,
                ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const, qrCorner, setQrCorner,
                (c) => ({
                  'top-left': t.posterQrCornerTopLeft, 'top-right': t.posterQrCornerTopRight,
                  'bottom-left': t.posterQrCornerBottomLeft, 'bottom-right': t.posterQrCornerBottomRight,
                }[c]))}
            </div>

            {segmented('style', t.posterStyleLabel, ['solid', 'transparent', 'light'] as const, chromeStyle, setChromeStyle,
              (s) => ({ solid: t.posterStyleSolid, transparent: t.posterStyleTransparent, light: t.posterStyleLight }[s]))}

            {segmented('size', t.posterSizeLabel, ['normal', 'compact'] as const, chromeSize, setChromeSize,
              (s) => (s === 'normal' ? t.posterSizeNormal : t.posterSizeCompact))}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: PASS (all pre-existing tests — the Map/Satellite toggle behaves identically after being rebuilt on `segmented()`, since it renders the same button markup with the same `aria-pressed`/`onClick` semantics — plus the 2 new tests in this task)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/PosterEditorModal.tsx src/features/venues/PosterEditorModal.test.tsx
git commit -m "feat: add header/footer position, style, size, and QR-corner controls to the poster editor"
```

---

### Task 8: `PosterEditorModal.tsx` — DOM preview chrome parity

**Files:**
- Modify: `src/features/venues/PosterEditorModal.tsx`
- Modify: `src/features/venues/PosterEditorModal.test.tsx`

**Interfaces:**
- Consumes: `computeChromeLayout`, `CHROME_STYLE_COLORS` from `./posterCanvas` (Tasks 2-3); `chromeLayoutFor` from `./posterLayout` (Task 1); `headerPosition`/`footerPosition`/`chromeStyle`/`chromeSize`/`qrCorner` state (Task 7).
- Produces: nothing consumed by other tasks — this is the last poster-editor task.

- [ ] **Step 1: Write the failing test**

In `src/features/venues/PosterEditorModal.test.tsx`, add to the `describe('header/footer customization controls', ...)` block, before its closing `});`:

```tsx
  it('positions the DOM preview header/footer to match computeChromeLayout for a non-default combination', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: STR.de.posterSizeCompact }));
    // Both the header-position and footer-position pickers have a "Oben" (Top) button, so the
    // plain screen-wide query would match two elements — scope it to the footer picker via its
    // preceding label instead.
    const footerPositionGroup = screen.getByText(STR.de.posterFooterPositionLabel).parentElement as HTMLElement;
    await user.click(within(footerPositionGroup).getByRole('button', { name: STR.de.posterPositionTop }));

    // Both header and footer now share the top edge (header stacked closer to it) at compact
    // size. `cqw()` renders a CSS container-query-width unit string, not a pixel value, so compute
    // the expected style with the same functions the component uses rather than hand-computing a
    // decimal string (which would be brittle against floating-point stringification).
    const expected = computeChromeLayout({
      showHeader: true, showFooter: true, headerPosition: 'top', footerPosition: 'top',
      chromeSize: 'compact', posterHeight: POSTER_SIZE,
    });
    const header = screen.getByTestId('poster-preview-header');
    const footer = screen.getByTestId('poster-preview-footer');
    expect(header).toHaveStyle({ top: cqw(expected.headerY as number) });
    expect(footer).toHaveStyle({ top: cqw(expected.footerY as number) });
  });
```

This test needs three additions to the top of the file: `within` from `@testing-library/react` (`import { render, screen, waitFor } from '@testing-library/react';` becomes `import { render, screen, waitFor, within } from '@testing-library/react';`), and two new imports of real (unmocked) modules — `computeChromeLayout` has no Leaflet dependency, so importing it directly alongside the file's existing `leaflet` mock is safe:

```ts
import { computeChromeLayout } from './posterCanvas';
import { cqw, POSTER_SIZE } from './posterLayout';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: FAIL — `getByTestId('poster-preview-header')`/`'poster-preview-footer'` find nothing yet (the current header/footer `<div>`s have no `data-testid`), and the preview still uses the old static `top: 0` / `bottom: 0` styling regardless of `chromeSize`/`headerPosition`/`footerPosition`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/PosterEditorModal.tsx`, update the import from `./posterCanvas`:

```ts
import { generateCantonPosterBlob } from './cantonPoster';
```

becomes:

```ts
import { generateCantonPosterBlob } from './cantonPoster';
import { computeChromeLayout, CHROME_STYLE_COLORS } from './posterCanvas';
```

and update the `./posterLayout` import to bring in `chromeLayoutFor`:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin,
  type ChromePosition, type ChromeStyle, type ChromeSize, type QrCorner,
} from './posterLayout';
```

becomes:

```ts
import {
  POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin, chromeLayoutFor,
  type ChromePosition, type ChromeStyle, type ChromeSize, type QrCorner,
} from './posterLayout';
```

Right before the `return (` that starts the JSX, compute the chrome layout and style colors for the current render (these are cheap pure-function calls, safe to recompute every render):

```ts
  const CL = chromeLayoutFor(chromeSize);
  const chrome = computeChromeLayout({
    showHeader, showFooter, headerPosition, footerPosition, chromeSize, posterHeight: POSTER_SIZE,
  });
  const chromeColors = CHROME_STYLE_COLORS[chromeStyle];
  const bandTextStyle: React.CSSProperties = {
    color: chromeColors.text,
    textShadow: chromeColors.shadow ? '0 1px 4px rgba(0,0,0,0.6)' : 'none',
  };
```

Replace the `band` style object (it no longer hardcodes `background`/`color`, since those now vary by style — the two now come from `chromeColors` and are applied per-element at each usage site):

```ts
  const band: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0, background: 'rgba(17,17,17,0.72)',
    color: theme.color.bg, zIndex: 800, pointerEvents: 'none', display: 'flex', alignItems: 'center',
  };
```

becomes:

```ts
  const band: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0,
    zIndex: 800, pointerEvents: 'none', display: 'flex', alignItems: 'center',
  };
```

Now replace the header/QR/footer JSX block:

```tsx
            {showHeader && (
              <div style={{ ...band, top: 0, height: cqw(PL.headerH), gap: cqw(PL.wappenGap), paddingLeft: cqw(PL.padX), paddingRight: cqw(PL.padX) }}>
                <img src={wappenUrl(code)} alt="" style={{ width: cqw(PL.wappenW), height: cqw(PL.wappenH), objectFit: 'contain', flex: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: cqw(PL.titleGap), minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font.display, fontWeight: 700, textTransform: 'uppercase', fontSize: cqw(PL.titleFont), lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || canton?.name}
                  </div>
                  <span style={{ alignSelf: 'flex-start', fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk, background: theme.color.accent, fontSize: cqw(PL.pillFont), height: cqw(PL.pillH), lineHeight: cqw(PL.pillH), padding: `0 ${cqw(PL.pillPadX)}`, borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {cantonVenues.length} {unitLabel}
                  </span>
                </div>
              </div>
            )}
            {showQr && qrDataUrl && (
              <img src={qrDataUrl} alt="QR" style={{ position: 'absolute', right: cqw(PL.qrMargin), bottom: cqw(PL.qrMargin + PL.footerH), width: cqw(PL.qrSize), height: cqw(PL.qrSize), background: theme.color.bg, padding: cqw(PL.qrPad), borderRadius: '3px', zIndex: 800, pointerEvents: 'none' }} />
            )}
            {showFooter ? (
              <div style={{ ...band, bottom: 0, height: cqw(PL.footerH), justifyContent: 'space-between', paddingLeft: cqw(PL.appNameX), paddingRight: cqw(PL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: cqw(PL.appNameFont), whiteSpace: 'nowrap' }}>Schwingkeller Schweiz</span>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(PL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            ) : (
              <div style={{ ...band, bottom: 0, height: cqw(PL.minAttribStripH), background: 'rgba(17,17,17,0.55)', justifyContent: 'flex-end', paddingRight: cqw(PL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(PL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            )}
```

with:

```tsx
            {showHeader && chrome.headerY !== null && (
              <div data-testid="poster-preview-header" style={{ ...band, top: cqw(chrome.headerY), height: cqw(CL.headerH), background: chromeColors.fill ?? 'transparent', ...bandTextStyle, gap: cqw(CL.wappenGap), paddingLeft: cqw(CL.padX), paddingRight: cqw(CL.padX) }}>
                <img src={wappenUrl(code)} alt="" style={{ width: cqw(CL.wappenW), height: cqw(CL.wappenH), objectFit: 'contain', flex: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: cqw(CL.titleGap), minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font.display, fontWeight: 700, textTransform: 'uppercase', fontSize: cqw(CL.titleFont), lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || canton?.name}
                  </div>
                  <span style={{ alignSelf: 'flex-start', fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk, background: theme.color.accent, fontSize: cqw(CL.pillFont), height: cqw(CL.pillH), lineHeight: cqw(CL.pillH), padding: `0 ${cqw(CL.pillPadX)}`, borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {cantonVenues.length} {unitLabel}
                  </span>
                </div>
              </div>
            )}
            {showQr && qrDataUrl && (() => {
              const isTop = qrCorner.startsWith('top');
              const isLeft = qrCorner.endsWith('left');
              const bottomOccupied = chrome.bottomOccupied + (!showFooter ? PL.minAttribStripH : 0);
              const occupied = isTop ? chrome.topOccupied : bottomOccupied;
              return (
                <img src={qrDataUrl} alt="QR" style={{
                  position: 'absolute',
                  [isLeft ? 'left' : 'right']: cqw(CL.qrMargin),
                  [isTop ? 'top' : 'bottom']: cqw(occupied + CL.qrMargin),
                  width: cqw(CL.qrSize), height: cqw(CL.qrSize), background: theme.color.bg,
                  padding: cqw(CL.qrPad), borderRadius: '3px', zIndex: 800, pointerEvents: 'none',
                } as React.CSSProperties} />
              );
            })()}
            {showFooter && chrome.footerY !== null ? (
              <div data-testid="poster-preview-footer" style={{ ...band, top: cqw(chrome.footerY), height: cqw(CL.footerH), background: chromeColors.fill ?? 'transparent', ...bandTextStyle, justifyContent: 'space-between', paddingLeft: cqw(CL.appNameX), paddingRight: cqw(CL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: cqw(CL.appNameFont), whiteSpace: 'nowrap' }}>Schwingkeller Schweiz</span>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(CL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            ) : (
              <div style={{ ...band, bottom: 0, height: cqw(PL.minAttribStripH), background: 'rgba(17,17,17,0.55)', color: theme.color.bg, justifyContent: 'flex-end', paddingRight: cqw(PL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(PL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            )}
```

(The minimal-attribution-strip branch keeps using `PL` directly, unchanged — same "always normal size, always bottom" rule as the canvas capture. Its own `color: theme.color.bg` is now set explicitly since `band` no longer carries a default color.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: PASS (the new test, plus every pre-existing test in the file — the default-options render produces `chrome.headerY === 0` and `chrome.footerY === POSTER_SIZE - PL.footerH`, i.e. the same positions the old hardcoded `top:0`/`bottom:0` styling produced, so nothing about the default appearance changes)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/PosterEditorModal.tsx src/features/venues/PosterEditorModal.test.tsx
git commit -m "feat: make the poster editor's DOM preview chrome match computeChromeLayout"
```

---

### Task 9: Full verification and manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including every file touched across Tasks 1-8 and every other existing suite (unaffected by this change).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the type checker**

Run: `npm run typecheck`
Expected: no errors (in particular: the `segmented()` generic helper's type parameter resolves correctly for every call site — `BaseKind`, `ChromePosition`, `ChromeStyle`, `ChromeSize`, `QrCorner` — and the computed-property-name QR `<img>` style object satisfies `React.CSSProperties`).

- [ ] **Step 4: Manual verification in the dev server**

Run: `npm run dev`, open the app, log in as admin, and open the poster editor (per `docs/superpowers/specs/2026-07-21-poster-header-footer-customization-design.md`'s "Verification before shipping" section) for a canton with several venues:
- confirm the all-default combination (Solid, Normal, header-top, footer-bottom, QR bottom-right) produces an export pixel-identical in layout to today's output,
- set both header and footer position to the same edge and confirm they stack without overlapping, in both the live preview and the downloaded PNG,
- cycle through all three styles (Solid, Transparent, Light) and confirm Transparent text stays legible (via the drop-shadow) over both the map and satellite base layers,
- switch to Compact and confirm the band height, fonts, Wappen, pill, and QR all shrink together, while venue pins stay full-size,
- cycle the QR through all 4 corners, including a combination where a band or the minimal attribution strip shares its edge, and confirm no overlap in either the preview or the export.

- [ ] **Step 5: Commit any fixups found during manual verification**

If manual verification surfaces an issue, fix it, re-run Steps 1-3, and commit:

```bash
git add -A
git commit -m "fix: address manual verification findings for poster header/footer customization"
```

If no issues are found, skip this step — Task 8's commit is the final commit for this plan.
