# "Nearest to Me" Geolocation Sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Canton/Name/Distance view control to the sidebar plus a shared geolocation source that powers both a "nearest-first" flat venue list and a "locate me" button on the map.

**Architecture:** One `useGeolocation` hook (lifted into `App`) is the single source of the user's position — consumed by both `MapView` (locate button + "you are here" marker) and `Sidebar` (Distance sort + per-row distance badges). Canton grouping stays the default; picking Name or Distance flattens the list, with each flat row carrying a mini canton Wappen. All logic is client-side; no data-layer changes.

**Tech Stack:** Vite + TypeScript, React 19, Leaflet + react-leaflet, Vitest + React Testing Library. Browser `navigator.geolocation` (no new dependencies).

## Global Constraints

- **No new npm dependencies** — haversine is a pure function; the user marker reuses Leaflet.
- **i18n parity:** every new UI string must be added to `STR.de`, `STR.fr`, and `STR.it` in the same commit (`translations.test.ts` asserts identical key sets across all three).
- **No `any`** — use proper types or `unknown`.
- **TDD:** write the failing test first, watch it fail, implement minimally, watch it pass, commit.
- **Never auto-request geolocation on load** — only on explicit user action.
- **One-shot `getCurrentPosition`**, never `watchPosition`.
- Commits use Conventional Commits format. Work stays on branch `claude/nearest-to-me-geolocation`.
- Run `npm run test` and `npm run lint` before considering any task done.

---

## File Structure

**Create:**
- `src/features/venues/distance.ts` — pure haversine, distance formatting, distance sort.
- `src/features/venues/distance.test.ts` — tests for the above.
- `src/features/geo/useGeolocation.ts` — shared one-shot geolocation hook + `GeoStatus`/`LatLng` types.
- `src/features/geo/useGeolocation.test.ts` — tests for the hook.

**Modify:**
- `src/features/venues/grouping.ts` — add `flatSorted()` + `SortMode` type.
- `src/features/venues/grouping.test.ts` — tests for `flatSorted`.
- `src/features/map/markers.tsx` — add `userPinHtml()`.
- `src/features/map/markers.test.ts` — test `userPinHtml`.
- `src/i18n/translations.ts` — add sort/location keys to de/fr/it.
- `src/features/sidebar/Sidebar.tsx` — sort control + flat-list rendering + distance badges.
- `src/features/sidebar/Sidebar.test.tsx` — tests for the control, flat modes, badges.
- `src/features/map/MapView.tsx` — locate button + "you are here" marker (manual verification).
- `src/App.tsx` — own `sortMode` state + `useGeolocation`; wire props to Sidebar and MapView.

**Testing note:** There is no `MapView.test.tsx` in this codebase — map behavior is unit-tested through the pure `markers.ts` factories, and the component itself is verified manually (Leaflet needs a real DOM/canvas). This plan follows that convention: the "you are here" marker is delivered as a pure `userPinHtml()` helper with its own test (Task 4), while the MapView wiring (Task 7) is verified by hand.

---

### Task 1: Distance module (haversine, format, sort)

**Files:**
- Create: `src/features/venues/distance.ts`
- Test: `src/features/venues/distance.test.ts`

**Interfaces:**
- Consumes: `Venue` from `./types` (only for the generic sort constraint).
- Produces:
  - `interface LatLng { lat: number; lng: number }`
  - `haversineKm(a: LatLng, b: LatLng): number`
  - `formatDistance(km: number, locale: string): string`
  - `sortByDistance<T extends LatLng>(items: T[], origin: LatLng): T[]` (returns a new array, ascending by distance; does not mutate input)

- [ ] **Step 1: Write the failing test**

