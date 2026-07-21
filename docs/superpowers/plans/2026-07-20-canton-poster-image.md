# Canton Poster Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin generate a downloadable 1080×1080 PNG for a single canton — the real map (current base layer), framed like the `?ctn=` permalink, with that canton's venues plotted as pins, plus canton name/Wappen/count/branding overlay — for posting on social media.

**Architecture:** An off-screen Leaflet map instance is flown to the canton's existing bounds (`boundsForCanton`), its rendered tiles are read directly off the DOM and redrawn onto an output `<canvas>` (both current tile providers — OSM and Esri — are confirmed CORS-safe for this), pins are placed via Leaflet's own `latLngToContainerPoint` projection, and branding is drawn on top. The result is shown in a preview modal before the admin saves it. Trigger is a new admin-only icon on each canton row in the sidebar.

**Tech Stack:** React 19, TypeScript, Leaflet (already a dependency), native Canvas/Image/fetch APIs, Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies — everything uses Leaflet (already installed) and native browser APIs.
- No `any` in TypeScript — use proper types, `unknown` with a cast, or minimal custom interfaces.
- All user-facing strings go through the i18n layer (`STR` in `src/i18n/translations.ts`); keep DE/FR/IT in sync — the parity test in `src/i18n/translations.test.ts` fails if any language is missing a key.
- TDD: write the failing test first, watch it fail, then implement.
- Run `npm run test` and `npm run lint` before considering the work complete. If `node_modules` isn't present yet, run `npm install` first.
- Conventional Commits for messages. Work stays on branch `claude/session-yz9uhf`.
- Feature is admin-only, gated by the existing `useAuth().isAdmin`.

## File Structure

- `src/features/map/tileLayers.ts` (new) — shared tile-layer construction (URL/attribution/maxZoom per base layer), extracted out of `MapView.tsx` so the live map and the off-screen capture map can't drift apart.
- `src/features/map/tileLayers.test.ts` (new)
- `src/features/map/MapView.tsx` (modify) — use the extracted helper instead of inlining tile-layer construction.
- `src/i18n/translations.ts` (modify) — 4 new keys × 3 languages.
- `src/i18n/translations.test.ts` (modify) — parity assertion for the new keys.
- `src/features/venues/posterCanvas.ts` (new) — pure/DOM canvas-drawing helpers, no Leaflet dependency.
- `src/features/venues/posterCanvas.test.ts` (new)
- `src/features/venues/cantonPoster.ts` (new) — off-screen Leaflet capture orchestration.
- `src/features/venues/cantonPoster.test.ts` (new) — orchestration tested against a mocked `leaflet` module and mocked `posterCanvas` (the real drawing logic is already covered by `posterCanvas.test.ts`).
- `src/features/venues/PosterPreviewModal.tsx` (new) — preview UI with Save/Close.
- `src/features/venues/PosterPreviewModal.test.tsx` (new)
- `src/features/sidebar/Sidebar.tsx` (modify) — admin-only generate-poster icon per canton row.
- `src/features/sidebar/Sidebar.test.tsx` (modify)
- `src/App.tsx` (modify) — state, `generatePoster`/`savePoster` handlers, `downloadBlob` helper, wiring, renders `PosterPreviewModal`. No dedicated test file (matches existing convention — `App.tsx` has no `App.test.tsx` today); verified via the full suite + manual smoke test in the final task.

---

### Task 1: Extract shared tile-layer helper; refactor `MapView` to use it

**Files:**
- Create: `src/features/map/tileLayers.ts`
- Create: `src/features/map/tileLayers.test.ts`
- Modify: `src/features/map/MapView.tsx:119-131` (the `setTile` function) and its imports

**Interfaces:**
- Produces: `type BaseKind = 'map' | 'sat'`; `TILE_URLS: Record<BaseKind, string>`; `TILE_MAX_ZOOM: Record<BaseKind, number>`; `TILE_ATTRIBUTION: Record<BaseKind, string>`; `createTileLayer(kind: BaseKind): L.TileLayer`. Consumed by Task 5 (`cantonPoster.ts`) for both the tile layer itself and the attribution text baked into the poster overlay.

- [ ] **Step 1: Write the failing test**

Create `src/features/map/tileLayers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createTileLayer, TILE_URLS, TILE_ATTRIBUTION, TILE_MAX_ZOOM } from './tileLayers';

describe('TILE_URLS', () => {
  it('points at the OSM and Esri tile endpoints already used by the app', () => {
    expect(TILE_URLS.map).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(TILE_URLS.sat).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    );
  });
});

describe('createTileLayer', () => {
  it('builds the street layer with the OSM attribution and max zoom', () => {
    const layer = createTileLayer('map');
    expect(layer.options.attribution).toBe(TILE_ATTRIBUTION.map);
    expect(layer.options.maxZoom).toBe(TILE_MAX_ZOOM.map);
  });

  it('builds the satellite layer with the Esri attribution and max zoom', () => {
    const layer = createTileLayer('sat');
    expect(layer.options.attribution).toBe(TILE_ATTRIBUTION.sat);
    expect(layer.options.maxZoom).toBe(TILE_MAX_ZOOM.sat);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/map/tileLayers.test.ts`
Expected: FAIL — `./tileLayers` doesn't exist yet.

- [ ] **Step 3: Implement `tileLayers.ts`**

Create `src/features/map/tileLayers.ts`:

```ts
import L from 'leaflet';

export type BaseKind = 'map' | 'sat';

export const TILE_URLS: Record<BaseKind, string> = {
  map: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export const TILE_MAX_ZOOM: Record<BaseKind, number> = { map: 19, sat: 18 };

export const TILE_ATTRIBUTION: Record<BaseKind, string> = {
  map: '© OpenStreetMap contributors',
  sat: '© Esri, Maxar, Earthstar Geographics',
};

export const createTileLayer = (kind: BaseKind): L.TileLayer =>
  L.tileLayer(TILE_URLS[kind], { attribution: TILE_ATTRIBUTION[kind], maxZoom: TILE_MAX_ZOOM[kind] });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/map/tileLayers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `MapView.tsx` to use the shared helper**

In `src/features/map/MapView.tsx`, add the import alongside the existing ones (near line 9):

```tsx
import { createTileLayer } from './tileLayers';
```

Replace the `setTile` function (currently lines 119-131):

```tsx
  const setTile = (kind: 'map' | 'sat') => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    if (kind === 'sat') {
      tileRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 18 });
      tileRef.current.addTo(map); tileRef.current.bringToBack();
    } else {
      tileRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 });
      tileRef.current.addTo(map); tileRef.current.bringToBack();
    }
    const pane = map.getPane('tilePane'); if (pane) pane.style.filter = 'none';
  };
```

with:

```tsx
  const setTile = (kind: 'map' | 'sat') => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    tileRef.current = createTileLayer(kind);
    tileRef.current.addTo(map); tileRef.current.bringToBack();
    const pane = map.getPane('tilePane'); if (pane) pane.style.filter = 'none';
  };
```

- [ ] **Step 6: Verify nothing broke**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: all pass — `MapView.tsx` has no dedicated test file (pre-existing project convention), so this is a compile + full-suite-regression + lint check, not a new assertion. Also start the dev server (`npm run dev`) and confirm the map/satellite toggle still switches base layers correctly, since that behavior is otherwise unverified by any automated test.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/tileLayers.ts src/features/map/tileLayers.test.ts src/features/map/MapView.tsx
git commit -m "refactor: extract shared tile-layer helper from MapView"
```

---

### Task 2: i18n keys for the poster feature

**Files:**
- Modify: `src/i18n/translations.ts`
- Modify: `src/i18n/translations.test.ts`

**Interfaces:**
- Produces: new `TKey`s `generatePoster`, `posterPreviewTitle`, `saveImage`, `posterGenerateFailed`, present in `STR.de`, `STR.fr`, `STR.it`. Consumed by Tasks 6, 7, and 8.

- [ ] **Step 1: Write the failing test**

In `src/i18n/translations.test.ts`, add inside the `describe('translations', …)` block:

```ts
  it('defines the canton-poster keys in every language', () => {
    for (const lang of LANGS) {
      expect(STR[lang].generatePoster).toBeTruthy();
      expect(STR[lang].posterPreviewTitle).toBeTruthy();
      expect(STR[lang].saveImage).toBeTruthy();
      expect(STR[lang].posterGenerateFailed).toBeTruthy();
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/i18n/translations.test.ts`
Expected: FAIL — the keys don't exist yet.

- [ ] **Step 3: Add the keys to all three languages**

In `src/i18n/translations.ts`, add to the `de` block (e.g. right after `youAreHere`):

```ts
    generatePoster: 'Bild erstellen',
    posterPreviewTitle: 'Bild-Vorschau',
    saveImage: 'Bild speichern',
    posterGenerateFailed: 'Bild konnte nicht erstellt werden',
```

Add to the `fr` block:

```ts
    generatePoster: 'Créer une image',
    posterPreviewTitle: 'Aperçu de l’image',
    saveImage: 'Enregistrer l’image',
    posterGenerateFailed: 'Impossible de créer l’image',
```

Add to the `it` block:

```ts
    generatePoster: 'Crea immagine',
    posterPreviewTitle: 'Anteprima immagine',
    saveImage: 'Salva immagine',
    posterGenerateFailed: 'Impossibile creare l’immagine',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/i18n/translations.test.ts`
Expected: PASS (both the new test and the existing parity test are green).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts src/i18n/translations.test.ts
git commit -m "feat: add i18n keys for canton poster image feature"
```

---

### Task 3: `posterCanvas.ts` — filename, off-screen container, and image-loading helpers

**Files:**
- Create: `src/features/venues/posterCanvas.ts`
- Create: `src/features/venues/posterCanvas.test.ts`

**Interfaces:**
- Produces: `POSTER_SIZE = 1080`; `posterFilename(code: string): string`; `createOffscreenContainer(size?: number): HTMLDivElement`; `loadImage(src: string, crossOrigin?: string): Promise<HTMLImageElement | null>`. Consumed by Task 4 (`POSTER_SIZE`) and Task 5 (all four).

- [ ] **Step 1: Write the failing tests**

Create `src/features/venues/posterCanvas.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage } from './posterCanvas';

describe('posterFilename', () => {
  it('lowercases the canton code into the filename', () => {
    expect(posterFilename('BE')).toBe('schwingkeller-be.png');
  });
});

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

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  src = '';
}

