# Canton Poster Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-shot canton poster preview with an admin-only interactive editor (move/zoom map, base-layer switch, editable title, header/footer toggles, QR code) that downloads a 1080×1080 PNG.

**Architecture:** A new `PosterEditorModal` hosts a live, draggable/zoomable Leaflet map with DOM chrome (header/footer/QR) layered on top for WYSIWYG. On download, the existing off-screen 1080² capture (`generateCantonPosterBlob`) is re-run at the editor map's exact center/zoom with the chosen overlay options. Reuses the hardened capture path from the prior poster feature.

**Tech Stack:** React 19, TypeScript, Leaflet, Vitest + React Testing Library, `qrcode` (new dependency).

**Spec:** [docs/superpowers/specs/2026-07-20-canton-poster-editor-design.md](../specs/2026-07-20-canton-poster-editor-design.md)

## Global Constraints

- TypeScript: never use `any`; use proper types or `unknown` (existing eslint-disabled `any` in untouched code stays as-is).
- i18n: every user-facing string goes through the i18n layer; keep DE/FR/IT keys in sync in `src/i18n/translations.ts`.
- New dependency `qrcode` is pre-approved; no other new dependencies.
- Tile attribution (`© OpenStreetMap contributors` / `© Esri, Maxar, Earthstar Geographics`) MUST always be drawn on the exported image, even when the footer is hidden.
- Export size is fixed at `POSTER_SIZE` (1080) — no aspect-ratio options.
- Capture tiles are built with `createTileLayer(baseKind, 'anonymous')` (CORS-safe, untainted canvas).
- Run `npm run test` and `npm run lint` before considering any task complete.
- Commit on the current feature branch using Conventional Commits.

## File Structure

- Create `src/features/venues/usePosterQr.ts` — hook: canton permalink + QR data-URL.
- Create `src/features/venues/usePosterQr.test.ts`.
- Create `src/features/venues/PosterEditorModal.tsx` — the interactive editor.
- Create `src/features/venues/PosterEditorModal.test.tsx`.
- Modify `src/lib/permalink.ts` — add `withCantonParam`.
- Modify `src/lib/permalink.test.ts` — test `withCantonParam`.
- Modify `src/features/venues/posterCanvas.ts` — extend `PosterOverlayOptions` + `drawPosterOverlay` (toggles, title, QR, always-on attribution).
- Modify `src/features/venues/posterCanvas.test.ts`.
- Modify `src/features/venues/cantonPoster.ts` — `generateCantonPosterBlob` takes a view + overlay options.
- Modify `src/features/venues/cantonPoster.test.ts`.
- Modify `src/App.tsx` — open editor instead of eager render; drop `posterPreview`/`posterLoadingCode`.
- Modify `src/features/sidebar/Sidebar.tsx` — drop `posterLoadingCode` prop + loading-disable branch.
- Modify `src/features/sidebar/Sidebar.test.tsx` — drop the loading-disable test; fix the harness.
- Modify `src/i18n/translations.ts` — add editor keys (DE/FR/IT).
- Delete `src/features/venues/PosterPreviewModal.tsx` + `PosterPreviewModal.test.tsx`.

---

### Task 1: Add `qrcode` dependency and `withCantonParam` permalink helper

**Files:**
- Modify: `package.json`
- Modify: `src/lib/permalink.ts`
- Test: `src/lib/permalink.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `withCantonParam(url: string, code: string): string` — returns pathname+search with `ctn=<UPPERCASE code>` set and any `venue` param removed.

- [ ] **Step 1: Add the dependency to package.json**

In `package.json`, add to `"dependencies"` (keep alphabetical-ish with neighbors):

```json
"qrcode": "^1.5.4",
```

And to `"devDependencies"`:

```json
"@types/qrcode": "^1.5.5",
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes without ERESOLVE (the repo `.npmrc` sets `legacy-peer-deps=true`); `node_modules/qrcode` exists.

- [ ] **Step 3: Write the failing test**

Add to `src/lib/permalink.test.ts` (import `withCantonParam` alongside the existing imports from `./permalink`):

```ts
describe('withCantonParam', () => {
  it('sets ctn (uppercased) and drops any venue param', () => {
    expect(withCantonParam('https://x.app/', 'be')).toBe('https://x.app/?ctn=BE');
    expect(withCantonParam('https://x.app/?venue=v1', 'BE')).toBe('https://x.app/?ctn=BE');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/permalink.test.ts -t withCantonParam`
