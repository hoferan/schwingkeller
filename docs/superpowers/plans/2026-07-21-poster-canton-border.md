# Canton Poster — Canton Border Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin overlay the current canton's official border outline (a two-tone halo stroke) on the canton poster export and its live preview, toggleable, defaulting to off.

**Architecture:** A replacement `public/cantons.geojson` (all 26 cantons, keyed by official canton number) backs a new `src/data/cantonGeoJson.ts` data-loading module. The off-screen capture draws the border by projecting each polygon vertex through the same `map.latLngToContainerPoint()` primitive already used for venue pins (`posterCanvas.ts`'s new `drawCantonBorder`). The live editor preview instead adds native `L.geoJSON` layers to the interactive map, which re-project automatically on pan/zoom — mirroring the existing pins split (DOM preview uses Leaflet markers; capture manually projects).

**Tech Stack:** TypeScript, React 19, Leaflet, Vitest + React Testing Library.

## Global Constraints

- No `any` — use proper types or `unknown` (CLAUDE.md).
- No new npm dependencies (CLAUDE.md) — `topojson-client` is used only as a one-time, offline data-conversion tool in Task 1, run in a scratch directory outside this repo; it is never added to `package.json`/`package-lock.json` and is not a runtime dependency of the app.
- TDD: write the failing test first, then the implementation (CLAUDE.md, test-driven-development skill).
- `npm run test` and `npm run lint` must pass before the work is considered complete (CLAUDE.md).
- Keep i18n keys in sync across DE/FR/IT when touching UI text (CLAUDE.md) — this plan adds 1 new key (`posterToggleBorder`) to all three languages.
- Design source of truth: `docs/superpowers/specs/2026-07-21-poster-canton-border-design.md`.
- **Sequencing note:** this plan is written against the source tree as it stands with **none** of sub-projects A, B, or C implemented yet. Per the design spec, this is the one sub-project with **no** cross-spec coordination requirement — its changes don't interact with A/B/C's framing, aspect-ratio, or chrome-position/style work, so it should apply cleanly regardless of what else has already landed. If line-level context has shifted in `cantonPoster.ts`/`PosterEditorModal.tsx` by execution time, the class of change here stays the same.

---

### Task 1: Replace `public/cantons.geojson` and add `Canton.kantonsnum`

**Files:**
- Modify: `public/cantons.geojson` (replaced wholesale)
- Modify: `src/data/cantons.ts`
- Modify: `src/data/cantons.test.ts`

**Data source decision (verified during planning, not speculative):** the current bundled `public/cantons.geojson` has two problems for a border overlay — Basel-Stadt's `geometry` is `null`, and it was never vetted for being traced as a visible line. Three candidates were researched in the design spec (geo.admin.ch's official API, `interactivethings/swiss-maps`, a community mirror); geo.admin.ch and the community mirror were unreachable from this planning environment's network policy, but **`swiss-maps` was fully downloaded and verified**:

- Package `swiss-maps` (npm, BSD-3-Clause license, source: swisstopo generalized boundaries via the Swiss Federal Statistical Office), version 4.7.0 as of this writing.
- Its `2026/ch-combined.json` is a TopoJSON `Topology` whose `objects.cantons` is a `GeometryCollection` with **exactly 26 geometries** (`Polygon` or `MultiPolygon`, one per canton — exclave cantons like Fribourg and Bern are `MultiPolygon`, not split across separate features the way the current file does it).
- Converted to plain GeoJSON with `topojson-client`'s `feature()`: **Basel-Stadt (canton number 12) has a real `Polygon` geometry** — confirmed by inspecting its coordinates (~7.56°E, 47.57°N, matching Basel's real location). The gap in the current bundled file does not exist in this source.
- **Each feature has no name property at all** — only `properties: {}` and a numeric `id`, which is the **official Swiss canton number (KANTONSNUM)**, 1–26. This was cross-checked against known geography for multiple cantons (id 1 → ~8.43°E/47.57°N = Zürich; id 12 → Basel; id 21 → southernmost canton = Ticino; id 25 → Geneva; id 26 → Jura) and matches exactly. Because of this, canton matching in this plan is done by **numeric id**, not by name string — this is the "more robust than name-string matching" alternative the design spec flagged as worth adopting if available.
- Result size: 26 features, ~20,160 total vertices (~775/canton, the package's default ~50% simplification), **387 KB** uncompressed (vs. the current file's 52 KB — larger, but still a reasonable bundled static asset for an admin-only feature; gzip-over-HTTP shrinks this considerably in production, and no further simplification is required for a first version).

- [ ] **Step 1: Generate the replacement GeoJSON file**