describe('loadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the image element once it loads', async () => {
    let created: FakeImage | undefined;
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(() => {
        created = new FakeImage();
        return created;
      }),
    );

    const promise = loadImage('https://example.com/wappen.svg', 'anonymous');
    created!.onload?.();
    const result = await promise;

    expect(result).toBe(created);
    expect(created!.crossOrigin).toBe('anonymous');
    expect(created!.src).toBe('https://example.com/wappen.svg');
  });

  it('resolves null when the image fails to load, instead of throwing', async () => {
    let created: FakeImage | undefined;
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(() => {
        created = new FakeImage();
        return created;
      }),
    );

    const promise = loadImage('https://example.com/missing.svg');
    created!.onerror?.();

    await expect(promise).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/venues/posterCanvas.test.ts`
Expected: FAIL — `./posterCanvas` doesn't exist yet.

- [ ] **Step 3: Implement the helpers**

Create `src/features/venues/posterCanvas.ts`:

```ts
export const POSTER_SIZE = 1080;

export const posterFilename = (code: string): string => `schwingkeller-${code.toLowerCase()}.png`;

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

export const loadImage = (src: string, crossOrigin?: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/venues/posterCanvas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: add poster filename/container/image-loading helpers"
```

---

### Task 4: `posterCanvas.ts` — tile-pane extraction and canvas drawing helpers

**Files:**
- Modify: `src/features/venues/posterCanvas.ts` (append to the file from Task 3)
- Modify: `src/features/venues/posterCanvas.test.ts` (append)

**Interfaces:**
- Consumes: `POSTER_SIZE` (Task 3); `theme` from `src/theme.ts` (`theme.color.accent`, `theme.color.bg`, `theme.color.ink`, `theme.color.accentInk`).
- Produces: `interface TileDraw { img: HTMLImageElement; x: number; y: number; size: number }`; `extractTileDraws(tilePane: HTMLElement): TileDraw[]`; `drawTiles(ctx: CanvasRenderingContext2D, tiles: TileDraw[]): void`; `drawPin(ctx: CanvasRenderingContext2D, x: number, y: number): void`; `interface PosterOverlayOptions { cantonName: string; wappenImg: HTMLImageElement | null; count: number; unitLabel: string; attribution: string }`; `drawPosterOverlay(ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void`. Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/venues/posterCanvas.test.ts` (add the import names to the existing top-of-file import from `./posterCanvas`, and add these new `describe` blocks):

```ts
import { extractTileDraws, drawTiles, drawPin, drawPosterOverlay } from './posterCanvas';

describe('extractTileDraws', () => {
  it('reads position and size from loaded Leaflet tile images, skipping unloaded ones', () => {
    const pane = document.createElement('div');
    pane.innerHTML = `
      <img class="leaflet-tile leaflet-tile-loaded" style="transform: translate3d(12px, 34px, 0px);" width="256" height="256" />
      <img class="leaflet-tile" style="transform: translate3d(99px, 99px, 0px);" width="256" height="256" />
    `;

    const tiles = extractTileDraws(pane);

    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ x: 12, y: 34, size: 256 });
  });

  it('returns an empty array when there are no loaded tiles', () => {
    const pane = document.createElement('div');
    expect(extractTileDraws(pane)).toEqual([]);
  });
});

describe('drawTiles', () => {
  it('draws each tile image at its recorded position and size', () => {
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    const imgA = {} as HTMLImageElement;
    const imgB = {} as HTMLImageElement;

    drawTiles(ctx, [
      { img: imgA, x: 0, y: 0, size: 256 },
      { img: imgB, x: 256, y: 0, size: 256 },
    ]);

    expect(drawImage).toHaveBeenNthCalledWith(1, imgA, 0, 0, 256, 256);
    expect(drawImage).toHaveBeenNthCalledWith(2, imgB, 256, 0, 256, 256);
  });
});

describe('drawPin', () => {
  it('draws a filled circle with a ring and a center dot', () => {
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;

    drawPin(ctx, 100, 200);

    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.arc).toHaveBeenNthCalledWith(1, 100, 200, 16, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });
});

describe('drawPosterOverlay', () => {
  const makeCtx = (): CanvasRenderingContext2D =>
    ({
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 80 }),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '',
      font: '',
      textBaseline: '',
      textAlign: '',
    }) as unknown as CanvasRenderingContext2D;

  it('draws the canton name (uppercased), the venue-count pill text, and the attribution', () => {
    const ctx = makeCtx();

    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors',
    });

    expect(ctx.fillText).toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('5 Schwingkeller', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith(
      '© OpenStreetMap contributors', expect.any(Number), expect.any(Number),
    );
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('draws the Wappen image when one is provided', () => {
    const ctx = makeCtx();
    const wappenImg = {} as HTMLImageElement;

    drawPosterOverlay(ctx, {
      cantonName: 'Zug', wappenImg, count: 0, unitLabel: 'Schwingkeller',
      attribution: '© Esri, Maxar, Earthstar Geographics',
    });

    expect(ctx.drawImage).toHaveBeenCalledWith(
      wappenImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/venues/posterCanvas.test.ts`
Expected: FAIL — `extractTileDraws`, `drawTiles`, `drawPin`, `drawPosterOverlay` don't exist yet.

- [ ] **Step 3: Implement the drawing helpers**

Append to `src/features/venues/posterCanvas.ts` (add the `theme` import at the top of the file alongside no existing imports — this file currently has none):

```ts
import { theme } from '../../theme';

export interface TileDraw { img: HTMLImageElement; x: number; y: number; size: number }

export const extractTileDraws = (tilePane: HTMLElement): TileDraw[] => {
  const imgs = tilePane.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded');
  const tiles: TileDraw[] = [];
  imgs.forEach((img) => {
    const match = img.style.transform.match(/translate3d\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px/);
    if (!match) return;
    const size = img.width || 256;
    tiles.push({ img, x: parseFloat(match[1]), y: parseFloat(match[2]), size });
  });
  return tiles;
};

export const drawTiles = (ctx: CanvasRenderingContext2D, tiles: TileDraw[]): void => {
  tiles.forEach(({ img, x, y, size }) => ctx.drawImage(img, x, y, size, size));
};

const PIN_RADIUS = 16;
const PIN_RING = 5;

export const drawPin = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.beginPath();
  ctx.arc(x, y, PIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = theme.color.accent;
  ctx.fill();
  ctx.lineWidth = PIN_RING;
  ctx.strokeStyle = theme.color.bg;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, PIN_RADIUS * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = theme.color.bg;
  ctx.fill();
};

export interface PosterOverlayOptions {
  cantonName: string;
  wappenImg: HTMLImageElement | null;
  count: number;
  unitLabel: string;
  attribution: string;
}

const OVERLAY_PANEL_HEIGHT = 190;
const FOOTER_HEIGHT = 46;
const APP_NAME = 'Schwingkeller Schweiz';

export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const { cantonName, wappenImg, count, unitLabel, attribution } = opts;

  ctx.fillStyle = 'rgba(17,17,17,0.72)';
  ctx.fillRect(0, 0, POSTER_SIZE, OVERLAY_PANEL_HEIGHT);

  let textX = 40;
  if (wappenImg) {
    const wappenW = 64;
    const wappenH = 80;
    ctx.drawImage(wappenImg, 40, 55, wappenW, wappenH);
    textX = 40 + wappenW + 24;
  }

  ctx.fillStyle = theme.color.bg;
  ctx.font = "700 56px Oswald, sans-serif";
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(cantonName.toUpperCase(), textX, 110);

  const pillText = `${count} ${unitLabel}`;
  ctx.font = "700 24px Oswald, sans-serif";
  const pillPaddingX = 18;
  const pillWidth = ctx.measureText(pillText).width + pillPaddingX * 2;
  const pillHeight = 40;
  const pillY = 130;
  ctx.fillStyle = theme.color.accent;
  ctx.beginPath();
  ctx.roundRect(textX, pillY, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.fillStyle = theme.color.accentInk;
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, textX + pillPaddingX, pillY + pillHeight / 2 + 1);

  ctx.fillStyle = 'rgba(17,17,17,0.72)';
  ctx.fillRect(0, POSTER_SIZE - FOOTER_HEIGHT, POSTER_SIZE, FOOTER_HEIGHT);
  ctx.fillStyle = theme.color.bg;
  ctx.font = "600 20px 'Work Sans', sans-serif";
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME, 24, POSTER_SIZE - FOOTER_HEIGHT / 2);
  ctx.font = "400 14px 'Work Sans', sans-serif";
  ctx.textAlign = 'right';
  ctx.fillText(attribution, POSTER_SIZE - 24, POSTER_SIZE - FOOTER_HEIGHT / 2);
  ctx.textAlign = 'left';
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/venues/posterCanvas.test.ts`
Expected: PASS (11 tests total across the whole file).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: add poster tile/pin/overlay canvas drawing helpers"
```

---

### Task 5: `cantonPoster.ts` — off-screen Leaflet capture orchestration

**Files:**
- Create: `src/features/venues/cantonPoster.ts`
- Create: `src/features/venues/cantonPoster.test.ts`

**Interfaces:**
- Consumes: `BaseKind`, `createTileLayer`, `TILE_ATTRIBUTION` (Task 1); `POSTER_SIZE`, `posterFilename`, `createOffscreenContainer`, `loadImage`, `extractTileDraws`, `drawTiles`, `drawPin`, `drawPosterOverlay` (Tasks 3-4); `Venue` from `./types`; `boundsForCanton` from `../../data/cantonBounds`; `cantonByCode`, `wappenUrl` from `../../data/cantons`.
- Produces: `class PosterGenerationError extends Error`; `interface OnceEmitter { once: (event: 'load', handler: () => void) => void }`; `waitForTilesLoad(layer: OnceEmitter, timeoutMs: number): Promise<void>`; `interface GeneratePosterResult { blob: Blob; filename: string }`; `generateCantonPosterBlob(code: string, venues: Venue[], baseKind: BaseKind, unitLabel: string): Promise<GeneratePosterResult>`. Consumed by Task 8 (`App.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `src/features/venues/cantonPoster.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Venue } from './types';
import { boundsForCanton } from '../../data/cantonBounds';

const { tileLayerOnceMock, createTileLayerMock, fakeMap } = vi.hoisted(() => {
  const tileLayerOnceMock = vi.fn();
  return {
    tileLayerOnceMock,
    createTileLayerMock: vi.fn(() => ({ addTo: vi.fn(), once: tileLayerOnceMock })),
    fakeMap: {
      fitBounds: vi.fn(),
      getPane: vi.fn(),
      latLngToContainerPoint: vi.fn().mockReturnValue({ x: 10, y: 20 }),
      remove: vi.fn(),
    },
  };
});

vi.mock('leaflet', () => ({
  default: { map: vi.fn(() => fakeMap) },
}));

vi.mock('../map/tileLayers', async () => {
  const actual = await vi.importActual<typeof import('../map/tileLayers')>('../map/tileLayers');
  return { ...actual, createTileLayer: createTileLayerMock };
});

const drawTilesMock = vi.fn();
const drawPinMock = vi.fn();
const drawPosterOverlayMock = vi.fn();
const extractTileDrawsMock = vi.fn().mockReturnValue([]);
vi.mock('./posterCanvas', async () => {
  const actual = await vi.importActual<typeof import('./posterCanvas')>('./posterCanvas');
  return {
    ...actual,
    loadImage: vi.fn().mockResolvedValue(null),
    drawTiles: drawTilesMock,
    drawPin: drawPinMock,
    drawPosterOverlay: drawPosterOverlayMock,
    extractTileDraws: extractTileDrawsMock,
  };
});

import { generateCantonPosterBlob, waitForTilesLoad } from './cantonPoster';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], ...over,
});
const venues = [v({ id: '1', canton: 'BE' }), v({ id: '2', canton: 'BE' }), v({ id: '3', canton: 'LU' })];

describe('waitForTilesLoad', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves once the layer fires "load"', async () => {
    const handlers: Record<string, () => void> = {};
    const layer = { once: (evt: string, cb: () => void) => { handlers[evt] = cb; } };

    const promise = waitForTilesLoad(layer, 5000);
    handlers.load();

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects with a [TILE_TIMEOUT] error if "load" never fires in time', async () => {
    vi.useFakeTimers();
    const layer = { once: vi.fn() };

    const promise = waitForTilesLoad(layer, 5000);
    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow('[TILE_TIMEOUT]');
  });
});

describe('generateCantonPosterBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    fakeMap.getPane.mockReturnValue(document.createElement('div'));
    fakeMap.latLngToContainerPoint.mockReturnValue({ x: 10, y: 20 });
    tileLayerOnceMock.mockImplementation((evt: string, cb: () => void) => { if (evt === 'load') cb(); });
    extractTileDrawsMock.mockReturnValue([]);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement, cb: BlobCallback,
    ) {
      cb(new Blob(['x'], { type: 'image/png' }));
    });
  });

  it("builds the tile layer for the given base kind and fits the map to the canton's exact bounds", async () => {
    await generateCantonPosterBlob('BE', venues, 'map', 'Schwingkeller');

    expect(createTileLayerMock).toHaveBeenCalledWith('map');
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(boundsForCanton('BE'), { padding: [40, 40] });
  });

  it("plots a pin for each of the canton's venues and none from other cantons", async () => {
    await generateCantonPosterBlob('BE', venues, 'map', 'Schwingkeller');

    // Fixture has 2 BE venues and 1 LU venue — only the 2 BE ones should be projected/drawn.
    expect(fakeMap.latLngToContainerPoint).toHaveBeenCalledTimes(2);
    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawTilesMock).toHaveBeenCalledTimes(1);
  });

  it('returns a PNG blob and the lowercase-canton filename', async () => {
    const result = await generateCantonPosterBlob('BE', venues, 'sat', 'Schwingkeller');

    expect(createTileLayerMock).toHaveBeenCalledWith('sat');
    expect(result.filename).toBe('schwingkeller-be.png');
    expect(result.blob.type).toBe('image/png');
  });

  it('tears down the off-screen map and detaches the container on success', async () => {
    await generateCantonPosterBlob('BE', venues, 'map', 'Schwingkeller');

    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
  });

  it('tears down the off-screen map and container on failure too (tile timeout)', async () => {
    vi.useFakeTimers();
    tileLayerOnceMock.mockImplementation(() => {}); // 'load' never fires

    const promise = generateCantonPosterBlob('BE', venues, 'map', 'Schwingkeller');
    vi.advanceTimersByTime(8000);

    await expect(promise).rejects.toThrow('[TILE_TIMEOUT]');
    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
    vi.useRealTimers();
  });

  it('rejects with [UNKNOWN_CANTON] for an unrecognized code', async () => {
    await expect(generateCantonPosterBlob('XX', venues, 'map', 'Schwingkeller'))
      .rejects.toThrow('[UNKNOWN_CANTON]');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/venues/cantonPoster.test.ts`
Expected: FAIL — `./cantonPoster` doesn't exist yet.

- [ ] **Step 3: Implement `cantonPoster.ts`**

Create `src/features/venues/cantonPoster.ts`:

```ts
import L from 'leaflet';
import type { Venue } from './types';
import { boundsForCanton } from '../../data/cantonBounds';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { createTileLayer, TILE_ATTRIBUTION, type BaseKind } from '../map/tileLayers';
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage,
  extractTileDraws, drawTiles, drawPin, drawPosterOverlay,
} from './posterCanvas';

export class PosterGenerationError extends Error {}

const TILE_LOAD_TIMEOUT_MS = 8000;

export interface OnceEmitter { once: (event: 'load', handler: () => void) => void }

export const waitForTilesLoad = (layer: OnceEmitter, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new PosterGenerationError('[TILE_TIMEOUT] Tiles took too long to load.')),
      timeoutMs,
    );
    layer.once('load', () => {
      window.clearTimeout(timer);
      resolve();
    });
  });

export interface GeneratePosterResult { blob: Blob; filename: string }

export const generateCantonPosterBlob = async (
  code: string,
  venues: Venue[],
  baseKind: BaseKind,
  unitLabel: string,
): Promise<GeneratePosterResult> => {
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }

  const container = createOffscreenContainer(POSTER_SIZE);
  const map = L.map(container, { attributionControl: false, zoomControl: false, fadeAnimation: false });

  try {
    const tileLayer = createTileLayer(baseKind);
    tileLayer.addTo(map);
    map.fitBounds(bounds, { padding: [40, 40] });
    await waitForTilesLoad(tileLayer, TILE_LOAD_TIMEOUT_MS);

    const wappenImg = await loadImage(wappenUrl(code), 'anonymous');
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    const canvas = document.createElement('canvas');
    canvas.width = POSTER_SIZE;
    canvas.height = POSTER_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PosterGenerationError('[NO_CANVAS_CONTEXT] Canvas 2D context unavailable.');

    const tilePane = map.getPane('tilePane');
    if (tilePane) drawTiles(ctx, extractTileDraws(tilePane));

    const cantonVenues = venues.filter((v) => v.canton === code);
    cantonVenues.forEach((v) => {
      const point = map.latLngToContainerPoint([v.lat, v.lng]);
      drawPin(ctx, point.x, point.y);
    });

    drawPosterOverlay(ctx, {
      cantonName: canton.name,
      wappenImg,
      count: cantonVenues.length,
      unitLabel,
      attribution: TILE_ATTRIBUTION[baseKind],
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new PosterGenerationError('[NO_BLOB] Could not encode the poster image.');

    return { blob, filename: posterFilename(code) };
  } finally {
    map.remove();
    container.remove();
  }
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/venues/cantonPoster.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/cantonPoster.ts src/features/venues/cantonPoster.test.ts
git commit -m "feat: add off-screen Leaflet capture for canton poster images"
```

---

### Task 6: `PosterPreviewModal` component

**Files:**
- Create: `src/features/venues/PosterPreviewModal.tsx`
- Create: `src/features/venues/PosterPreviewModal.test.tsx`

**Interfaces:**
- Consumes: `Modal` from `../../components/Modal`; `useTranslation` from `../../i18n/useTranslation`; `theme` from `../../theme`; `t.posterPreviewTitle`, `t.saveImage`, `t.close` (Task 2 + existing).
- Produces: `PosterPreviewModal({ blob: Blob; cantonName: string; onClose: () => void; onSave: (blob: Blob) => void })`. Consumed by Task 8 (`App.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `src/features/venues/PosterPreviewModal.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { PosterPreviewModal } from './PosterPreviewModal';

const renderModal = (props: Partial<Parameters<typeof PosterPreviewModal>[0]> = {}) => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <PosterPreviewModal blob={blob} cantonName="Bern" onClose={onClose} onSave={onSave} {...props} />
    </I18nContext.Provider>,
  );
  return { blob, onClose, onSave };
};

describe('PosterPreviewModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the generated image and the title', () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    renderModal();

    const img = screen.getByRole('img', { name: 'Bern' });
    expect(img).toHaveAttribute('src', 'blob:mock-url');
    expect(screen.getByText(STR.de.posterPreviewTitle)).toBeInTheDocument();
  });

  it('calls onSave with the blob when Save is clicked', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const user = userEvent.setup();
    const { onSave, blob } = renderModal();

    await user.click(screen.getByText(STR.de.saveImage));

    expect(onSave).toHaveBeenCalledWith(blob);
  });

  it('calls onClose when Close is clicked', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByText(STR.de.close));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL on unmount', () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    const { unmount } = render(
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <PosterPreviewModal blob={new Blob(['x'])} cantonName="Bern" onClose={vi.fn()} onSave={vi.fn()} />
      </I18nContext.Provider>,
    );

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/venues/PosterPreviewModal.test.tsx`
Expected: FAIL — `./PosterPreviewModal` doesn't exist yet.

- [ ] **Step 3: Implement the component**

Create `src/features/venues/PosterPreviewModal.tsx`:

```tsx
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';