Expected: FAIL — `withCantonParam is not a function` / not exported.

- [ ] **Step 5: Implement `withCantonParam`**

Append to `src/lib/permalink.ts`:

```ts
// Inverse of withVenueParam: sets ?ctn=<code> (uppercased) and clears any
// `venue` param. Used to build the poster QR link back to the canton view.
export const withCantonParam = (url: string, code: string): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('venue');
  params.set('ctn', code.toUpperCase());
  const next = params.toString();
  return next ? path + '?' + next : path;
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/permalink.test.ts -t withCantonParam`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/permalink.ts src/lib/permalink.test.ts
git commit -m "feat: add qrcode dep and withCantonParam permalink helper"
```

---

### Task 2: `usePosterQr` hook

**Files:**
- Create: `src/features/venues/usePosterQr.ts`
- Test: `src/features/venues/usePosterQr.test.ts`

**Interfaces:**
- Consumes: `withCantonParam` (Task 1).
- Produces: `usePosterQr(code: string): { url: string; dataUrl: string | null }` — `url` is the absolute canton permalink (from `window.location.href`); `dataUrl` is a PNG data-URL of the QR, or `null` until generated / on error.

- [ ] **Step 1: Write the failing test**

Create `src/features/venues/usePosterQr.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,QR');
vi.mock('qrcode', () => ({ default: { toDataURL } }));

import { usePosterQr } from './usePosterQr';