Run these commands in a scratch directory (outside the repo, so nothing here touches this project's `package.json`):

```bash
mkdir -p /tmp/canton-geojson-prep && cd /tmp/canton-geojson-prep
```

Check the current `latest` version of `swiss-maps` (it may have moved past 4.7.0 by execution time — the file layout has been stable across years per the package's own `Makefile`, so a newer version should work the same way):

```bash
curl -sS "https://registry.npmjs.org/swiss-maps/latest" | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).version))"
```

Download the tarball for that version (substitute the version below if different) and extract just the 2026 combined TopoJSON:

```bash
curl -sS -o swiss-maps.tgz "https://registry.npmjs.org/swiss-maps/-/swiss-maps-4.7.0.tgz"
tar xzf swiss-maps.tgz package/2026/ch-combined.json
```

Install `topojson-client` in this scratch directory only (never in the repo):

```bash
npm init -y >/dev/null
npm install topojson-client
```

Convert the `cantons` object out of the combined topology into a plain GeoJSON `FeatureCollection`:

```bash
node -e "
const fs = require('fs');
const { feature } = require('./node_modules/topojson-client');
const topo = JSON.parse(fs.readFileSync('package/2026/ch-combined.json', 'utf8'));
const geo = feature(topo, topo.objects.cantons);
fs.writeFileSync('cantons.geojson', JSON.stringify(geo));
console.log('features:', geo.features.length);
"
```

Expected output: `features: 26`

- [ ] **Step 2: Verify the output before replacing the bundled file**

```bash
node -e "
const geo = JSON.parse(require('fs').readFileSync('cantons.geojson', 'utf8'));
const bs = geo.features.find((f) => f.id === 12);
console.log('feature count:', geo.features.length);
console.log('Basel-Stadt (id 12) geometry type:', bs && bs.geometry && bs.geometry.type);
console.log('any null geometries:', geo.features.some((f) => !f.geometry));
"
```

Expected output:
```
feature count: 26
Basel-Stadt (id 12) geometry type: Polygon
any null geometries: false
```

If any of these don't match (e.g. a future `swiss-maps` release changes the `cantons` object's shape), stop and re-investigate before proceeding — don't bundle a file that hasn't been verified.

- [ ] **Step 3: Replace the bundled file**

```bash
cp /tmp/canton-geojson-prep/cantons.geojson /home/user/schwingkeller/public/cantons.geojson
```

- [ ] **Step 4: Write the failing test for `Canton.kantonsnum`**

In `src/data/cantons.test.ts`, add a new test inside the existing `describe('cantons', ...)` block, after the `'looks up a canton by code'` test:

```ts
  it('has the official Swiss canton number (kantonsnum) for every canton, 1 through 26 with no gaps or repeats', () => {
    const numbers = CANTONS.map((c) => c.kantonsnum).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it('assigns kantonsnum 12 to Basel-Stadt and 2 to Bern (spot-check against known official numbering)', () => {
    expect(cantonByCode('BS')?.kantonsnum).toBe(12);
    expect(cantonByCode('BE')?.kantonsnum).toBe(2);
  });
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/data/cantons.test.ts`
Expected: FAIL — `TypeScript`/runtime error, `Canton` has no `kantonsnum` property yet, so `c.kantonsnum` is `undefined` for every entry.

- [ ] **Step 6: Add `kantonsnum` to every canton**

In `src/data/cantons.ts`, replace the whole file's interface and array (the official numbering is simply each canton's position in this already-existing, already-correctly-ordered list, 1-indexed — confirmed against the geography spot-check in Step 1):