interface PosterPreviewModalProps {
  blob: Blob;
  cantonName: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

const imgStyle: CSSProperties = {
  display: 'block', width: '100%',
  borderRadius: `${theme.radius.sm} ${theme.radius.sm} 0 0`,
};

export const PosterPreviewModal = ({ blob, cantonName, onClose, onSave }: PosterPreviewModalProps) => {
  const { t } = useTranslation();
  const url = URL.createObjectURL(blob);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <Modal onClose={onClose} width={480}>
      <img src={url} alt={cantonName} style={imgStyle} />
      <div style={{ padding: '18px 22px' }}>
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700,
            fontSize: '18px', color: theme.color.ink,
          }}
        >
          {t.posterPreviewTitle}
        </div>
        <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
              fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.close}
          </button>
          <button
            onClick={() => onSave(blob)}
            style={{
              flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
              fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.saveImage}
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/venues/PosterPreviewModal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/PosterPreviewModal.tsx src/features/venues/PosterPreviewModal.test.tsx
git commit -m "feat: add poster preview modal"
```

---

### Task 7: Admin-only generate-poster icon per canton row in `Sidebar`

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx` (props interface, imports, canton-header row ~lines 686-741)
- Modify: `src/features/sidebar/Sidebar.test.tsx` (RTL import, harness props, new tests)

**Interfaces:**
- Consumes: `t.generatePoster` (Task 2); existing `isAdmin` (via `useAuth()`, already imported in `Sidebar.tsx`).
- Produces: new `SidebarProps` fields `onGeneratePoster: (code: string) => void` and `posterLoadingCode: string | null`. Consumed by Task 8 (`App.tsx`).

- [ ] **Step 1: Extend the test harness**

In `src/features/sidebar/Sidebar.test.tsx`, add `within` to the RTL import (line 3):

```tsx
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
```

Add two fields to `HarnessProps` (near the other optional props):

```tsx
  onGeneratePoster?: (code: string) => void;
  posterLoadingCode?: string | null;
```

Add matching defaults to the `Harness` destructuring and forward them to `<Sidebar>`:

```tsx
  onGeneratePoster = () => {},
  posterLoadingCode = null,
```

```tsx
      onGeneratePoster={onGeneratePoster}
      posterLoadingCode={posterLoadingCode}
```

- [ ] **Step 2: Write the failing tests**

Add inside the `describe('Sidebar', …)` block:

```tsx
it('does not show a generate-poster icon for non-admins', async () => {
  renderSidebar();
  await waitFor(() => expect(screen.getByText('Bern')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: STR.de.generatePoster })).not.toBeInTheDocument();
});

it('shows the generate-poster icon even for a canton with zero venues when admin', async () => {
  renderAdminSidebar();
  const row = (await screen.findByText('Zug')).closest('div')!;
  expect(within(row).getByRole('button', { name: STR.de.generatePoster })).toBeInTheDocument();
});

it('calls onGeneratePoster with the canton code and does not toggle the group', async () => {
  const user = userEvent.setup();
  const onGeneratePoster = vi.fn();
  renderAdminSidebar({ onGeneratePoster });
  const row = (await screen.findByText('Bern')).closest('div')!;
  const button = within(row).getByRole('button', { name: STR.de.generatePoster });

  await user.click(button);

  expect(onGeneratePoster).toHaveBeenCalledWith('BE');
  expect(screen.queryByText('Emmental')).not.toBeInTheDocument();
});

it('disables the generate-poster icon for the canton currently loading', async () => {
  renderAdminSidebar({ posterLoadingCode: 'BE' });
  const row = (await screen.findByText('Bern')).closest('div')!;
  const button = within(row).getByRole('button', { name: STR.de.generatePoster });

  expect(button).toBeDisabled();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx -t "generate-poster"`
Expected: FAIL — the icon/prop doesn't exist yet (also a TypeScript error on the new harness props until Step 1 above wires them through, and a runtime prop-missing situation until Step 5 below adds them to `SidebarProps`).

- [ ] **Step 4: Add the icon import and new props**

In `src/features/sidebar/Sidebar.tsx`, update the `lucide-react` import (line 2) to add `Camera`:

```tsx
import { Search, X, ChevronRight, ChevronLeft, ChevronDown, Plus, Download, Upload, Home, Mountain, Camera } from 'lucide-react';
```

Add two fields to the `SidebarProps` interface (near the other callback props, e.g. after `onRequestLocation: () => void;`):

```tsx
  onGeneratePoster: (code: string) => void;
  posterLoadingCode: string | null;
```

Add them to the destructured component params (alongside `onRequestLocation`):

```tsx
  onGeneratePoster,
  posterLoadingCode,
```

- [ ] **Step 5: Render the icon in the canton header row**

In `src/features/sidebar/Sidebar.tsx`, insert this block between the count-pill `<span>{group.count}</span>` and the chevron `<span>` in the canton header row (currently ~lines 723-740):

```tsx
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGeneratePoster(group.code); }}
                    disabled={posterLoadingCode === group.code}
                    aria-label={t.generatePoster}
                    title={t.generatePoster}
                    style={{
                      width: '26px', height: '26px', border: 'none', background: 'transparent',
                      color: theme.color.ink, cursor: posterLoadingCode === group.code ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                      opacity: posterLoadingCode === group.code ? 0.4 : 1,
                    }}
                  >
                    <Camera size={15} />
                  </button>
                )}
```

The row's `onClick={() => onToggleCanton(group.code)}` sits on the parent `<div>`, so `e.stopPropagation()` in the button's own handler is what prevents a click on the icon from also expanding/collapsing the group.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx`
Expected: PASS — the 4 new tests, and every pre-existing test in the file (all now receive the two new required props via the harness's own defaults).

- [ ] **Step 7: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/features/sidebar/Sidebar.test.tsx
git commit -m "feat: admin-only generate-poster icon per canton row"
```

---

### Task 8: Wire it up in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `generateCantonPosterBlob` (Task 5); `PosterPreviewModal` (Task 6); `onGeneratePoster`/`posterLoadingCode` props on `<Sidebar>` (Task 7); `cantonByCode` from `./data/cantons`; `t.posterGenerateFailed` (Task 2); existing `baseKind`, `venues`, `showFlash`, `captureAndFormat`.
- Produces: no new exports — this is the integration point. No dedicated test file, matching the existing convention (`App.tsx` has no `App.test.tsx` today); verified in Task 9.

- [ ] **Step 1: Add imports**

In `src/App.tsx`, add alongside the existing feature imports (near the `useVenuePermalink` import):

```tsx
import { generateCantonPosterBlob } from './features/venues/cantonPoster';
import { PosterPreviewModal } from './features/venues/PosterPreviewModal';
import { cantonByCode } from './data/cantons';
```

- [ ] **Step 2: Add the `downloadBlob` helper**

Add it right after the existing `download` helper (~line 48), as a binary sibling:

```tsx
const downloadBlob = (name: string, blob: Blob) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
  } catch (err) {
    console.warn('download failed', err);
  }
};
```

- [ ] **Step 3: Add state and handlers**

Inside `AppShell`, add state alongside the other cross-cutting UI state (near `const [flash, setFlash] = ...`):

```tsx
  const [posterLoadingCode, setPosterLoadingCode] = useState<string | null>(null);
  const [posterPreview, setPosterPreview] = useState<{ cantonName: string; blob: Blob; filename: string } | null>(null);
```

Add the handlers near the other handlers (e.g. after `askDelete`/`cancelDelete`/`confirmDelete`):

```tsx
  const generatePoster = async (code: string) => {
    setPosterLoadingCode(code);
    try {
      const canton = cantonByCode(code);
      const { blob, filename } = await generateCantonPosterBlob(code, venues, baseKind, t.unitTotal);
      setPosterPreview({ cantonName: canton?.name ?? code, blob, filename });
    } catch (err) {
      showFlash('err', captureAndFormat(err, t.posterGenerateFailed));
    } finally {
      setPosterLoadingCode(null);
    }
  };
  const closePosterPreview = () => setPosterPreview(null);
  const savePoster = (blob: Blob) => {
    if (!posterPreview) return;
    downloadBlob(posterPreview.filename, blob);
    closePosterPreview();
  };
```

- [ ] **Step 4: Pass the new props to `Sidebar`**

In the `<Sidebar ... />` JSX, add:

```tsx
          onGeneratePoster={(code) => { void generatePoster(code); }}
          posterLoadingCode={posterLoadingCode}
```

- [ ] **Step 5: Render the preview modal**

Add near the other conditionally-rendered modals (e.g. right after the `{showLogin && <LoginModal ... />}` line):

```tsx
      {posterPreview && (
        <PosterPreviewModal
          blob={posterPreview.blob}
          cantonName={posterPreview.cantonName}
          onClose={closePosterPreview}
          onSave={savePoster}
        />
      )}
```

- [ ] **Step 6: Run typecheck and the full test suite**

Run: `npm run typecheck && npm run test`
Expected: both pass — no compile errors from the new wiring, and no regressions in the full suite (App.tsx itself has no dedicated tests, but Sidebar's tests exercise the props contract).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up canton poster generation and preview in App"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full automated verification**

Run: `npm run test && npm run lint && npm run typecheck`
Expected: all three pass cleanly — full suite green, no lint errors (check in particular for unused imports left over from the `MapView.tsx` refactor in Task 1), no type errors.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`, open the app, log in as admin (`LoginModal`), and:
1. Generate a poster for a canton with several venues (e.g. Bern) with the **map** base layer active — confirm the preview modal shows a real street map cropped to roughly Bern's shape, with red pins in the right places, canton name/Wappen/count/branding legible, and OpenStreetMap attribution text present.
2. Repeat with the **satellite** base layer active — confirm satellite imagery renders and the attribution text switches to the Esri credit.
3. Generate a poster for a canton with zero venues (e.g. Zug, per the existing "all 26 cantons always shown" behavior) — confirm it doesn't error and shows a `0 Schwingkeller` badge.
4. Click "Save image" in the preview — confirm a PNG downloads with the expected filename (`schwingkeller-<code>.png`).
5. Confirm the generate-poster icon is not present at all when logged out.

Expected: all five behaviors work as described. If a tile taints the canvas (unexpected `SecurityError`, contradicting the CORS check made during design), the flash-toast error path should show `t.posterGenerateFailed` rather than a silent failure or a crash — verify that path too by temporarily forcing a bad canton code via the browser devtools console (`generateCantonPosterBlob` is not exposed globally, so this step is best-effort: confirm instead that a network failure surfaces the toast by throttling the tile requests offline mid-generation in devtools).

- [ ] **Step 3: Commit any final fixups**

If Steps 1-2 turned up anything (lint fixes, a missed edge case), fix it, re-run Step 1, then:

```bash
git add -A
git commit -m "fix: address issues found during canton poster verification"
```

(Skip this step entirely if nothing needed fixing — don't create an empty commit.)

---

## Notes for the implementer

- If `node_modules` isn't present, run `npm install` before the first `npm run test`/`lint`/`typecheck` in Task 1.
- `MapView.tsx` and `App.tsx` have no dedicated test files today — that's an existing project convention (imperative Leaflet wiring and the top-level app shell are verified by manual smoke test, not Vitest), not an oversight to fix here. Don't add `MapView.test.tsx` or `App.test.tsx` as part of this plan.
- `getSession` in `Sidebar.test.tsx` is a **hoisted** mock shared across tests; `renderAdminSidebar` (already defined in the file) queues a one-time admin session via `getSession.mockResolvedValueOnce(...)`.
- The OSM CORS support this design relies on (`access-control-allow-origin: *` on `tile.openstreetmap.org`) was confirmed via a live response-header check during design, not assumed from memory — see the design spec. The Wappen image's CORS support (`upload.wikimedia.org`) is assumed by the same reasoning but wasn't independently re-verified; `loadImage` resolving `null` on failure means a CORS surprise there degrades to "no Wappen on the poster," not a crash.
- `extractTileDraws` only reads tiles with the `leaflet-tile-loaded` class — this is why `generateCantonPosterBlob` awaits `waitForTilesLoad` before calling it; calling it earlier would silently capture zero or partial tiles.
- Keep the DE/FR/IT strings in sync for any further text changes — the parity test in `src/i18n/translations.test.ts` will catch a missing language but not a wrong translation, so proofread the FR/IT copy if you're a German speaker (as the existing translations in this file already are).