describe('usePosterQr', () => {
  beforeEach(() => {
    toDataURL.mockClear();
    window.history.replaceState({}, '', 'https://x.app/?ctn=ZH');
  });

  it('builds the absolute canton permalink and requests a QR for it', async () => {
    const { result } = renderHook(() => usePosterQr('BE'));
    expect(result.current.url).toBe('https://x.app/?ctn=BE');
    await waitFor(() => expect(result.current.dataUrl).toBe('data:image/png;base64,QR'));
    expect(toDataURL).toHaveBeenCalledWith('https://x.app/?ctn=BE', expect.any(Object));
  });

  it('leaves dataUrl null when QR generation rejects', async () => {
    toDataURL.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePosterQr('BE'));
    await waitFor(() => expect(toDataURL).toHaveBeenCalled());
    expect(result.current.dataUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/venues/usePosterQr.test.ts`
Expected: FAIL — cannot resolve `./usePosterQr`.

- [ ] **Step 3: Implement the hook**

Create `src/features/venues/usePosterQr.ts`:

```ts
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { withCantonParam } from '../../lib/permalink';

export interface PosterQr {
  url: string;
  dataUrl: string | null;
}

export const usePosterQr = (code: string): PosterQr => {
  const url = withCantonParam(
    typeof window !== 'undefined' ? window.location.href : '',
    code,
  );
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then((d) => { if (active) setDataUrl(d); })
      .catch(() => { if (active) setDataUrl(null); });
    return () => { active = false; };
  }, [url]);

  return { url, dataUrl };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/venues/usePosterQr.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/usePosterQr.ts src/features/venues/usePosterQr.test.ts
git commit -m "feat: usePosterQr hook for canton permalink QR data-url"
```

---

### Task 3: Extend `drawPosterOverlay` for toggles, title, QR, and always-on attribution

**Files:**
- Modify: `src/features/venues/posterCanvas.ts:68-124`
- Test: `src/features/venues/posterCanvas.test.ts:138-183`

**Interfaces:**
- Consumes: nothing new.
- Produces: updated `PosterOverlayOptions`:
  ```ts
  interface PosterOverlayOptions {
    cantonName: string;     // still passed; used as the default title
    title?: string;         // when set, overrides cantonName in the header
    wappenImg: HTMLImageElement | null;
    count: number;
    unitLabel: string;
    attribution: string;
    showHeader?: boolean;   // default true
    showFooter?: boolean;   // default true (branding band)
    qrImg?: HTMLImageElement | null; // drawn bottom-right when present
  }
  ```
  Behaviour: header band (panel + wappen + title + count pill) drawn only when `showHeader !== false`; footer branding band drawn only when `showFooter !== false`; attribution text ALWAYS drawn (inside the footer band when shown, else as a standalone minimal credit); QR drawn bottom-right (inset above the footer area) when `qrImg` is provided.

- [ ] **Step 1: Update the failing tests**

Replace the two tests in the `describe('drawPosterOverlay', …)` block (`src/features/venues/posterCanvas.test.ts:154-182`) and add new ones:

```ts
  it('draws the canton name (uppercased), the count pill, and the attribution by default', () => {
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
  });

  it('uses the title override instead of the canton name when provided', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', title: 'Emmental 2026', wappenImg: null, count: 1,
      unitLabel: 'Schwingkeller', attribution: '© OpenStreetMap contributors',
    });
    expect(ctx.fillText).toHaveBeenCalledWith('EMMENTAL 2026', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).not.toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
  });

  it('skips the header (name + count pill) when showHeader is false', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', showHeader: false,
    });
    expect(ctx.fillText).not.toHaveBeenCalledWith('BERN', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).not.toHaveBeenCalledWith('5 Schwingkeller', expect.any(Number), expect.any(Number));
  });

  it('still draws attribution when the footer is hidden', () => {
    const ctx = makeCtx();
    drawPosterOverlay(ctx, {
      cantonName: 'Bern', wappenImg: null, count: 5, unitLabel: 'Schwingkeller',
      attribution: '© OpenStreetMap contributors', showFooter: false,
    });
    expect(ctx.fillText).toHaveBeenCalledWith(
      '© OpenStreetMap contributors', expect.any(Number), expect.any(Number),
    );
  });

  it('draws the Wappen and the QR image when both are provided', () => {
    const ctx = makeCtx();
    const wappenImg = {} as HTMLImageElement;
    const qrImg = {} as HTMLImageElement;
    drawPosterOverlay(ctx, {
      cantonName: 'Zug', wappenImg, count: 0, unitLabel: 'Schwingkeller',
      attribution: '© Esri, Maxar, Earthstar Geographics', qrImg,
    });
    expect(ctx.drawImage).toHaveBeenCalledWith(
      wappenImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(
      qrImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts -t drawPosterOverlay`
Expected: FAIL — title override / showHeader / QR behaviour not implemented.

- [ ] **Step 3: Implement the overlay changes**

In `src/features/venues/posterCanvas.ts`, replace the `PosterOverlayOptions` interface and `drawPosterOverlay` function (lines 68-124) with:

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

const OVERLAY_PANEL_HEIGHT = 190;
const FOOTER_HEIGHT = 46;
const APP_NAME = 'Schwingkeller Schweiz';
const QR_SIZE = 150;
const QR_MARGIN = 28;

export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution,
    showHeader = true, showFooter = true, qrImg,
  } = opts;

  if (showHeader) {
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
    ctx.font = '700 56px Oswald, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText((title || cantonName).toUpperCase(), textX, 110);

    const pillText = `${count} ${unitLabel}`;
    ctx.font = '700 24px Oswald, sans-serif';
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
  }

  // QR sits bottom-right, inset above the footer band area.
  if (qrImg) {
    const qrX = POSTER_SIZE - QR_SIZE - QR_MARGIN;
    const qrY = POSTER_SIZE - QR_SIZE - QR_MARGIN - FOOTER_HEIGHT;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - 8, qrY - 8, QR_SIZE + 16, QR_SIZE + 16);
    ctx.drawImage(qrImg, qrX, qrY, QR_SIZE, QR_SIZE);
  }

  if (showFooter) {
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
  } else {
    // Attribution is legally required even without the branding band — draw a
    // minimal credit with a subtle backing strip for legibility.
    const stripH = 26;
    ctx.fillStyle = 'rgba(17,17,17,0.55)';
    ctx.fillRect(0, POSTER_SIZE - stripH, POSTER_SIZE, stripH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = "400 14px 'Work Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - 24, POSTER_SIZE - stripH / 2);
    ctx.textAlign = 'left';
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: PASS (all `drawPosterOverlay` tests + the untouched ones).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: poster overlay supports title, header/footer toggles, QR, always-on attribution"
```

---

### Task 4: Parameterize `generateCantonPosterBlob` by view + overlay options

**Files:**
- Modify: `src/features/venues/cantonPoster.ts:31-88`
- Test: `src/features/venues/cantonPoster.test.ts`

**Interfaces:**
- Consumes: `drawPosterOverlay` options (Task 3), `loadImage`.
- Produces:
  ```ts
  interface PosterView { center: [number, number]; zoom: number }
  interface GeneratePosterOptions {
    baseKind: BaseKind;
    view?: PosterView;          // when omitted, fit to canton bounds (back-compat default)
    unitLabel: string;
    title?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    qrDataUrl?: string | null;
  }
  generateCantonPosterBlob(code: string, venues: Venue[], options: GeneratePosterOptions): Promise<GeneratePosterResult>
  ```
  When `view` is given, the off-screen map does `setView(center, zoom)`; otherwise `fitBounds(boundsForCanton(code), { padding: [40,40] })`.

- [ ] **Step 1: Update the failing tests**

In `src/features/venues/cantonPoster.test.ts`:

(a) Add `setView` to the `fakeMap` in the `vi.hoisted` block (near `fitBounds`):

```ts
    fakeMap: {
      fitBounds: vi.fn(),
      setView: vi.fn(),
      getPane: vi.fn(),
      latLngToContainerPoint: vi.fn().mockReturnValue({ x: 10, y: 20 }),
      remove: vi.fn(),
    },
```

(b) Replace the three call sites that used the old positional signature. The
first test becomes:

```ts
  it("builds the tile layer for the given base kind and fits the map to the canton's bounds by default", async () => {
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(createTileLayerMock).toHaveBeenCalledWith('map', 'anonymous');
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(boundsForCanton('BE'), { padding: [40, 40] });
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });
```

(c) Update the pin test and the blob test to the new options object:

```ts
  it("plots a pin for each of the canton's venues and none from other cantons", async () => {
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });
    expect(fakeMap.latLngToContainerPoint).toHaveBeenCalledTimes(2);
    expect(drawPinMock).toHaveBeenCalledTimes(2);
    expect(drawTilesMock).toHaveBeenCalledTimes(1);
  });

  it('returns a PNG blob and the lowercase-canton filename', async () => {
    const result = await generateCantonPosterBlob('BE', venues, { baseKind: 'sat', unitLabel: 'Schwingkeller' });
    expect(createTileLayerMock).toHaveBeenCalledWith('sat', 'anonymous');
    expect(result.filename).toBe('schwingkeller-be.png');
    expect(result.blob.type).toBe('image/png');
  });
```

(d) Update the two teardown tests and the unknown-canton test to pass the
options object instead of positional args, e.g.:

```ts
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });
```
```ts
    const promise = generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });
```
```ts
    await expect(generateCantonPosterBlob('XX', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' }))
      .rejects.toThrow('[UNKNOWN_CANTON]');
```

(e) Add a new test for the explicit-view path:

```ts
  it('uses setView (not fitBounds) when an explicit view is supplied', async () => {
    await generateCantonPosterBlob('BE', venues, {
      baseKind: 'map', unitLabel: 'Schwingkeller', view: { center: [46.9, 7.4], zoom: 11 },
    });
    expect(fakeMap.setView).toHaveBeenCalledWith([46.9, 7.4], 11);
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: FAIL — new signature/`setView` not implemented.

- [ ] **Step 3: Implement the new signature**

In `src/features/venues/cantonPoster.ts`, replace the exported result/function block (lines 29-88) with:

```ts
export interface GeneratePosterResult { blob: Blob; filename: string }

export interface PosterView { center: [number, number]; zoom: number }

export interface GeneratePosterOptions {
  baseKind: BaseKind;
  view?: PosterView;
  unitLabel: string;
  title?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  qrDataUrl?: string | null;
}

export const generateCantonPosterBlob = async (
  code: string,
  venues: Venue[],
  options: GeneratePosterOptions,
): Promise<GeneratePosterResult> => {
  const { baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl } = options;
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }

  const container = createOffscreenContainer(POSTER_SIZE);
  const map = L.map(container, { attributionControl: false, zoomControl: false, fadeAnimation: false });

  try {
    const tileLayer = createTileLayer(baseKind, 'anonymous');
    tileLayer.addTo(map);
    if (view) {
      map.setView(view.center, view.zoom);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    await waitForTilesLoad(tileLayer, TILE_LOAD_TIMEOUT_MS);

    const wappenImg = await loadImage(wappenUrl(code), 'anonymous');
    const qrImg = qrDataUrl ? await loadImage(qrDataUrl) : null;
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
      title,
      wappenImg,
      count: cantonVenues.length,
      unitLabel,
      attribution: TILE_ATTRIBUTION[baseKind],
      showHeader,
      showFooter,
      qrImg,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/cantonPoster.ts src/features/venues/cantonPoster.test.ts
git commit -m "feat: generateCantonPosterBlob takes explicit view + overlay options"
```

---

### Task 5: Add editor i18n keys and build `PosterEditorModal`

**Files:**
- Modify: `src/i18n/translations.ts`
- Create: `src/features/venues/PosterEditorModal.tsx`
- Test: `src/features/venues/PosterEditorModal.test.tsx`

**Interfaces:**
- Consumes: `usePosterQr` (Task 2), `generateCantonPosterBlob` + `GeneratePosterOptions` (Task 4), `createTileLayer`, `boundsForCanton`, `wappenUrl`, `pinHtml`, `Modal`, `useTranslation`, `theme`.
- Produces:
  ```ts
  interface PosterEditorModalProps {
    code: string;
    venues: Venue[];
    initialBaseKind: BaseKind;
    unitLabel: string;
    onClose: () => void;
    onSave: (blob: Blob, filename: string) => void;
  }
  export const PosterEditorModal: (p: PosterEditorModalProps) => JSX.Element;
  ```
  On "Download PNG" it calls `generateCantonPosterBlob(code, venues, { baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl })` then `onSave(blob, filename)`.

- [ ] **Step 1: Add i18n keys (DE/FR/IT)**

In `src/i18n/translations.ts`, add these keys inside each language object next to the existing poster keys (`generatePoster` etc.). DE block:

```ts
    posterEditorTitle: 'Poster bearbeiten',
    posterTitleLabel: 'Titel',
    posterBaseLabel: 'Kartentyp',
    posterToggleHeader: 'Kopfzeile',
    posterToggleFooter: 'Fusszeile',
    posterToggleQr: 'QR-Code',
    posterResetFraming: 'Ausschnitt zurücksetzen',
    posterDownload: 'PNG herunterladen',
```

FR block:

```ts
    posterEditorTitle: 'Modifier l’affiche',
    posterTitleLabel: 'Titre',
    posterBaseLabel: 'Type de carte',
    posterToggleHeader: 'En-tête',
    posterToggleFooter: 'Pied de page',
    posterToggleQr: 'Code QR',
    posterResetFraming: 'Réinitialiser le cadrage',
    posterDownload: 'Télécharger le PNG',
```

IT block:

```ts
    posterEditorTitle: 'Modifica poster',
    posterTitleLabel: 'Titolo',
    posterBaseLabel: 'Tipo di mappa',
    posterToggleHeader: 'Intestazione',
    posterToggleFooter: 'Piè di pagina',
    posterToggleQr: 'Codice QR',
    posterResetFraming: 'Reimposta inquadratura',
    posterDownload: 'Scarica PNG',
```

Run: `npx vitest run src/i18n/translations.test.ts`
Expected: PASS (the parity test confirms DE/FR/IT keys match).

- [ ] **Step 2: Write the failing test**

Create `src/features/venues/PosterEditorModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from './types';

// Mock the heavy capture path — we assert wiring, not real canvas output.
const generateCantonPosterBlob = vi.fn().mockResolvedValue({
  blob: new Blob(['x'], { type: 'image/png' }), filename: 'schwingkeller-be.png',
});
vi.mock('./cantonPoster', () => ({ generateCantonPosterBlob }));

// Mock QR hook so no real qrcode/canvas runs.
vi.mock('./usePosterQr', () => ({
  usePosterQr: () => ({ url: 'https://x.app/?ctn=BE', dataUrl: 'data:image/png;base64,QR' }),
}));

// Mock Leaflet: a fake map that records center/zoom and supports the calls the editor makes.
const fakeMap = {
  setView: vi.fn().mockReturnThis(),
  fitBounds: vi.fn().mockReturnThis(),
  getCenter: vi.fn().mockReturnValue({ lat: 46.9, lng: 7.4 }),
  getZoom: vi.fn().mockReturnValue(11),
  on: vi.fn(),
  off: vi.fn(),
  remove: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
};
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => fakeMap),
    marker: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn(() => ({})),
    layerGroup: vi.fn(() => ({ addTo: vi.fn(), clearLayers: vi.fn(), addLayer: vi.fn() })),
  },
}));

import { PosterEditorModal } from './PosterEditorModal';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], ...over,
});