```ts
// src/features/venues/distance.test.ts
import { describe, it, expect } from 'vitest';
import { haversineKm, formatDistance, sortByDistance } from './distance';

describe('haversineKm', () => {
  it('computes ~95 km between Bern and Zürich', () => {
    const bern = { lat: 46.948, lng: 7.447 };
    const zurich = { lat: 47.377, lng: 8.540 };
    expect(haversineKm(bern, zurich)).toBeGreaterThan(90);
    expect(haversineKm(bern, zurich)).toBeLessThan(100);
  });
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 46, lng: 7 }, { lat: 46, lng: 7 })).toBe(0);
  });
});

describe('formatDistance', () => {
  it('shows metres below 1 km, rounded to the nearest 10', () => {
    expect(formatDistance(0.847, 'de')).toBe('850 m');
  });
  it('shows one decimal from 1 to 99 km', () => {
    expect(formatDistance(4.23, 'de')).toBe('4.2 km');
  });
  it('uses the locale decimal separator', () => {
    expect(formatDistance(4.23, 'fr')).toBe('4,2 km');
  });
  it('shows a whole number at or above 100 km', () => {
    expect(formatDistance(123.6, 'de')).toBe('124 km');
  });
});

describe('sortByDistance', () => {
  it('orders nearest first without mutating the input', () => {
    const origin = { lat: 46.95, lng: 7.45 };
    const input = [
      { id: 'far', lat: 47.38, lng: 8.54 },
      { id: 'near', lat: 46.96, lng: 7.46 },
    ];
    const out = sortByDistance(input, origin);
    expect(out.map((x) => x.id)).toEqual(['near', 'far']);
    expect(input[0].id).toBe('far'); // input untouched
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/venues/distance.test.ts`
Expected: FAIL — cannot resolve `./distance`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/venues/distance.ts
export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371; // Earth radius in km
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export const haversineKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatDistance = (km: number, locale: string): string => {
  if (km < 1) {
    const m = Math.round((km * 1000) / 10) * 10;
    return `${new Intl.NumberFormat(locale).format(m)} m`;
  }
  if (km < 100) {
    const n = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(km);
    return `${n} km`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(km)} km`;
};

export const sortByDistance = <T extends LatLng>(items: T[], origin: LatLng): T[] =>
  [...items].sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/venues/distance.test.ts`
Expected: PASS (all 7 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/distance.ts src/features/venues/distance.test.ts
git commit -m "feat: add haversine distance, formatting, and sort utilities"
```

---

### Task 2: `flatSorted` in grouping.ts

**Files:**
- Modify: `src/features/venues/grouping.ts`
- Test: `src/features/venues/grouping.test.ts`

**Interfaces:**
- Consumes: `Venue` from `./types`; `LatLng`, `sortByDistance` from `./distance`.
- Produces:
  - `type SortMode = 'canton' | 'name' | 'distance'`
  - `flatSorted(venues: Venue[], mode: SortMode, origin?: LatLng | null): Venue[]`
    - `mode === 'name'` → new array sorted by `name` (German collation).
    - `mode === 'distance'` with a non-null `origin` → nearest-first via `sortByDistance`.
    - `mode === 'distance'` with no `origin` → falls back to name order (list still usable before a fix arrives).
    - `mode === 'canton'` → returns the input unchanged (flat rendering is never used for canton mode; grouping handles it).

- [ ] **Step 1: Write the failing test** (append to `grouping.test.ts`)

```ts
import { flatSorted } from './grouping';
// ...reuse existing `Venue` fixtures or build inline ones...

describe('flatSorted', () => {
  const mk = (id: string, name: string, lat: number, lng: number) => ({
    id, name, canton: 'BE', address: '', lat, lng,
    indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null,
  });
  const venues = [mk('1', 'Zug-Halle', 47.2, 8.5), mk('2', 'Aare-Keller', 46.9, 7.4)];

  it('sorts by name A→Z', () => {
    expect(flatSorted(venues, 'name').map((v) => v.name)).toEqual(['Aare-Keller', 'Zug-Halle']);
  });
  it('sorts by distance nearest-first when an origin is given', () => {
    const origin = { lat: 46.95, lng: 7.45 };
    expect(flatSorted(venues, 'distance', origin).map((v) => v.id)).toEqual(['2', '1']);
  });
  it('falls back to name order for distance mode with no origin', () => {
    expect(flatSorted(venues, 'distance', null).map((v) => v.name)).toEqual(['Aare-Keller', 'Zug-Halle']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/venues/grouping.test.ts`
Expected: FAIL — `flatSorted` is not exported.

- [ ] **Step 3: Write the implementation** (append to `grouping.ts`)

```ts
import type { LatLng } from './distance';
import { sortByDistance } from './distance';

export type SortMode = 'canton' | 'name' | 'distance';

export const flatSorted = (
  venues: Venue[],
  mode: SortMode,
  origin?: LatLng | null,
): Venue[] => {
  if (mode === 'distance' && origin) return sortByDistance(venues, origin);
  if (mode === 'name' || mode === 'distance') {
    return [...venues].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  return venues;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/venues/grouping.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/grouping.ts src/features/venues/grouping.test.ts
git commit -m "feat: add flatSorted for name/distance venue ordering"
```

---

### Task 3: `useGeolocation` hook

**Files:**
- Create: `src/features/geo/useGeolocation.ts`
- Test: `src/features/geo/useGeolocation.test.ts`

**Interfaces:**
- Consumes: `LatLng` from `../venues/distance`.
- Produces:
  - `type GeoStatus = 'unsupported' | 'idle' | 'prompting' | 'granted' | 'denied' | 'error'`
  - `interface GeoState { status: GeoStatus; position: LatLng | null; request: () => void }`
  - `useGeolocation(): GeoState`
    - On mount: `status` is `'unsupported'` if `navigator.geolocation` is absent, else `'idle'`. **No location request fires on mount.**
    - `request()`: no-op when unsupported; otherwise sets `'prompting'` and calls `getCurrentPosition` with `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }`. Success → `position` set + `'granted'`. Error code 1 (permission denied) → `'denied'`; any other error → `'error'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/geo/useGeolocation.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

afterEach(() => vi.unstubAllGlobals());

const stubGeo = (impl: Partial<Geolocation>) =>
  vi.stubGlobal('navigator', { geolocation: impl });

describe('useGeolocation', () => {
  it('reports unsupported when the API is absent', () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('unsupported');
  });

  it('does not request a position on mount', () => {
    const getCurrentPosition = vi.fn();
    stubGeo({ getCurrentPosition });
    renderHook(() => useGeolocation());
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('transitions to granted with a position on success', () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 46.9, longitude: 7.4 } } as GeolocationPosition),
    );
    stubGeo({ getCurrentPosition });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.status).toBe('granted');
    expect(result.current.position).toEqual({ lat: 46.9, lng: 7.4 });
  });

  it('transitions to denied on permission error (code 1)', () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, err?: PositionErrorCallback) =>
      err?.({ code: 1 } as GeolocationPositionError),
    );
    stubGeo({ getCurrentPosition });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.status).toBe('denied');
  });

  it('transitions to error on non-permission failure', () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, err?: PositionErrorCallback) =>
      err?.({ code: 3 } as GeolocationPositionError),
    );
    stubGeo({ getCurrentPosition });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.status).toBe('error');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/geo/useGeolocation.test.ts`
Expected: FAIL — cannot resolve `./useGeolocation`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/geo/useGeolocation.ts
import { useCallback, useState } from 'react';
import type { LatLng } from '../venues/distance';

export type GeoStatus = 'unsupported' | 'idle' | 'prompting' | 'granted' | 'denied' | 'error';

export interface GeoState {
  status: GeoStatus;
  position: LatLng | null;
  request: () => void;
}

const supported = (): boolean =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator && !!navigator.geolocation;

export const useGeolocation = (): GeoState => {
  const [status, setStatus] = useState<GeoStatus>(() => (supported() ? 'idle' : 'unsupported'));
  const [position, setPosition] = useState<LatLng | null>(null);

  const request = useCallback(() => {
    if (!supported()) {
      setStatus('unsupported');
      return;
    }
    setStatus('prompting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('granted');
      },
      (err) => setStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  return { status, position, request };
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/geo/useGeolocation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/geo/useGeolocation.ts src/features/geo/useGeolocation.test.ts
git commit -m "feat: add shared one-shot useGeolocation hook"
```