```ts
// `w` is the Wikimedia Commons source basename: the bundled coat-of-arms SVG in
// public/wappen/<code>.svg was fetched from Special:FilePath/Wappen_<w>_matt.svg (following
// redirects). Kept as provenance for re-fetching, not used at runtime.
// `kantonsnum` is the official Swiss canton number (1-26, per the Federal Statistical Office /
// swisstopo numbering) — used to match a canton against public/cantons.geojson's border polygons,
// which key cantons by this number rather than a name string.
export interface Canton { code: string; name: string; w: string; kantonsnum: number }

export const CANTONS: Canton[] = [
  { code: 'ZH', name: 'Zürich', w: 'Zürich', kantonsnum: 1 }, { code: 'BE', name: 'Bern', w: 'Bern', kantonsnum: 2 },
  { code: 'LU', name: 'Luzern', w: 'Luzern', kantonsnum: 3 }, { code: 'UR', name: 'Uri', w: 'Uri', kantonsnum: 4 },
  { code: 'SZ', name: 'Schwyz', w: 'Schwyz', kantonsnum: 5 }, { code: 'OW', name: 'Obwalden', w: 'Obwalden', kantonsnum: 6 },
  { code: 'NW', name: 'Nidwalden', w: 'Nidwalden', kantonsnum: 7 }, { code: 'GL', name: 'Glarus', w: 'Glarus', kantonsnum: 8 },
  { code: 'ZG', name: 'Zug', w: 'Zug', kantonsnum: 9 }, { code: 'FR', name: 'Fribourg', w: 'Freiburg', kantonsnum: 10 },
  { code: 'SO', name: 'Solothurn', w: 'Solothurn', kantonsnum: 11 }, { code: 'BS', name: 'Basel-Stadt', w: 'Basel-Stadt', kantonsnum: 12 },
  { code: 'BL', name: 'Basel-Landschaft', w: 'Basel-Landschaft', kantonsnum: 13 }, { code: 'SH', name: 'Schaffhausen', w: 'Schaffhausen', kantonsnum: 14 },
  { code: 'AR', name: 'Appenzell Ausserrhoden', w: 'Appenzell_Ausserrhoden', kantonsnum: 15 },
  { code: 'AI', name: 'Appenzell Innerrhoden', w: 'Appenzell_Innerrhoden', kantonsnum: 16 },
  { code: 'SG', name: 'St. Gallen', w: 'St._Gallen', kantonsnum: 17 }, { code: 'GR', name: 'Graubünden', w: 'Graubünden', kantonsnum: 18 },
  { code: 'AG', name: 'Aargau', w: 'Aargau', kantonsnum: 19 }, { code: 'TG', name: 'Thurgau', w: 'Thurgau', kantonsnum: 20 },
  { code: 'TI', name: 'Ticino', w: 'Tessin', kantonsnum: 21 }, { code: 'VD', name: 'Vaud', w: 'Waadt', kantonsnum: 22 },
  { code: 'VS', name: 'Valais', w: 'Wallis', kantonsnum: 23 }, { code: 'NE', name: 'Neuchâtel', w: 'Neuenburg', kantonsnum: 24 },
  { code: 'GE', name: 'Genève', w: 'Genf', kantonsnum: 25 }, { code: 'JU', name: 'Jura', w: 'Jura', kantonsnum: 26 },
];

export const cantonByCode = (code: string): Canton | undefined =>
  CANTONS.find((c) => c.code === code);

// Served from public/wappen/<code>.svg — a same-origin bundled asset, so the off-screen poster
// canvas can draw it without tainting (Wikimedia's commons.wikimedia.org redirect endpoint does
// not send CORS headers on its 302, which blocked crossOrigin loads). BASE_URL keeps it correct
// under any deploy base path.
export const wappenUrl = (code: string): string => {
  const c = cantonByCode(code);
  return c ? `${import.meta.env.BASE_URL}wappen/${c.code}.svg` : '';
};
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/data/cantons.test.ts`
Expected: PASS (all tests, including the 2 new ones and the pre-existing `'contains all 26 cantons'`/`'looks up a canton by code'`/`'points the wappen URL...'` tests)

- [ ] **Step 8: Commit**

```bash
git add public/cantons.geojson src/data/cantons.ts src/data/cantons.test.ts
git commit -m "feat: replace canton border data with a complete 26-canton source, add kantonsnum"
```

---

### Task 2: `src/data/cantonGeoJson.ts` — load and match canton border features

**Files:**
- Create: `src/data/cantonGeoJson.ts`
- Create: `src/data/cantonGeoJson.test.ts`

**Interfaces:**
- Consumes: `cantonByCode` from `./cantons` (existing); `Canton.kantonsnum` (Task 1).
- Produces: `CantonGeometry` (union of `Polygon`/`MultiPolygon` shapes); `CantonFeature { type: 'Feature'; id: number; properties: Record<string, never>; geometry: CantonGeometry }`; `CantonFeatureCollection { type: 'FeatureCollection'; features: CantonFeature[] }`; `loadCantonGeoJson(): Promise<CantonFeatureCollection>`; `cantonFeaturesFor(code: string, fc: CantonFeatureCollection): CantonFeature[]`. Tasks 3, 4, and 6 consume these.

- [ ] **Step 1: Write the failing tests**

Create `src/data/cantonGeoJson.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadCantonGeoJson, cantonFeaturesFor, type CantonFeatureCollection } from './cantonGeoJson';

const feature = (id: number): CantonFeatureCollection['features'][number] => ({
  type: 'Feature', id, properties: {},
  geometry: { type: 'Polygon', coordinates: [[[7.4, 46.9], [7.5, 46.9], [7.5, 47.0], [7.4, 46.9]]] },
});

describe('loadCantonGeoJson', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('fetches the bundled geojson from BASE_URL and caches the result across repeated calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await loadCantonGeoJson();
    await loadCantonGeoJson();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/cantons.geojson');
  });
});

describe('cantonFeaturesFor', () => {
  it("returns the feature matching the canton's official number (kantonsnum)", () => {
    const fc: CantonFeatureCollection = { type: 'FeatureCollection', features: [feature(1), feature(2), feature(12)] };
    const result = cantonFeaturesFor('BE', fc); // BE = kantonsnum 2
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('returns an empty array for an unknown canton code', () => {
    const fc: CantonFeatureCollection = { type: 'FeatureCollection', features: [feature(1)] };
    expect(cantonFeaturesFor('XX', fc)).toEqual([]);
  });

  it('returns an empty array when no feature in the collection matches the canton', () => {
    const fc: CantonFeatureCollection = { type: 'FeatureCollection', features: [feature(1)] }; // only ZH present
    expect(cantonFeaturesFor('BE', fc)).toEqual([]); // BE = kantonsnum 2, not present
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/cantonGeoJson.test.ts`
Expected: FAIL — the module `./cantonGeoJson` doesn't exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/data/cantonGeoJson.ts`:

```ts
import { cantonByCode } from './cantons';

export type CantonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface CantonFeature {
  type: 'Feature';
  id: number; // official Swiss canton number (KANTONSNUM), matches Canton.kantonsnum
  properties: Record<string, never>;
  geometry: CantonGeometry;
}

export interface CantonFeatureCollection {
  type: 'FeatureCollection';
  features: CantonFeature[];
}

let cached: Promise<CantonFeatureCollection> | null = null;

export const loadCantonGeoJson = (): Promise<CantonFeatureCollection> => {
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}cantons.geojson`).then((r) => r.json());
  }
  return cached;
};

export const cantonFeaturesFor = (code: string, fc: CantonFeatureCollection): CantonFeature[] => {
  const canton = cantonByCode(code);
  if (!canton) return [];
  return fc.features.filter((f) => f.id === canton.kantonsnum);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/cantonGeoJson.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/data/cantonGeoJson.ts src/data/cantonGeoJson.test.ts
git commit -m "feat: add canton border data loader and canton-number matching"
```

---

### Task 3: `posterCanvas.ts` — `drawCantonBorder()`

**Files:**
- Modify: `src/features/venues/posterCanvas.ts`
- Modify: `src/features/venues/posterCanvas.test.ts`

**Interfaces:**
- Consumes: `CantonFeature` from `../../data/cantonGeoJson` (Task 2).
- Produces: `drawCantonBorder(ctx: CanvasRenderingContext2D, map: L.Map, features: CantonFeature[]): void`. Task 4 consumes this.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/posterCanvas.test.ts`, add to the top-level imports:

```ts
import { POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles, drawPin, drawPosterOverlay } from './posterCanvas';
```

becomes:

```ts
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage, extractTileDraws, drawTiles,
  drawPin, drawPosterOverlay, drawCantonBorder,
} from './posterCanvas';
import type { CantonFeature } from '../../data/cantonGeoJson';
```

Add a new `describe` block (e.g. right after `describe('drawPin', ...)`):

```ts
describe('drawCantonBorder', () => {
  const singlePiece = (id: number): CantonFeature => ({
    type: 'Feature', id, properties: {},
    geometry: { type: 'Polygon', coordinates: [[[7.4, 46.9], [7.5, 46.9], [7.5, 47.0]]] },
  });

  it('does nothing when there are no matching features', () => {
    const ctx = { stroke: vi.fn() } as unknown as CanvasRenderingContext2D;
    const map = { latLngToContainerPoint: vi.fn() } as unknown as L.Map;
    drawCantonBorder(ctx, map, []);
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(map.latLngToContainerPoint).not.toHaveBeenCalled();
  });

  it('projects every ring vertex (swapping GeoJSON [lng,lat] to Leaflet [lat,lng]) and strokes twice for the halo', () => {
    const ctx = { stroke: vi.fn(), lineJoin: '', strokeStyle: '', lineWidth: 0 } as unknown as CanvasRenderingContext2D;
    const latLngToContainerPoint = vi.fn().mockReturnValue({ x: 0, y: 0 });
    const map = { latLngToContainerPoint } as unknown as L.Map;

    drawCantonBorder(ctx, map, [singlePiece(2)]);

    expect(latLngToContainerPoint).toHaveBeenCalledTimes(3);
    expect(latLngToContainerPoint).toHaveBeenCalledWith([46.9, 7.4]);
    expect(latLngToContainerPoint).toHaveBeenCalledWith([47.0, 7.5]);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it('draws every ring of a MultiPolygon (a canton with exclaves)', () => {
    const ctx = { stroke: vi.fn(), lineJoin: '', strokeStyle: '', lineWidth: 0 } as unknown as CanvasRenderingContext2D;
    const latLngToContainerPoint = vi.fn().mockReturnValue({ x: 0, y: 0 });
    const map = { latLngToContainerPoint } as unknown as L.Map;
    const withExclave: CantonFeature = {
      type: 'Feature', id: 10, properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[6.7, 46.7], [6.8, 46.7], [6.8, 46.8]]],
          [[[7.0, 46.9], [7.1, 46.9], [7.1, 47.0]]],
        ],
      },
    };

    drawCantonBorder(ctx, map, [withExclave]);

    expect(latLngToContainerPoint).toHaveBeenCalledTimes(6); // 3 vertices per polygon piece x 2 pieces
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: FAIL — `drawCantonBorder` is not exported by `./posterCanvas`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/posterCanvas.ts`, add a type-only Leaflet import at the top (this file has no runtime Leaflet dependency today — only the `L.Map` type is needed for the parameter, so a type-only import avoids pulling in the Leaflet runtime unnecessarily):

```ts
import { theme } from '../../theme';
import { POSTER_SIZE, POSTER_LAYOUT } from './posterLayout';
```

becomes:

```ts
import type L from 'leaflet';
import { theme } from '../../theme';
import { POSTER_SIZE, POSTER_LAYOUT } from './posterLayout';
import type { CantonFeature } from '../../data/cantonGeoJson';
```

Add the function right after `drawPin` and before the `PosterOverlayOptions` interface:

```ts
// Traces the canton's official border on top of the captured map tiles, using the same
// map.latLngToContainerPoint() projection already used for venue pins — no new capture mechanism
// needed. A canton can be a Polygon or a MultiPolygon (exclaves); every ring of every polygon
// piece is stroked. The halo (dark pass underneath, white pass on top) keeps the line legible
// regardless of what's underneath — street map or satellite imagery.
export const drawCantonBorder = (
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  features: CantonFeature[],
): void => {
  if (features.length === 0) return;

  const path = new Path2D();
  features.forEach((feature) => {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    polygons.forEach((rings) => {
      rings.forEach((ring) => {
        ring.forEach(([lng, lat], i) => {
          const { x, y } = map.latLngToContainerPoint([lat, lng]);
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        });
        path.closePath();
      });
    });
  });

  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(17,17,17,0.85)';
  ctx.lineWidth = 6;
  ctx.stroke(path);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke(path);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/posterCanvas.test.ts`
Expected: PASS (3 new tests, plus every pre-existing test in the file, unaffected)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/posterCanvas.ts src/features/venues/posterCanvas.test.ts
git commit -m "feat: add drawCantonBorder with halo styling for the canton poster capture"
```

---

### Task 4: `cantonPoster.ts` — draw the border during generation

**Files:**
- Modify: `src/features/venues/cantonPoster.ts`
- Modify: `src/features/venues/cantonPoster.test.ts`

**Interfaces:**
- Consumes: `drawCantonBorder` (Task 3); `loadCantonGeoJson`, `cantonFeaturesFor` (Task 2).
- Produces: `GeneratePosterOptions` gains `showBorder?: boolean` (defaults to falsy/no border, matching the design's "off by default"). Task 7 (`PosterEditorModal.tsx`) passes it explicitly.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/cantonPoster.test.ts`, update the hoisted mocks. Replace:

```ts
const { drawTilesMock, drawPinMock, drawPosterOverlayMock, extractTileDrawsMock } = vi.hoisted(() => ({
  drawTilesMock: vi.fn(),
  drawPinMock: vi.fn(),
  drawPosterOverlayMock: vi.fn(),
  extractTileDrawsMock: vi.fn().mockReturnValue([]),
}));
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
```

with:

```ts
const { drawTilesMock, drawPinMock, drawPosterOverlayMock, extractTileDrawsMock, drawCantonBorderMock } = vi.hoisted(() => ({
  drawTilesMock: vi.fn(),
  drawPinMock: vi.fn(),
  drawPosterOverlayMock: vi.fn(),
  extractTileDrawsMock: vi.fn().mockReturnValue([]),
  drawCantonBorderMock: vi.fn(),
}));
vi.mock('./posterCanvas', async () => {
  const actual = await vi.importActual<typeof import('./posterCanvas')>('./posterCanvas');
  return {
    ...actual,
    loadImage: vi.fn().mockResolvedValue(null),
    drawTiles: drawTilesMock,
    drawPin: drawPinMock,
    drawPosterOverlay: drawPosterOverlayMock,
    extractTileDraws: extractTileDrawsMock,
    drawCantonBorder: drawCantonBorderMock,
  };
});

const { loadCantonGeoJsonMock } = vi.hoisted(() => ({ loadCantonGeoJsonMock: vi.fn() }));
vi.mock('../../data/cantonGeoJson', async () => {
  const actual = await vi.importActual<typeof import('../../data/cantonGeoJson')>('../../data/cantonGeoJson');
  return { ...actual, loadCantonGeoJson: loadCantonGeoJsonMock };
});
```

Add a new `describe` block at the end of the file, inside or after `describe('generateCantonPosterBlob', ...)` (as a sibling top-level block is simplest — add it right after that block's closing `});`):

```ts
describe('generateCantonPosterBlob — canton border', () => {
  beforeEach(() => {
    drawCantonBorderMock.mockClear();
    loadCantonGeoJsonMock.mockReset();
  });

  it('draws the canton border when showBorder is true and matching geometry exists', async () => {
    loadCantonGeoJsonMock.mockResolvedValue({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 2, properties: {}, geometry: { type: 'Polygon', coordinates: [[[7.4, 46.9], [7.5, 46.9], [7.5, 47.0]]] } }],
    });

    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller', showBorder: true });

    expect(drawCantonBorderMock).toHaveBeenCalledTimes(1);
    const features = drawCantonBorderMock.mock.calls[0][2];
    expect(features).toHaveLength(1);
    expect(features[0].id).toBe(2); // BE = kantonsnum 2
  });

  it('does not fetch or draw the border when showBorder is false or omitted', async () => {
    await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller' });

    expect(loadCantonGeoJsonMock).not.toHaveBeenCalled();
    expect(drawCantonBorderMock).not.toHaveBeenCalled();
  });

  it('does not reject poster generation when the geojson fetch fails — the border is silently skipped', async () => {
    loadCantonGeoJsonMock.mockRejectedValue(new Error('network error'));

    const result = await generateCantonPosterBlob('BE', venues, { baseKind: 'map', unitLabel: 'Schwingkeller', showBorder: true });

    expect(result.blob.type).toBe('image/png');
    expect(drawCantonBorderMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), []);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: FAIL — `generateCantonPosterBlob` doesn't accept `showBorder` yet and never calls `loadCantonGeoJson`/`drawCantonBorder`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/cantonPoster.ts`, update the `./posterCanvas` import:

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
  extractTileDraws, drawTiles, drawPin, drawPosterOverlay, drawCantonBorder,
} from './posterCanvas';
import { loadCantonGeoJson, cantonFeaturesFor } from '../../data/cantonGeoJson';
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
  showBorder?: boolean;
}
```

Update the destructure:

```ts
  const { baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl } = options;