const renderEditor = (props: Partial<Parameters<typeof PosterEditorModal>[0]> = {}) =>
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <PosterEditorModal
        code="BE"
        venues={[v({ id: '1' })]}
        initialBaseKind="map"
        unitLabel="Schwingkeller"
        onClose={vi.fn()}
        onSave={vi.fn()}
        {...props}
      />
    </I18nContext.Provider>,
  );

describe('PosterEditorModal', () => {
  beforeEach(() => { generateCantonPosterBlob.mockClear(); });

  it('renders the controls and the QR image', () => {
    renderEditor();
    expect(screen.getByLabelText(STR.de.posterTitleLabel)).toHaveValue('Bern');
    expect(screen.getByRole('img', { name: /qr/i })).toBeInTheDocument();
  });

  it('captures with the current view + options and reports the blob via onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderEditor({ onSave });

    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(generateCantonPosterBlob).toHaveBeenCalledWith('BE', expect.any(Array), expect.objectContaining({
      baseKind: 'map',
      unitLabel: 'Schwingkeller',
      view: { center: [46.9, 7.4], zoom: 11 },
      title: 'Bern',
      showHeader: true,
      showFooter: true,
      qrDataUrl: 'data:image/png;base64,QR',
    }));
    expect(onSave).toHaveBeenCalledWith(expect.any(Blob), 'schwingkeller-be.png');
  });

  it('omits qrDataUrl when the QR toggle is off', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(STR.de.posterToggleQr));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));
    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2].qrDataUrl).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: FAIL — cannot resolve `./PosterEditorModal`.