---

### Task 4: "You are here" marker HTML

**Files:**
- Modify: `src/features/map/markers.tsx`
- Test: `src/features/map/markers.test.ts`

**Interfaces:**
- Produces: `userPinHtml(): string` — a self-contained HTML string for a Leaflet `divIcon`, visually distinct from the accent-red venue pins.

- [ ] **Step 1: Write the failing test** (append to `markers.test.ts`)

```ts
import { pinHtml, popupHtml, userPinHtml } from './markers';

describe('userPinHtml', () => {
  it('is a blue location dot, visually distinct from venue pins', () => {
    const html = userPinHtml();
    expect(html).toContain('#1a73e8');
    expect(html).not.toBe(pinHtml(false));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/map/markers.test.ts`
Expected: FAIL — `userPinHtml` is not exported.

- [ ] **Step 3: Write the implementation** (append to `markers.tsx`)

```tsx
// A distinct blue "you are here" dot. Deliberately NOT theme.color.accent — it must never be
// mistaken for a red venue pin or cluster. Blue is the conventional device-location color.
export const userPinHtml = (): string =>
  '<div style="position:relative;width:22px;height:22px;">'
  + '<div style="position:absolute;inset:0;border-radius:50%;background:#1a73e8;border:3px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';"></div>'
  + '</div>';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/map/markers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/markers.tsx src/features/map/markers.test.ts
git commit -m "feat: add you-are-here map marker html"
```

