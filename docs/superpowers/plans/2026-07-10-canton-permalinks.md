# Canton-centered permalinks (?ctn=FR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support `?ctn=<code>` (e.g. `?ctn=FR`) so a shared URL pans/zooms the map to that canton's real geographic bounds and expands its sidebar group on load.

**Architecture:** Two new pure modules (a static per-canton bounds lookup, and a URL-param parser) feed a new one-shot `initialFocusBounds` prop on `MapView`, wired up via a read-once `useState` initializer in `App.tsx`. No router, no live URL sync, no new dependencies.

**Tech Stack:** React 19, TypeScript, Vite, Leaflet (via existing `MapView.tsx`), Vitest.

## Global Constraints

- No new npm dependencies (spec confirmed none needed — `URLSearchParams` is a native Web API).
- Don't use `any` in TypeScript — use proper types.
- `?ctn=` parsing is read-only at startup only — no two-way URL sync (out of scope).
- Matching is case-insensitive (`?ctn=fr` behaves like `?ctn=FR`).
- An unrecognized code silently falls back to the default view — no error/toast.
- A recognized code with zero current venues still fits the canton's real bounds (bounds don't depend on venue data).
- Mobile sidebar drawer stays closed by default — unchanged, no auto-open.
- Run `npm run test` and `npm run lint` before treating any task as complete.
- Use TDD: write the failing test before the implementation, for every task that has one.

---

### Task 1: Canton bounds lookup

**Files:**
- Create: `src/data/cantonBounds.ts`
- Test: `src/data/cantonBounds.test.ts`

**Interfaces:**
- Consumes: `CANTONS` from `src/data/cantons.ts` (`{ code: string; name: string; w: string }[]`, 26 entries) — test-only, to check the two tables don't drift apart.
- Produces: `CantonBounds = [[number, number], [number, number]]`; `CANTON_BOUNDS: Record<string, CantonBounds>`; `boundsForCanton(code: string): CantonBounds | null`. Task 3 consumes `boundsForCanton`.

- [ ] **Step 1: Write the failing test**

Create `src/data/cantonBounds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { boundsForCanton, CANTON_BOUNDS } from './cantonBounds';
import { CANTONS } from './cantons';

describe('boundsForCanton', () => {
  it('returns the precomputed bounds for a known code', () => {
    expect(boundsForCanton('FR')).toEqual([[46.43791, 6.74187], [47.00681, 7.38021]]);
  });

  it('returns null for an unknown code', () => {
    expect(boundsForCanton('XX')).toBeNull();
  });

  it('has a bounds entry for every canton in CANTONS', () => {
    const missing = CANTONS.filter((c) => !CANTON_BOUNDS[c.code]);
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/cantonBounds.test.ts`
Expected: FAIL — `Cannot find module './cantonBounds'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/data/cantonBounds.ts`:

```ts
export type CantonBounds = [[number, number], [number, number]];

// Precomputed once, offline, from the official swisstopo swissBOUNDARIES3D
// dataset (TLM_KANTONSGEBIET layer, January 2026 release, EPSG:2056/LV95),
// reprojected to WGS84 (EPSG:4326) and rounded to 5 decimal places (~1m
// precision — matches the rounding already used for hand-picked venue
// coordinates in MapView.tsx's onMapClick). Licensed for reuse under
// swisstopo's free-geodata license. Cantonal borders essentially never
// change, so this isn't regenerated automatically as part of the build.
export const CANTON_BOUNDS: Record<string, CantonBounds> = {
  ZH: [[47.15944, 8.35769], [47.69447, 8.98495]],
  BE: [[46.32647, 6.86149], [47.34531, 8.45516]],
  LU: [[46.77499, 7.83642], [47.28719, 8.51406]],
  UR: [[46.52761, 8.39736], [46.99341, 8.95781]],
  SZ: [[46.88528, 8.38875], [47.22256, 9.00472]],
  OW: [[46.75317, 8.0422], [46.98036, 8.50689]],
  NW: [[46.77151, 8.2181], [47.01995, 8.57495]],
  GL: [[46.79647, 8.87124], [47.17399, 9.25259]],
  ZG: [[47.08103, 8.39485], [47.24837, 8.70117]],
  FR: [[46.43791, 6.74187], [47.00681, 7.38021]],
  SO: [[47.07434, 7.34042], [47.5027, 8.03138]],
  BS: [[47.5193, 7.55466], [47.60092, 7.6938]],
  BL: [[47.33788, 7.32519], [47.56437, 7.96184]],
  SH: [[47.55236, 8.40464], [47.80845, 8.87623]],
  AR: [[47.24702, 9.1911], [47.46904, 9.63097]],
  AI: [[47.23399, 9.30972], [47.44369, 9.6184]],
  SG: [[46.87288, 8.79562], [47.54974, 9.67414]],
  GR: [[46.16915, 8.65107], [47.06515, 10.49217]],
  AG: [[47.13748, 7.71353], [47.62108, 8.45511]],
  TG: [[47.37592, 8.66799], [47.69541, 9.50695]],
  TI: [[45.81796, 8.38219], [46.63248, 9.15969]],
  VD: [[46.18707, 6.06386], [46.98691, 7.24918]],
  VS: [[45.85819, 6.77058], [46.65405, 8.47852]],
  NE: [[46.84659, 6.43269], [47.16574, 7.08765]],
  GE: [[46.12855, 5.9559], [46.36458, 6.31028]],
  JU: [[47.15041, 6.84073], [47.50447, 7.55835]],
};

export const boundsForCanton = (code: string): CantonBounds | null =>
  CANTON_BOUNDS[code] ?? null;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/cantonBounds.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/cantonBounds.ts src/data/cantonBounds.test.ts
git commit -m "feat: add precomputed per-canton bounds lookup"
```