- [ ] **Step 4: Implement `PosterEditorModal`**

Create `src/features/venues/PosterEditorModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { boundsForCanton } from '../../data/cantonBounds';
import { createTileLayer, type BaseKind } from '../map/tileLayers';
import { pinHtml } from '../map/markers';
import { generateCantonPosterBlob } from './cantonPoster';
import { usePosterQr } from './usePosterQr';
import type { Venue } from './types';

interface PosterEditorModalProps {
  code: string;
  venues: Venue[];
  initialBaseKind: BaseKind;
  unitLabel: string;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => void;
}

const PREVIEW_SIZE = 460;

export const PosterEditorModal = ({
  code, venues, initialBaseKind, unitLabel, onClose, onSave,
}: PosterEditorModalProps) => {
  const { t } = useTranslation();
  const canton = cantonByCode(code);
  const cantonVenues = venues.filter((v) => v.canton === code);

  const [baseKind, setBaseKind] = useState<BaseKind>(initialBaseKind);
  const [title, setTitle] = useState<string>(canton?.name ?? code);
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [busy, setBusy] = useState(false);

  const { url, dataUrl: qrDataUrl } = usePosterQr(code);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  // Create the live editor map once.
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const bounds = boundsForCanton(code);
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: true });
    mapRef.current = map;
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });

    const pins = L.layerGroup().addTo(map);
    cantonVenues.forEach((v) => {
      L.marker([v.lat, v.lng], { icon: L.divIcon({ className: '', html: pinHtml(false), iconSize: [28, 28] }) })
        .addTo(pins);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the base layer live when toggled.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
  }, [baseKind]);

  const resetFraming = () => {
    const map = mapRef.current;
    const bounds = boundsForCanton(code);
    if (map && bounds) map.fitBounds(bounds, { padding: [20, 20] });
  };

  const download = async () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const view = { center: [c.lat, c.lng] as [number, number], zoom: map.getZoom() };
    setBusy(true);
    try {
      const { blob, filename } = await generateCantonPosterBlob(code, venues, {
        baseKind,
        view,
        unitLabel,
        title,
        showHeader,
        showFooter,
        qrDataUrl: showQr ? qrDataUrl : null,
      });
      onSave(blob, filename);
    } finally {
      setBusy(false);
    }
  };

  const label: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: theme.color.ink };
  const chrome: React.CSSProperties = { position: 'absolute', left: 0, right: 0, background: 'rgba(17,17,17,0.72)', color: theme.color.bg, padding: '8px 12px', fontFamily: theme.font.display, fontWeight: 700 };

  return (
    <Modal onClose={onClose} width={PREVIEW_SIZE + 300}>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700, fontSize: '18px', color: theme.color.ink }}>
          {t.posterEditorTitle}: {canton?.name ?? code}
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
          {/* Live editor square with DOM chrome overlays */}
          <div style={{ position: 'relative', width: PREVIEW_SIZE, height: PREVIEW_SIZE, maxWidth: '100%', flex: '0 0 auto', borderRadius: theme.radius.sm, overflow: 'hidden', border: '1px solid ' + theme.color.line }}>
            <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />
            {showHeader && (
              <div style={{ ...chrome, top: 0, textTransform: 'uppercase' }}>{title}</div>
            )}
            {showQr && qrDataUrl && (
              <img src={qrDataUrl} alt="QR" style={{ position: 'absolute', right: 12, bottom: 40, width: 64, height: 64, background: theme.color.bg, padding: 4, borderRadius: 4 }} />
            )}
            <div style={{ ...chrome, bottom: 0, fontFamily: theme.font.body, fontWeight: 400, fontSize: '11px', textAlign: 'right' }}>
              {showFooter ? 'Schwingkeller Schweiz  ·  ' : ''}© OpenStreetMap / Esri
            </div>
          </div>

          {/* Controls */}
          <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={label}>
              {t.posterTitleLabel}
              <input aria-label={t.posterTitleLabel} value={title} onChange={(e) => setTitle(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1.5px solid ' + theme.color.line, borderRadius: theme.radius.sm }} />
            </label>

            <div style={label}>
              {t.posterBaseLabel}
              <button onClick={() => setBaseKind('map')} aria-pressed={baseKind === 'map'}
                style={{ padding: '6px 10px', borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: baseKind === 'map' ? theme.color.ink : 'transparent', color: baseKind === 'map' ? theme.color.bg : theme.color.ink, cursor: 'pointer' }}>
                {t.mapView}
              </button>
              <button onClick={() => setBaseKind('sat')} aria-pressed={baseKind === 'sat'}
                style={{ padding: '6px 10px', borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: baseKind === 'sat' ? theme.color.ink : 'transparent', color: baseKind === 'sat' ? theme.color.bg : theme.color.ink, cursor: 'pointer' }}>
                {t.satView}
              </button>
            </div>

            <label style={label}>
              <input type="checkbox" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} />
              {t.posterToggleHeader}
            </label>
            <label style={label}>
              <input type="checkbox" checked={showFooter} onChange={(e) => setShowFooter(e.target.checked)} />
              {t.posterToggleFooter}
            </label>
            <label style={label}>
              <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
              {t.posterToggleQr}
            </label>

            <button onClick={resetFraming}
              style={{ alignSelf: 'flex-start', padding: '8px 12px', border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: '13px' }}>
              {t.posterResetFraming}
            </button>

            <div style={{ marginTop: 'auto' }} title={url} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
          <button onClick={onClose}
            style={{ flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer' }}>
            {t.close}
          </button>
          <button onClick={() => { void download(); }} disabled={busy}
            style={{ flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {t.posterDownload}
          </button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: PASS (all three tests).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/translations.ts src/features/venues/PosterEditorModal.tsx src/features/venues/PosterEditorModal.test.tsx
git commit -m "feat: interactive PosterEditorModal with live map, toggles, QR, download"
```