```

becomes:

```ts
  const { baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl, showBorder } = options;
```

Finally, insert the border draw between the tiles draw and the pins loop. Replace:

```ts
    const tilePane = map.getPane('tilePane');
    if (tilePane) drawTiles(ctx, extractTileDraws(tilePane));

    const cantonVenues = venues.filter((v) => v.canton === code);
```

with:

```ts
    const tilePane = map.getPane('tilePane');
    if (tilePane) drawTiles(ctx, extractTileDraws(tilePane));

    if (showBorder) {
      // Non-critical: a failed fetch (network error, missing asset) just skips the border, the
      // same graceful-degradation already used for a failed Wappen image load below.
      const borderFeatures = await loadCantonGeoJson()
        .then((fc) => cantonFeaturesFor(code, fc))
        .catch(() => []);
      drawCantonBorder(ctx, map, borderFeatures);
    }

    const cantonVenues = venues.filter((v) => v.canton === code);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/cantonPoster.test.ts`
Expected: PASS (3 new tests, plus every pre-existing test — none of them pass `showBorder`, so it's `undefined`/falsy and the border path is skipped entirely, matching today's behavior)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/cantonPoster.ts src/features/venues/cantonPoster.test.ts
git commit -m "feat: draw the canton border during poster generation when showBorder is set"
```