---

### Task 2: Canton URL param parser

**Files:**
- Create: `src/lib/permalink.ts`
- Test: `src/lib/permalink.test.ts`

**Interfaces:**
- Consumes: `cantonByCode` from `src/data/cantons.ts` (`(code: string) => Canton | undefined`).
- Produces: `parseCantonParam(search: string): string | null`. Task 3 consumes this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/permalink.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCantonParam } from './permalink';

describe('parseCantonParam', () => {
  it('returns the uppercase code for a valid canton', () => {
    expect(parseCantonParam('?ctn=FR')).toBe('FR');
  });

  it('is case-insensitive', () => {
    expect(parseCantonParam('?ctn=fr')).toBe('FR');
  });

  it('returns null for an unrecognized code', () => {
    expect(parseCantonParam('?ctn=XX')).toBeNull();
  });

  it('returns null when the param is missing', () => {
    expect(parseCantonParam('?foo=bar')).toBeNull();
  });

  it('returns null for an empty search string', () => {
    expect(parseCantonParam('')).toBeNull();
  });

  it('reads ctn from among other query params', () => {
    expect(parseCantonParam('?foo=bar&ctn=be&baz=1')).toBe('BE');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/permalink.test.ts`
Expected: FAIL — `Cannot find module './permalink'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/permalink.ts`:

```ts
import { cantonByCode } from '../data/cantons';

// The seam for the future ?venue= permalink (see issue #10): once it
// exists, its parsing should run first and take precedence over ?ctn=
// when both are present, since a venue is more specific than a canton.
export const parseCantonParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('ctn');
  if (!raw) return null;
  const code = raw.toUpperCase();
  return cantonByCode(code) ? code : null;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/permalink.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/permalink.ts src/lib/permalink.test.ts
git commit -m "feat: add ?ctn= query param parser"
```

---

### Task 3: Wire ?ctn= into MapView and App

**Files:**
- Modify: `src/features/map/MapView.tsx:12-22` (props interface), `:76-79` (destructure), `:82-90` (refs), insert new effect after `:267`
- Modify: `src/App.tsx:1-16` (imports), `:60-62` (state), `:92` (derived value), `:264-273` (MapView JSX)

**Interfaces:**
- Consumes: `boundsForCanton` (Task 1), `parseCantonParam` (Task 2).
- Produces: `MapViewProps.initialFocusBounds?: [[number, number], [number, number]] | null` — end of chain, nothing downstream consumes it.

This task has no automated test — this codebase has no `MapView.test.tsx` or `App.test.tsx` (Leaflet internals aren't unit-tested here; see `src/features/map/MapView.tsx` and note the existing untested `registerFitAll` prop it mirrors). Verification is a manual browser check in Step 5.

- [ ] **Step 1: Add the `initialFocusBounds` prop to `MapView`**

In `src/features/map/MapView.tsx`, add to the `MapViewProps` interface (after `registerFitAll?: (fn: () => void) => void;` on line 21):

```ts
  registerFitAll?: (fn: () => void) => void;
  initialFocusBounds?: [[number, number], [number, number]] | null;
```

Add `initialFocusBounds` to the destructured props (line 76-79 becomes):

```ts
export function MapView({
  venues, selectedId, onSelect, onOpenDetail,
  baseKind, onChangeBase, placing, onPickLocation, registerFitAll, initialFocusBounds,
}: MapViewProps) {
```

Add a new ref alongside the existing `fitAllBgClip` state (after line 90, `const [fitAllBgClip, setFitAllBgClip] = useState(FIT_ALL_DEFAULT_BG_CLIP);`):

```ts
  const [fitAllBgClip, setFitAllBgClip] = useState(FIT_ALL_DEFAULT_BG_CLIP);
  const appliedInitialFocusRef = useRef(false);
```

- [ ] **Step 2: Add the one-shot focus effect**

In `src/features/map/MapView.tsx`, immediately after the existing "Expose fit-all-bounds." effect (ends at line 267 with `}, [registerFitAll]);`), insert:

```ts
  // Apply the initial canton-focus bounds once, the first time they're
  // available (venues load async, but these bounds don't depend on venues —
  // they can arrive as early as the first render). Never re-fires, so a
  // later re-render can't re-snap the view while the user is browsing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialFocusBounds || appliedInitialFocusRef.current) return;
    appliedInitialFocusRef.current = true;
    map.flyToBounds(initialFocusBounds, { padding: [40, 40], maxZoom: 15, duration: 0.8 });
  }, [initialFocusBounds]);
```

- [ ] **Step 3: Parse `?ctn=` once and derive bounds in `App.tsx`**

In `src/App.tsx`, add two imports after the existing `import { theme } from './theme';` (line 16):

```ts
import { theme } from './theme';
import { parseCantonParam } from './lib/permalink';
import { boundsForCanton } from './data/cantonBounds';
```

Replace the `search`/`expanded` state block (lines 60-61):

```ts
  // Cross-cutting UI state.
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ BE: true });
```

with:

```ts
  // Cross-cutting UI state.
  // Parsed once at startup — this is not a live two-way URL sync (see
  // docs/superpowers/specs/2026-07-10-canton-permalinks-design.md).
  const [ctnParam] = useState<string | null>(() => parseCantonParam(window.location.search));
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    ctnParam ? { [ctnParam]: true } : { BE: true },
  );