---

### Task 6: Wire the editor into App, simplify Sidebar, remove PosterPreviewModal

**Files:**
- Modify: `src/App.tsx` (imports, state ~120-121, `generatePoster` ~241-257, render ~349-350, ~398-404)
- Modify: `src/features/sidebar/Sidebar.tsx` (props ~34-35, ~127-128, loading branch ~692, button ~741-756)
- Modify: `src/features/sidebar/Sidebar.test.tsx` (harness + drop loading-disable test)
- Delete: `src/features/venues/PosterPreviewModal.tsx`, `src/features/venues/PosterPreviewModal.test.tsx`

**Interfaces:**
- Consumes: `PosterEditorModal` (Task 5).
- Produces: Sidebar prop shape drops `posterLoadingCode`; `onGeneratePoster(code)` now opens the editor.

- [ ] **Step 1: Simplify the Sidebar (remove loading state)**

In `src/features/sidebar/Sidebar.tsx`:

Remove `posterLoadingCode: string | null;` from the props interface (line ~35) and remove `posterLoadingCode,` from the destructured params (line ~128).

Replace the group-map loading line (~692) — delete:
```ts
          const isLoading = posterLoadingCode !== null;
```

Update the button (lines ~741-755) to drop the disabled/loading styling:

```tsx
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGeneratePoster(group.code); }}
                    aria-label={t.generatePoster}
                    title={t.generatePoster}
                    style={{
                      width: '26px', height: '26px', border: 'none', background: 'transparent',
                      color: theme.color.ink, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                    }}
                  >
                    <Camera size={15} />
                  </button>
                )}
```