---

### Task 5: i18n keys for sort + location

**Files:**
- Modify: `src/i18n/translations.ts`
- Test: `src/i18n/translations.test.ts` (existing parity test guards this — no new test needed)

**Interfaces:**
- Produces new keys on `STR.de` / `STR.fr` / `STR.it`: `sortBy`, `sortCanton`, `sortName`, `sortDistance`, `useMyLocation`, `locationDenied`, `locationError`, `youAreHere`.

**Note:** The spec listed `locationUnsupported`, but when geolocation is unsupported the controls are hidden (no surface to show it), so that key is intentionally omitted to avoid a dead string.

- [ ] **Step 1: Add the keys to `STR.de`** (insert before the closing `},` of the `de` block, after `cantonEmpty`)

```ts
    sortBy: 'Sortieren',
    sortCanton: 'Kanton',
    sortName: 'Name',
    sortDistance: 'Distanz',
    useMyLocation: 'Meinen Standort verwenden',
    locationDenied: 'Standortzugriff verweigert.',
    locationError: 'Standort konnte nicht ermittelt werden.',
    youAreHere: 'Ihr Standort',
```

- [ ] **Step 2: Add the keys to `STR.fr`**

```ts
    sortBy: 'Trier',
    sortCanton: 'Canton',
    sortName: 'Nom',
    sortDistance: 'Distance',
    useMyLocation: 'Utiliser ma position',
    locationDenied: 'Accès à la position refusé.',
    locationError: 'Impossible de déterminer la position.',
    youAreHere: 'Votre position',
```

- [ ] **Step 3: Add the keys to `STR.it`**

```ts
    sortBy: 'Ordina',
    sortCanton: 'Cantone',
    sortName: 'Nome',
    sortDistance: 'Distanza',
    useMyLocation: 'Usa la mia posizione',
    locationDenied: 'Accesso alla posizione negato.',
    locationError: 'Impossibile determinare la posizione.',
    youAreHere: 'La tua posizione',
```

- [ ] **Step 4: Run the parity test to verify all three match**