---

### Task 5: i18n key for the border toggle

**Files:**
- Modify: `src/i18n/translations.ts`

**Interfaces:**
- Produces: `t.posterToggleBorder` in `de`/`fr`/`it`. Task 7 consumes this.

- [ ] **Step 1: Add the key to all three languages**

In `src/i18n/translations.ts`, in the `de` block, replace:

```ts
    posterToggleQr: 'QR-Code',
```

with:

```ts
    posterToggleQr: 'QR-Code',
    posterToggleBorder: 'Kantonsgrenze',
```

In the `fr` block, replace:

```ts
    posterToggleQr: 'Code QR',
```

with:

```ts
    posterToggleQr: 'Code QR',
    posterToggleBorder: 'Frontière cantonale',
```

In the `it` block, replace:

```ts
    posterToggleQr: 'Codice QR',
```

with:

```ts
    posterToggleQr: 'Codice QR',
    posterToggleBorder: 'Confine cantonale',
```

- [ ] **Step 2: Verify the file still type-checks**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add i18n key for the canton border toggle"
```

---

### Task 6: `usePosterCantonBorder` hook

**Files:**
- Create: `src/features/venues/usePosterCantonBorder.ts`
- Create: `src/features/venues/usePosterCantonBorder.test.ts`

**Interfaces:**
- Consumes: `loadCantonGeoJson`, `cantonFeaturesFor`, `CantonFeature` from `../../data/cantonGeoJson` (Task 2).
- Produces: `usePosterCantonBorder(code: string): CantonFeature[]`. Task 7 consumes this.

- [ ] **Step 1: Write the failing tests**

Create `src/features/venues/usePosterCantonBorder.test.ts`, mirroring the existing `usePosterQr.test.ts` pattern (mock the data-loading dependency, use the real matching logic):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { loadCantonGeoJson } = vi.hoisted(() => ({ loadCantonGeoJson: vi.fn() }));
vi.mock('../../data/cantonGeoJson', async () => {
  const actual = await vi.importActual<typeof import('../../data/cantonGeoJson')>('../../data/cantonGeoJson');
  return { ...actual, loadCantonGeoJson };
});

import { usePosterCantonBorder } from './usePosterCantonBorder';

const feature = (id: number) => ({
  type: 'Feature' as const, id, properties: {},
  geometry: { type: 'Polygon' as const, coordinates: [[[7.4, 46.9], [7.5, 46.9], [7.5, 47.0]]] },
});

describe('usePosterCantonBorder', () => {
  beforeEach(() => { loadCantonGeoJson.mockReset(); });

  it('loads and returns the features matching the given canton', async () => {
    loadCantonGeoJson.mockResolvedValue({ type: 'FeatureCollection', features: [feature(2)] }); // BE = kantonsnum 2
    const { result } = renderHook(() => usePosterCantonBorder('BE'));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe(2);
  });

  it('returns an empty array when the geojson fetch rejects', async () => {
    loadCantonGeoJson.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => usePosterCantonBorder('BE'));
    await waitFor(() => expect(loadCantonGeoJson).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('re-fetches and returns the new canton\'s features when the code changes', async () => {
    loadCantonGeoJson.mockResolvedValue({ type: 'FeatureCollection', features: [feature(2), feature(12)] });
    const { result, rerender } = renderHook(({ code }) => usePosterCantonBorder(code), { initialProps: { code: 'BE' } });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe(2);

    rerender({ code: 'BS' }); // kantonsnum 12
    await waitFor(() => expect(result.current[0]?.id).toBe(12));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/usePosterCantonBorder.test.ts`