- [ ] **Step 2: Update the Sidebar test (drop loading-disable test + prop)**

In `src/features/sidebar/Sidebar.test.tsx`:

Remove `posterLoadingCode?: string | null;` from `HarnessProps`, remove `posterLoadingCode = null,` from the `Harness` destructure and the `posterLoadingCode={posterLoadingCode}` passed to `<Sidebar>`.

Delete the entire test `it('disables ALL generate-poster icons while any canton is loading, not just the matching one', …)`.

- [ ] **Step 3: Run the Sidebar tests**

Run: `npx vitest run src/features/sidebar/Sidebar.test.tsx`
Expected: PASS (the remaining poster tests still pass; the loading test is gone).

- [ ] **Step 4: Rewire App**

In `src/App.tsx`:

Replace the import (line 21):
```ts
import { PosterEditorModal } from './features/venues/PosterEditorModal';
```

Replace the poster state (lines 120-121):
```ts
  const [posterEditorCode, setPosterEditorCode] = useState<string | null>(null);
```

Replace the `generatePoster` block (lines 241-257) with:
```ts
  const openPosterEditor = (code: string) => setPosterEditorCode(code);
  const closePosterEditor = () => setPosterEditorCode(null);
  const savePoster = (blob: Blob, filename: string) => {
    downloadBlob(filename, blob);
    closePosterEditor();
  };
```