```

Add the derived bounds value right after `const detailVenue = ...` (line 92):

```ts
  const detailVenue = detailId ? venues.find((v) => v.id === detailId) ?? null : null;
  const initialFocusBounds = ctnParam ? boundsForCanton(ctnParam) : null;
```

- [ ] **Step 4: Pass the bounds into `MapView`**

In `src/App.tsx`, in the `<MapView ... />` JSX (lines 264-273), add the new prop:

```tsx
          <MapView
            venues={venues}
            selectedId={selectedId}
            onSelect={selectVenue}
            onOpenDetail={openDetail}
            baseKind={baseKind}
            onChangeBase={setBaseKind}
            placing={placing}
            onPickLocation={onPickLocation}
            initialFocusBounds={initialFocusBounds}
          />
```

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`

Then check, for each case, in a browser:

1. Visit `http://localhost:5173/?ctn=FR` — the map should pan/zoom to Fribourg's bounding box (roughly 46.44–47.01°N, 6.74–7.38°E — the Lac de Neuchâtel/Fribourg area, well southwest of the default full-CH view). If any venues exist in Fribourg, the sidebar's Fribourg group should be expanded.
2. Visit `http://localhost:5173/?ctn=fr` (lowercase) — same result as step 1 (case-insensitive).
3. Visit `http://localhost:5173/?ctn=XX` (invalid code) — the map shows the normal default full-Switzerland view, no error shown, no group forced open.
4. Visit `http://localhost:5173/` (no param) — unchanged from before this change: default view, Bern's sidebar group expanded (`{ BE: true }`).

- [ ] **Step 6: Run the full test suite and lint**

Run: `npm run test && npm run lint`
Expected: all existing tests still pass (no regressions), lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/map/MapView.tsx src/App.tsx
git commit -m "feat: fit map and expand sidebar for ?ctn= permalinks"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `src/data/cantonBounds.test.ts` and `src/lib/permalink.test.ts`.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both clean, no errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: builds successfully (confirms `src/data/cantonBounds.ts`'s object literal and the new `MapView`/`App.tsx` types all check out under `tsc -b`).