Run: `npm run test -- src/i18n/translations.test.ts`
Expected: PASS ("all languages share the same keys").

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add i18n keys for sort control and geolocation"
```

---

### Task 6: Sidebar sort control + flat list + distance badges

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx`
- Test: `src/features/sidebar/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `SortMode`, `flatSorted` from `../venues/grouping`; `haversineKm`, `formatDistance`, `LatLng` from `../venues/distance`; `GeoStatus` from `../geo/useGeolocation`; `wappenUrl` from `../../data/cantons` (already imported).
- Produces (new `SidebarProps` fields):
  - `sortMode: SortMode`
  - `onSortMode: (m: SortMode) => void`
  - `userPosition: LatLng | null`
  - `geoStatus: GeoStatus`
  - `onRequestLocation: () => void`

**Behavior:**
- A segmented control (three buttons: `t.sortCanton`, `t.sortName`, `t.sortDistance`) renders just above the existing "Nach Kanton" header row, as a `role="radiogroup"`.
- The Distance button is **hidden** when `geoStatus === 'unsupported'`. Otherwise it is always clickable: clicking it calls `onSortMode('distance')`, and if there is no `userPosition` yet, also calls `onRequestLocation()`.
- When `sortMode === 'canton'`: render today's grouped markup (unchanged).
- When `sortMode === 'name'` or `'distance'`: render a **flat list** of rows via `flatSorted(list, sortMode, userPosition)`; each row shows a 16px canton Wappen, the venue name, its town, and — only in `'distance'` mode with a `userPosition` — a right-aligned distance badge `formatDistance(haversineKm(userPosition, v), lang)`.
- Search still runs first (`filterVenues`) in every mode.

- [ ] **Step 1: Write the failing tests** (append to `Sidebar.test.tsx`; also extend the `Harness` — see Step 3)

```tsx
// Distances: venue '1' Emmental in BE, '2'/'3' in LU. Give them coords so distance is meaningful.
// Update the shared `venues` fixture to include coords:
//   v({ id: '1', name: 'Emmental', canton: 'BE', lat: 46.9, lng: 7.6 }),
//   v({ id: '2', name: 'Willisau', canton: 'LU', lat: 47.1, lng: 8.0 }),
//   v({ id: '3', name: 'Allmend', canton: 'LU', lat: 47.05, lng: 8.3 }),

it('renders the sort control', async () => {
  renderSidebar();
  await waitFor(() => expect(screen.getByText(STR.de.sortName)).toBeInTheDocument());
  expect(screen.getByText(STR.de.sortDistance)).toBeInTheDocument();
});

it('flattens the list when sorting by name (no canton expand needed)', async () => {
  const user = userEvent.setup();
  renderSidebar();
  await waitFor(() => expect(screen.getByText(STR.de.sortName)).toBeInTheDocument());
  await user.click(screen.getByText(STR.de.sortName));
  // All venue names visible without expanding any canton group:
  expect(screen.getByText('Allmend')).toBeInTheDocument();
  expect(screen.getByText('Emmental')).toBeInTheDocument();
  expect(screen.getByText('Willisau')).toBeInTheDocument();
});

it('requests location when Distance is picked without a position', async () => {
  const onRequestLocation = vi.fn();
  const user = userEvent.setup();
  renderSidebar({ onRequestLocation });
  await waitFor(() => expect(screen.getByText(STR.de.sortDistance)).toBeInTheDocument());
  await user.click(screen.getByText(STR.de.sortDistance));
  expect(onRequestLocation).toHaveBeenCalledTimes(1);
});

it('shows distance badges only when sorting by distance with a position', async () => {
  const user = userEvent.setup();
  renderSidebar({ userPosition: { lat: 46.95, lng: 7.45 } });
  await waitFor(() => expect(screen.getByText(STR.de.sortDistance)).toBeInTheDocument());
  // No badges in canton mode:
  expect(screen.queryByText(/km$/)).not.toBeInTheDocument();
  await user.click(screen.getByText(STR.de.sortDistance));
  // Nearest (Emmental, closest to origin) appears with a km badge:
  await waitFor(() => expect(screen.getAllByText(/km$/).length).toBeGreaterThan(0));
});