Update the Sidebar props (lines 349-350): remove `posterLoadingCode={posterLoadingCode}` and change the handler:
```tsx
          onGeneratePoster={openPosterEditor}
```

Replace the modal render (lines 398-404):
```tsx
      {posterEditorCode && (
        <PosterEditorModal
          code={posterEditorCode}
          venues={venues}
          initialBaseKind={baseKind}
          unitLabel={t.unitTotal}
          onClose={closePosterEditor}
          onSave={savePoster}
        />
      )}
```

Remove the now-unused imports `generateCantonPosterBlob` (line 20) and `captureAndFormat` **only if** no longer referenced elsewhere (check: it is used by other catch blocks — keep it). Also remove `cantonByCode` import (line 22) **only if** no longer referenced (it is used elsewhere — verify with a search before removing; if still used, leave it).

- [ ] **Step 5: Delete the retired preview component**

```bash
git rm src/features/venues/PosterPreviewModal.tsx src/features/venues/PosterPreviewModal.test.tsx
```

- [ ] **Step 6: Full verification**

Run: `npm run lint`
Expected: exit 0 (no unused-var errors — if lint flags an unused import in App.tsx, remove that specific import).

Run: `npm run test`
Expected: all tests pass; no reference to `PosterPreviewModal` remains.

Run: `npm run build`
Expected: tsc + vite build succeed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: open interactive poster editor from sidebar; retire static preview"
```

---

## Self-Review

**Spec coverage:**
- Move/zoom → live map in Task 5; captured via `view` (center/zoom) in Task 4. ✓
- Base-layer switch → Task 5 base toggle + live layer swap. ✓
- Editable title → Task 5 input; drawn in Task 3 (`title` override). ✓
- Header/footer toggles → Task 3 (`showHeader`/`showFooter`) + Task 5 controls. ✓
- Always-on attribution → Task 3 (footer-off branch draws minimal credit). ✓
- QR code → Task 2 (hook) + Task 3 (draw) + Task 5 (toggle/preview). ✓
- 1080² off-screen re-capture → Task 4. ✓
- `qrcode` dependency → Task 1. ✓
- App wiring / open-editor / drop `posterLoadingCode` / retire preview → Task 6. ✓
- i18n DE/FR/IT → Task 5 Step 1. ✓

**Placeholder scan:** No TBD/TODO; all code steps contain full code; commands have expected output. ✓

**Type consistency:** `GeneratePosterOptions` fields (`baseKind`, `view{center,zoom}`, `unitLabel`, `title`, `showHeader`, `showFooter`, `qrDataUrl`) are identical across Tasks 4, 5, and the tests. `PosterOverlayOptions` (Task 3) matches the object built in `generateCantonPosterBlob` (Task 4). `usePosterQr` returns `{ url, dataUrl }` used consistently in Task 5. `onSave(blob, filename)` matches App's `savePoster(blob, filename)`. ✓

## Manual verification (after Task 6)

In the running Docker app (admin logged in): click a canton's camera icon → editor opens fit to the canton → drag/zoom, toggle header/footer/QR, switch base layer, edit the title → **Download PNG** produces a 1080×1080 image matching the framing, with a scannable QR pointing to `?ctn=<CODE>` and attribution present even with the footer hidden.