Expected: FAIL — the module `./usePosterCantonBorder` doesn't exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `src/features/venues/usePosterCantonBorder.ts`:

```ts
import { useEffect, useState } from 'react';
import { loadCantonGeoJson, cantonFeaturesFor, type CantonFeature } from '../../data/cantonGeoJson';

export const usePosterCantonBorder = (code: string): CantonFeature[] => {
  const [features, setFeatures] = useState<CantonFeature[]>([]);

  useEffect(() => {
    let active = true;
    setFeatures([]);
    loadCantonGeoJson()
      .then((fc) => { if (active) setFeatures(cantonFeaturesFor(code, fc)); })
      .catch(() => { if (active) setFeatures([]); });
    return () => { active = false; };
  }, [code]);

  return features;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/usePosterCantonBorder.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/usePosterCantonBorder.ts src/features/venues/usePosterCantonBorder.test.ts
git commit -m "feat: add usePosterCantonBorder hook for the live poster editor preview"
```

---

### Task 7: `PosterEditorModal.tsx` — border toggle and live map halo layers

**Files:**
- Modify: `src/features/venues/PosterEditorModal.tsx`
- Modify: `src/features/venues/PosterEditorModal.test.tsx`

**Interfaces:**
- Consumes: `usePosterCantonBorder` (Task 6); `GeneratePosterOptions.showBorder` (Task 4); `t.posterToggleBorder` (Task 5).
- Produces: nothing consumed by other tasks — this is the last task in the chain.

- [ ] **Step 1: Write the failing tests**