it('hides the Distance option when geolocation is unsupported', async () => {
  renderSidebar({ geoStatus: 'unsupported' });
  await waitFor(() => expect(screen.getByText(STR.de.sortName)).toBeInTheDocument());
  expect(screen.queryByText(STR.de.sortDistance)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx`
Expected: FAIL — new props not accepted / control not rendered.

- [ ] **Step 3: Extend the test `Harness`** so it supplies the new props

Add to `HarnessProps`:

```tsx
  sortMode?: SortMode;
  userPosition?: LatLng | null;
  geoStatus?: GeoStatus;
  onRequestLocation?: () => void;
```

In `Harness`, default them and thread a local `sortMode` state:

```tsx
  sortModeInit = 'canton',
  userPosition = null,
  geoStatus = 'idle',
  onRequestLocation = () => {},
// ...
  const [sortMode, setSortMode] = useState<SortMode>(sortModeInit);
// ...pass to <Sidebar>:
      sortMode={sortMode}
      onSortMode={setSortMode}
      userPosition={userPosition}
      geoStatus={geoStatus}
      onRequestLocation={onRequestLocation}
```

Add imports at the top of the test file:

```tsx
import type { SortMode } from '../venues/grouping';
import type { LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';
```

- [ ] **Step 4: Implement the Sidebar changes**

4a. Update imports at the top of `Sidebar.tsx`:

```tsx
import { filterVenues, groupByCanton, flatSorted, type SortMode } from '../venues/grouping';
import { haversineKm, formatDistance, type LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';
import { MapPin } from 'lucide-react';
```
(Keep the existing `Search, X, ChevronRight, ...` import; add `MapPin` to it instead of a second line if preferred.)

4b. Extend `SidebarProps` with the five new fields listed under **Interfaces** above, and pull them into the destructured `Sidebar(...)` params.

4c. Add a badge style constant near `rowStyle`:

```tsx
const distanceBadgeStyle: CSSProperties = {
  flex: 'none',
  fontSize: '11px',
  fontWeight: 700,
  color: theme.color.accentInk,
  background: theme.color.ink,
  padding: '2px 9px',
  borderRadius: theme.radius.pill,
  whiteSpace: 'nowrap',
};
```

4d. Get the active language for formatting — the component already calls `useTranslation()`; change it to also read `lang`:

```tsx
const { t, lang } = useTranslation();
```
(`useTranslation` returns `{ lang, t, setLang }` — see `I18nContext`.)

4e. Compute the flat list next to the existing `list`/`groups` computation:

```tsx
const flat = sortMode !== 'canton';
const flatList = flat ? flatSorted(list, sortMode, userPosition) : [];
```

4f. Insert the sort control just before the "Nach Kanton" header `<div>` (the block containing `{t.byCanton}`). Render it as a radiogroup:

```tsx
<div style={{ padding: '0 15px 10px', flex: 'none' }} role="radiogroup" aria-label={t.sortBy}>
  <div style={{ display: 'flex', gap: '2px', background: theme.color.paper, padding: '4px', borderRadius: theme.radius.pill }}>
    {([['canton', t.sortCanton], ['name', t.sortName], ['distance', t.sortDistance]] as const)
      .filter(([mode]) => !(mode === 'distance' && geoStatus === 'unsupported'))
      .map(([mode, label]) => {
        const active = sortMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={mode === 'distance' ? t.useMyLocation : undefined}
            onClick={() => {
              onSortMode(mode);
              if (mode === 'distance' && !userPosition) onRequestLocation();
            }}
            style={{
              flex: 1, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              lineHeight: '1', padding: '7px 8px', borderRadius: theme.radius.pill,
              background: active ? theme.color.accent : 'transparent',
              color: active ? theme.color.accentInk : theme.color.muted,
            }}
          >
            {label}
          </button>
        );
      })}
  </div>
</div>
```

4g. In the scrollable list container, branch on `flat`. Wrap the existing `{groups.map(...)}` block so it only renders when `!flat`, and add the flat branch. The flat branch:

```tsx
{flat &&
  flatList.map((v) => {
    const sel = v.id === selectedId;
    return (
      <div key={v.id} onClick={() => onSelect(v.id)} style={rowStyle(sel)}>
        <img
          src={wappenUrl(v.canton)}
          alt=""
          style={{ width: '16px', height: '20px', objectFit: 'contain', flex: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.25))' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: theme.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v.name}
          </div>
          <div style={{ fontSize: '12px', color: theme.color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {townOf(v.address)}
          </div>
        </div>
        {sortMode === 'distance' && userPosition && (
          <span style={distanceBadgeStyle}>{formatDistance(haversineKm(userPosition, v), lang)}</span>
        )}
      </div>
    );
  })}
```

Keep the existing `{noResults && (...)}` block as-is (it applies in every mode).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/sidebar/Sidebar.test.tsx`
Expected: PASS (existing tests + 5 new).

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/features/sidebar/Sidebar.test.tsx
git commit -m "feat: add sort control and flat name/distance list to sidebar"
```

---

### Task 7: Wire geolocation + sort into App; add map locate button & marker

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/map/MapView.tsx`

**Interfaces:**
- `App` consumes `useGeolocation` (Task 3), `SortMode` (Task 2); produces `sortMode` state + geo props passed to both `Sidebar` (Task 6 props) and `MapView` (new props below).
- `MapView` new props:
  - `userPosition: LatLng | null`
  - `geoStatus: GeoStatus`
  - `onRequestLocation: () => void`

**Verification:** MapView has no unit-test harness in this codebase (see the testing note above). This task is verified manually via `npm run dev` — the checklist is in Step 6.

- [ ] **Step 1: Add state + hook in `App.tsx`**

Add imports:

```tsx
import { useGeolocation } from './features/geo/useGeolocation';
import type { SortMode } from './features/venues/grouping';
```

Inside `AppShell`, near the other `useState` calls:

```tsx
const [sortMode, setSortMode] = useState<SortMode>('canton');
const geo = useGeolocation();
```

- [ ] **Step 2: Pass the new props to `<Sidebar>`** (add to the existing element)

```tsx
          sortMode={sortMode}
          onSortMode={setSortMode}
          userPosition={geo.position}
          geoStatus={geo.status}
          onRequestLocation={geo.request}
```

- [ ] **Step 3: Pass the new props to `<MapView>`** (add to the existing element)

```tsx
            userPosition={geo.position}
            geoStatus={geo.status}
            onRequestLocation={geo.request}
```

- [ ] **Step 4: Surface a geolocation error toast** — after the `geo` declaration in `AppShell`, add:

```tsx
useEffect(() => {
  if (geo.status === 'denied') showFlash('err', t.locationDenied);
  else if (geo.status === 'error') showFlash('err', t.locationError);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [geo.status]);
```

- [ ] **Step 5: Implement the MapView locate button + marker**

5a. Update imports in `MapView.tsx`:

```tsx
import { Maximize, LocateFixed } from 'lucide-react';
import { pinHtml, popupHtml, clusterIcon, userPinHtml } from './markers';
import type { LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';
```

5b. Extend `MapViewProps` with `userPosition`, `geoStatus`, `onRequestLocation` (types above) and add them to the destructured params.

5c. Add a marker ref near the other refs:

```tsx
const userMarkerRef = useRef<L.Marker | null>(null);
```

5d. Add an effect that syncs the "you are here" marker (place it after the "Apply the initial canton-focus bounds" effect):

```tsx
// User position → drop / move the "you are here" marker and gently center on it.
useEffect(() => {
  const map = mapRef.current;
  if (!map) return;
  if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
  const pos = userPosition;
  if (!pos) return;
  const icon = L.divIcon({ className: '', html: userPinHtml(), iconSize: [22, 22], iconAnchor: [11, 11] });
  userMarkerRef.current = L.marker([pos.lat, pos.lng], { icon, interactive: false, keyboard: false }).addTo(map);
  map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
}, [userPosition]);
```

5e. Render the locate button below the fit-all control (inside the returned JSX, after the `fitAllWrapStyle` block). It's hidden when geolocation is unsupported:

```tsx
{geoStatus !== 'unsupported' && (
  <div style={{ ...nativeCtrlStyle, position: 'absolute', left: '10px', top: `${fitAllTop + fitAllSize + 10}px`, width: `${fitAllSize}px`, height: `${fitAllSize}px`, border: fitAllBorder, backgroundClip: fitAllBgClip, zIndex: 1000 }}>
    <button
      className="sk-native-ctrl-btn"
      onClick={onRequestLocation}
      title={t.useMyLocation}
      aria-label={t.useMyLocation}
      style={{ ...fitAllBtnStyle, color: geoStatus === 'denied' || geoStatus === 'error' ? theme.color.muted : theme.color.ink }}
    >
      <LocateFixed size={18} />
    </button>
  </div>
)}
```

- [ ] **Step 6: Manual verification** (`npm run dev`)

- Load the app: no location prompt appears automatically. ✔
- Click the map locate button → browser prompts once; on allow, a blue dot appears at your location and the map centers on it. ✔
- Open the sidebar, click **Distanz** → the list flattens and orders nearest-first with km/m badges; no second permission prompt. ✔
- Click **Name** → flat A→Z list, mini Wappen per row, no badges. ✔
- Click **Kanton** → the original grouped view returns. ✔
- Deny permission (or use a browser with it blocked) → an error toast shows; the Distance option still appears but yields the name-ordered fallback; the map button dims. ✔

- [ ] **Step 7: Full test + lint gate**

Run: `npm run test`
Expected: all suites PASS.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/features/map/MapView.tsx
git commit -m "feat: wire geolocation sort and map locate button (#11, #18)"
```

---

## Self-Review

**Spec coverage:**
- "Use my location" opt-in control → Task 6 (sidebar Distance button) + Task 7 (map locate button). ✔
- Haversine distance per venue → Task 1. ✔
- Distance badge per row → Task 6 (distance mode only). ✔
- Sort control (name/distance) → Task 6; Canton default → Task 6/7. ✔
- Distance sort flattens with per-row Wappen (Model C) → Tasks 2 + 6. ✔
- Single shared geolocation source → Task 3, consumed in Task 7 by both consumers. ✔
- Graceful degradation (unsupported hides, denied/error toast + fallback) → Tasks 6 + 7. ✔
- `?ctn=` unchanged → no task touches permalink logic (grouped mode is still the default landing). ✔
- i18n DE/FR/IT parity → Task 5. ✔
- No new dependencies → confirmed (browser API + Leaflet + Intl only). ✔

**Type consistency:** `LatLng` defined in Task 1 and imported everywhere; `SortMode` defined in Task 2 and used in Tasks 6/7; `GeoStatus`/`GeoState` defined in Task 3 and used in Tasks 6/7. `flatSorted`, `haversineKm`, `formatDistance`, `sortByDistance`, `userPinHtml`, `useGeolocation` names are consistent across their definition and call sites.

**Placeholder scan:** No TBD/TODO; every code step shows complete code.

**Deviations from spec (intentional, noted inline):** `locationUnsupported` i18n key omitted (unsupported state hides its own UI). MapView is manually verified rather than unit-tested, matching the codebase's existing convention (no `MapView.test.tsx`; map logic tested via pure `markers.ts`).