In `src/features/venues/PosterEditorModal.test.tsx`, add a hoisted `geoJSONMock` alongside the existing `fakeMap` mock. Replace:

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
  },
}));
```

with:

```ts
const { fakeMap, geoJSONMock } = vi.hoisted(() => ({
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
  geoJSONMock: vi.fn(() => ({ addTo: vi.fn().mockReturnThis() })),
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
    geoJSON: geoJSONMock,
  },
}));
```

Add a mock for the new hook, right after the existing `vi.mock('./usePosterQr', ...)`:

```ts
vi.mock('./usePosterCantonBorder', () => ({
  usePosterCantonBorder: () => [{
    type: 'Feature', id: 2, properties: {},
    geometry: { type: 'Polygon', coordinates: [[[7.4, 46.9], [7.5, 46.9], [7.5, 47.0]]] },
  }],
}));
```

Add a new `describe` block at the end of the file, after the closing `});` of `describe('PosterEditorModal', ...)`:

```tsx
describe('canton border', () => {
  beforeEach(() => { generateCantonPosterBlob.mockClear(); geoJSONMock.mockClear(); });

  it('renders the border toggle, defaulting to off', () => {
    renderEditor();
    expect(screen.getByLabelText(STR.de.posterToggleBorder)).not.toBeChecked();
  });

  it('adds two map layers (halo + line) when toggled on, and removes them when toggled back off', async () => {
    const user = userEvent.setup();
    renderEditor();
    // fakeMap and geoJSONMock are hoisted, file-scoped singletons shared across every test in this
    // file (nothing here resets them between tests) — compare deltas rather than absolute counts
    // so this test doesn't depend on what any other test did before it ran.
    const geoJsonCallsBefore = geoJSONMock.mock.calls.length;
    const removeLayerCallsBefore = fakeMap.removeLayer.mock.calls.length;

    await user.click(screen.getByLabelText(STR.de.posterToggleBorder));
    expect(geoJSONMock.mock.calls.length - geoJsonCallsBefore).toBe(2);

    await user.click(screen.getByLabelText(STR.de.posterToggleBorder));
    expect(fakeMap.removeLayer.mock.calls.length - removeLayerCallsBefore).toBe(2);
  });

  it('forwards showBorder to generateCantonPosterBlob', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(STR.de.posterToggleBorder));
    await user.click(screen.getByRole('button', { name: STR.de.posterDownload }));
    await waitFor(() => expect(generateCantonPosterBlob).toHaveBeenCalled());
    expect(generateCantonPosterBlob.mock.calls[0][2]).toMatchObject({ showBorder: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: FAIL — the border toggle doesn't exist yet, `L.geoJSON` is never called, and `generateCantonPosterBlob` is never called with `showBorder`.

- [ ] **Step 3: Write the minimal implementation**

In `src/features/venues/PosterEditorModal.tsx`, add the import:

```ts
import { usePosterQr } from './usePosterQr';
```

becomes:

```ts
import { usePosterQr } from './usePosterQr';
import { usePosterCantonBorder } from './usePosterCantonBorder';
```

Add the new state, right after `showQr`:

```ts
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [busy, setBusy] = useState(false);

  const { dataUrl: qrDataUrl } = usePosterQr(code);
```

becomes:

```ts
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showBorder, setShowBorder] = useState(false);
  const [busy, setBusy] = useState(false);

  const { dataUrl: qrDataUrl } = usePosterQr(code);
  const borderFeatures = usePosterCantonBorder(code);
```

Add a new effect that adds/removes the two halo layers, right after the base-layer-swap effect (after its closing `}, [baseKind]);`, before `resetFraming`):

```ts
  // Overlay the canton's official border on the live map when the toggle is on and its geometry
  // has loaded. Two native L.geoJSON layers (thick dark underneath, thin white on top) give the
  // same halo look the off-screen capture draws manually — Leaflet re-projects them automatically
  // on pan/zoom, so no manual redraw logic is needed here (unlike the static capture).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showBorder || borderFeatures.length === 0) return;
    const fc = { type: 'FeatureCollection' as const, features: borderFeatures };
    // Leaflet's GeoJSON layer factory expects the full GeoJSON geometry union (Point, LineString,
    // etc.); our CantonFeature is intentionally narrower (Polygon/MultiPolygon only), so this cast
    // bridges the two without an `any`.
    const geoJsonData = fc as unknown as Parameters<typeof L.geoJSON>[0];
    const halo = L.geoJSON(geoJsonData, { style: { color: 'rgba(17,17,17,0.85)', weight: 6, fill: false } }).addTo(map);
    const line = L.geoJSON(geoJsonData, { style: { color: '#ffffff', weight: 2.5, fill: false } }).addTo(map);
    return () => {
      map.removeLayer(halo);
      map.removeLayer(line);
    };
  }, [showBorder, borderFeatures]);
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
        showBorder,
      });
```

Add the toggle to the controls panel, right after the QR toggle:

```tsx
            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
              {toggle('footer', t.posterToggleFooter, showFooter, setShowFooter)}
              {toggle('qr', t.posterToggleQr, showQr, setShowQr)}
            </div>
```

becomes:

```tsx
            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
              {toggle('footer', t.posterToggleFooter, showFooter, setShowFooter)}
              {toggle('qr', t.posterToggleQr, showQr, setShowQr)}
              {toggle('border', t.posterToggleBorder, showBorder, setShowBorder)}
            </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/venues/PosterEditorModal.test.tsx`
Expected: PASS (all pre-existing tests, plus the 3 new `describe('canton border', ...)` tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/PosterEditorModal.tsx src/features/venues/PosterEditorModal.test.tsx
git commit -m "feat: add canton border toggle with live-map halo preview to the poster editor"
```

---

### Task 8: Full verification and manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including every file touched across Tasks 1-7 and every other existing suite (unaffected by this change).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the type checker**

Run: `npm run typecheck`
Expected: no errors (in particular: the `Parameters<typeof L.geoJSON>[0]` cast resolves correctly, and `CantonFeature`'s narrower geometry union is accepted everywhere it flows into Leaflet's broader GeoJSON-typed APIs).

- [ ] **Step 4: Manual verification in the dev server**

Run: `npm run dev`, open the app, log in as admin, and open the poster editor (per `docs/superpowers/specs/2026-07-21-poster-canton-border-design.md`'s "Verification before shipping" section) for:
- a canton with a simple single-piece border (e.g. Zug) — confirm the border traces its outline correctly in both the live preview and the exported PNG,
- a canton with exclaves (e.g. Fribourg) — confirm every piece of the border is drawn, not just the main body,
- Basel-Stadt — confirm the toggle stays enabled and clickable, but the border silently doesn't render (no crash, no error toast),
- both the map and satellite base layers — confirm the white/dark halo stays legible against both,
- confirm the border doesn't visually collide with venue pins or the header/footer chrome, and that the live preview's border position matches the downloaded PNG's.

- [ ] **Step 5: Commit any fixups found during manual verification**

If manual verification surfaces an issue, fix it, re-run Steps 1-3, and commit:

```bash
git add -A
git commit -m "fix: address manual verification findings for canton border overlay"
```

If no issues are found, skip this step — Task 7's commit is the final commit for this plan.
