# Schwingkeller Schweiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `Schwingkeller Schweiz` prototype into a deployable Vite + React + TypeScript SPA backed by Supabase, with Docker local dev, CI to Codecov, error tracking via Sentry, and Netlify deploys — zero credentials in the repo.

**Architecture:** A static React SPA reads/writes a Supabase `venues` table (Postgres) protected by RLS (public read, authenticated write). Venue photos live in a Supabase Storage bucket. Pure logic (canton lookup, PLZ→canton, CSV/JSON, geocoding mapping, i18n) is decoupled from React for easy unit testing. Data fetching uses TanStack Query over a thin Supabase API module.

**Tech Stack:** Vite, React 18, TypeScript, Leaflet + react-leaflet + leaflet.markercluster, @supabase/supabase-js, @tanstack/react-query, @sentry/react, Vitest + React Testing Library, ESLint, Prettier. Infra: Supabase CLI (Docker), Docker Compose, Netlify, GitHub Actions, Codecov.

**Source of truth for UI markup/styles:** the prototype at `.tmp/schwingkeller-design/Schwingkeller Schweiz.dc.html` (component logic lines ~317–666) and `.tmp/schwingkeller-design/support.js`. Tasks reference exact line ranges to port verbatim styling/JSX from. `cantons.geojson` is copied from the prototype.

---

## Execution Progress (updated 2026-06-18)

**Completed:** Tasks 1–9, on branch `feat/schwingkeller-app`.

| Task | Commit(s) | Notes |
|---|---|---|
| 1 Scaffold | `311875e` | — |
| 2 Tooling | `cad2b70` | — |
| 3 Cantons | `21da71d` | — |
| 4 PLZ→canton | `a6ddb90` | — |
| 5 Types | `3998b91` | — |
| 6 Grouping | `ed4b212` | — |
| 7 Import/export | `9b4babc`, `0a31732`, `7b96b00` | type-fix + BOM round-trip fix (see below) |
| 8 Geocoding | `9bf1124` | — |
| 9 i18n | `f07f143` | de/fr/it copied verbatim from prototype; key-parity test passes |

Gate after Task 9: **27 tests pass**, `npm run lint` and `npm run typecheck` clean.

### Amendments discovered during execution (apply to remaining tasks)

1. **Toolchain versions differ from the plan's assumptions.** The Vite scaffold installed **React 19, Vite 8, TypeScript 6, ESLint 10** (current as of 2026-06). React 19 is API-compatible with the plan's `createRoot`/`StrictMode` usage. No action needed beyond the ESLint note below.
2. **ESLint 10 uses flat config only.** The scaffold ships `eslint.config.js` (flat) wiring `typescript-eslint` + react-hooks. ESLint 10 has **removed** the legacy `.eslintrc` format. Therefore **Task 2 was implemented WITHOUT creating `.eslintrc.cjs`** and WITHOUT the separate `@typescript-eslint/*` install — those steps in the original Task 2 text are obsolete (see corrected Task 2 below). The lint script is `eslint .` (the `--ext` flag errors under flat config).
3. **Task 7 fixes applied:** `normalizeVenue`'s `id` uses a type-safe expression (still falls back to `import_${i}`); `parseCSV` now strips a leading `U+FEFF` BOM so a CSV `export → re-import` round-trip preserves the first column/ids (regression test added).
4. **For Task 16:** `leaflet.markercluster` ships no types — install `@types/leaflet.markercluster` as a dev dependency when building the map.

### Known limitations — intentionally carried over from the prototype (do NOT "fix" during the 1:1 port)

These were flagged in review but are faithful to the prototype/spec. Leave them as-is for v1; they are documented here so reviewers don't re-flag them. Revisit only as post-v1 enhancements:

- **No Glarus (GL) PLZ range.** Postcodes 8750–8775 fall under `[8600,8799,'ZH']`, so a GL venue geocoded *without* an ISO-3166-2 code is assigned to ZH. In practice Nominatim returns `ISO3166-2-lvl4` (`CH-GL`), which takes precedence, so this only bites postcode-only fallbacks.
- **PLZ range ordering matters.** A few ranges overlap (e.g. `6390 OW` vs `6350–6399 NW`); correctness depends on array order. Keep the order from the prototype; do not sort the table.
- **`groupByCanton` drops venues with unknown canton codes** from the grouped sidebar view (they still appear in search). Acceptable since the edit form constrains canton to a valid `<select>`.
- **Falsy-zero coords:** `parseFloat(...) || 46.8/8.2` treats lat/lng of exactly `0` as missing. Swiss venues are ~46–48°N / 6–10°E, so `0` never occurs in real data.

---

## File Structure

```
.
├─ index.html
├─ package.json
├─ tsconfig.json  tsconfig.node.json
├─ vite.config.ts
├─ vitest.setup.ts
├─ .eslintrc.cjs  .prettierrc
├─ .env.example                      # placeholders only — committed
├─ .gitignore                        # ignores .env*, dist, node_modules, .tmp
├─ Dockerfile                        # node dev server
├─ docker-compose.yml
├─ netlify.toml
├─ README.md
├─ CONTRIBUTING.md
├─ .github/workflows/ci.yml
├─ codecov.yml
├─ public/
│  └─ cantons.geojson                # copied from prototype
├─ supabase/
│  ├─ config.toml                    # from `supabase init`
│  ├─ migrations/0001_init.sql       # venues table, trigger, RLS, storage bucket+policies
│  └─ seed.sql                       # 8 prototype venues (dev/CI only)
└─ src/
   ├─ main.tsx                       # bootstraps React, QueryClient, Sentry, AuthProvider
   ├─ App.tsx                        # layout + composition + responsive logic
   ├─ index.css                      # global styles ported from prototype <style>
   ├─ lib/
   │  ├─ supabase.ts                 # createClient from env
   │  └─ sentry.ts                   # initSentry()
   ├─ data/
   │  ├─ cantons.ts                  # CANTONS array + wappenUrl + cantonByCode
   │  └─ plzRanges.ts                # PLZ ranges + plzToCanton + cantonFromGeo
   ├─ i18n/
   │  ├─ translations.ts             # de/fr/it dictionaries + Lang type + TKey
   │  └─ useTranslation.ts           # context + hook + persistence
   ├─ features/
   │  ├─ auth/
   │  │  ├─ AuthProvider.tsx         # session state from supabase.auth
   │  │  ├─ useAuth.ts
   │  │  └─ LoginModal.tsx
   │  ├─ venues/
   │  │  ├─ types.ts                 # Venue, VenueInput
   │  │  ├─ api.ts                   # list/create/update/remove/uploadPhoto
   │  │  ├─ useVenues.ts             # TanStack Query hooks
   │  │  ├─ geocoding.ts             # forward/reverse Nominatim + mapping
   │  │  ├─ importExport.ts          # parseCSV, toCSV, toJSON, normalizeVenue
   │  │  └─ grouping.ts              # filterVenues, groupByCanton
   │  ├─ map/
   │  │  ├─ MapView.tsx              # Leaflet map, layers, mask, clustering
   │  │  ├─ markers.ts               # pinHtml, popupHtml, clusterIcon
   │  │  └─ useMapLayers.ts          # map/sat tile config
   │  ├─ sidebar/
   │  │  └─ Sidebar.tsx              # search + canton groups + admin tools
   │  ├─ venue-detail/
   │  │  └─ DetailModal.tsx
   │  └─ venue-edit/
   │     └─ EditForm.tsx             # add/edit, pick-on-map, photo upload
   └─ components/
      ├─ Topbar.tsx                  # logo, language switch, login/logout
      └─ Modal.tsx                   # shared overlay primitive
```

---

## Phase 1 — Project scaffolding

### Task 1: Initialize Vite + React + TS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1: Scaffold with Vite**

Run:
```bash
npm create vite@latest . -- --template react-ts
```
(If the directory is non-empty, choose "Ignore files and continue".)

- [ ] **Step 2: Replace `.gitignore`**

Write `.gitignore`:
```
node_modules
dist
dist-ssr
*.local
.env
.env.*
!.env.example
.tmp
coverage
.DS_Store
supabase/.branches
supabase/.temp
```

- [ ] **Step 3: Install runtime + dev dependencies**

Run:
```bash
npm install @supabase/supabase-js @tanstack/react-query @sentry/react leaflet react-leaflet leaflet.markercluster
npm install -D typescript @types/leaflet vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint prettier
```

- [ ] **Step 4: Add scripts to `package.json`**

Set the `scripts` block:
```json
{
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 5: Verify dev server boots**

Run: `npm run dev`
Expected: Vite prints a local URL and serves the default page. Stop the server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS project"
```

### Task 2: Configure Vitest, ESLint, Prettier

**Files:**
- Create: `vitest.setup.ts`, `.eslintrc.cjs`, `.prettierrc`
- Modify: `vite.config.ts`

- [ ] **Step 1: Configure Vitest in `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{ "singleQuote": true, "semi": true, "printWidth": 100 }
```

- [ ] **Step 4: ESLint — keep the scaffold's flat config (CORRECTED)**

> ⚠️ The original plan said to create `.eslintrc.cjs` and install `@typescript-eslint/*`. This is **obsolete**: the Vite scaffold installed ESLint 10, which only supports flat config and already ships `eslint.config.js` wiring `typescript-eslint` + react-hooks. As implemented:
> - Do **not** create `.eslintrc.cjs` and do **not** install `@typescript-eslint/*` separately.
> - Fix the lint script to drop the `--ext` flag (it errors under flat config): `"lint": "eslint ."`.
> - Verify `npm run lint` exits 0.

- [ ] **Step 5: Add a smoke test `src/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: configure vitest, eslint, prettier"
```

---

## Phase 2 — Pure logic (no React, fully unit-tested)

### Task 3: Cantons data module

**Files:**
- Create: `src/data/cantons.ts`, `src/data/cantons.test.ts`

- [ ] **Step 1: Write the failing test `src/data/cantons.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { CANTONS, cantonByCode, wappenUrl } from './cantons';

describe('cantons', () => {
  it('contains all 26 cantons', () => {
    expect(CANTONS).toHaveLength(26);
  });
  it('looks up a canton by code', () => {
    expect(cantonByCode('BE')?.name).toBe('Bern');
    expect(cantonByCode('XX')).toBeUndefined();
  });
  it('builds a wappen URL using the German Wikimedia name', () => {
    expect(wappenUrl('VD')).toContain('Wappen_Waadt_matt.svg');
    expect(wappenUrl('XX')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cantons`
Expected: FAIL (cannot find module './cantons').

- [ ] **Step 3: Implement `src/data/cantons.ts`**

Port the `CANTONS` array and `wappenUrl` from the prototype lines 318–329 and 364. Use:
```ts
export interface Canton { code: string; name: string; w: string }

const WBASE = 'https://commons.wikimedia.org/wiki/Special:FilePath/Wappen_';

export const CANTONS: Canton[] = [
  { code: 'ZH', name: 'Zürich', w: 'Zürich' }, { code: 'BE', name: 'Bern', w: 'Bern' },
  { code: 'LU', name: 'Luzern', w: 'Luzern' }, { code: 'UR', name: 'Uri', w: 'Uri' },
  { code: 'SZ', name: 'Schwyz', w: 'Schwyz' }, { code: 'OW', name: 'Obwalden', w: 'Obwalden' },
  { code: 'NW', name: 'Nidwalden', w: 'Nidwalden' }, { code: 'GL', name: 'Glarus', w: 'Glarus' },
  { code: 'ZG', name: 'Zug', w: 'Zug' }, { code: 'FR', name: 'Fribourg', w: 'Freiburg' },
  { code: 'SO', name: 'Solothurn', w: 'Solothurn' }, { code: 'BS', name: 'Basel-Stadt', w: 'Basel-Stadt' },
  { code: 'BL', name: 'Basel-Landschaft', w: 'Basel-Landschaft' }, { code: 'SH', name: 'Schaffhausen', w: 'Schaffhausen' },
  { code: 'AR', name: 'Appenzell Ausserrhoden', w: 'Appenzell_Ausserrhoden' },
  { code: 'AI', name: 'Appenzell Innerrhoden', w: 'Appenzell_Innerrhoden' },
  { code: 'SG', name: 'St. Gallen', w: 'St._Gallen' }, { code: 'GR', name: 'Graubünden', w: 'Graubünden' },
  { code: 'AG', name: 'Aargau', w: 'Aargau' }, { code: 'TG', name: 'Thurgau', w: 'Thurgau' },
  { code: 'TI', name: 'Ticino', w: 'Tessin' }, { code: 'VD', name: 'Vaud', w: 'Waadt' },
  { code: 'VS', name: 'Valais', w: 'Wallis' }, { code: 'NE', name: 'Neuchâtel', w: 'Neuenburg' },
  { code: 'GE', name: 'Genève', w: 'Genf' }, { code: 'JU', name: 'Jura', w: 'Jura' },
];

export const cantonByCode = (code: string): Canton | undefined =>
  CANTONS.find((c) => c.code === code);

export const wappenUrl = (code: string): string => {
  const c = cantonByCode(code);
  return c ? WBASE + encodeURIComponent(c.w) + '_matt.svg' : '';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cantons`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/cantons.ts src/data/cantons.test.ts
git commit -m "feat: add cantons data module"
```

### Task 4: PLZ → canton lookup

**Files:**
- Create: `src/data/plzRanges.ts`, `src/data/plzRanges.test.ts`

- [ ] **Step 1: Write the failing test `src/data/plzRanges.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { plzToCanton, cantonFromGeo } from './plzRanges';

describe('plzToCanton', () => {
  it('maps a Bern PLZ', () => { expect(plzToCanton('Schlossstrasse 3, 3550 Langnau')).toBe('BE'); });
  it('maps a Zürich PLZ', () => { expect(plzToCanton('8001 Zürich')).toBe('ZH'); });
  it('maps a Geneva PLZ', () => { expect(plzToCanton('1204 Genève')).toBe('GE'); });
  it('returns null when no 4-digit code present', () => { expect(plzToCanton('no postcode')).toBeNull(); });
});

describe('cantonFromGeo', () => {
  it('reads ISO3166-2 canton code', () => {
    expect(cantonFromGeo({ 'ISO3166-2-lvl4': 'CH-BE' })).toBe('BE');
  });
  it('falls back to postcode', () => {
    expect(cantonFromGeo({ postcode: '8001' })).toBe('ZH');
  });
  it('returns null for unknown input', () => { expect(cantonFromGeo({})).toBeNull(); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- plzRanges`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/data/plzRanges.ts`**

Port the range table and logic from prototype lines 437 and 565.
```ts
import { cantonByCode } from './cantons';

type Range = [number, number, string];

export const PLZ_RANGES: Range[] = [
  [1200, 1299, 'GE'], [1900, 1999, 'VS'], [3900, 3999, 'VS'], [6060, 6078, 'OW'],
  [6390, 6390, 'OW'], [6370, 6388, 'NW'], [9050, 9059, 'AI'], [9100, 9199, 'AR'],
  [1000, 1199, 'VD'], [1300, 1499, 'VD'], [1800, 1899, 'VD'], [1500, 1799, 'FR'],
  [2000, 2399, 'NE'], [2400, 2499, 'NE'], [2500, 2699, 'BE'], [2700, 2999, 'JU'],
  [3000, 3899, 'BE'], [4000, 4099, 'BS'], [4100, 4299, 'BL'], [4300, 4499, 'AG'],
  [4500, 4699, 'SO'], [4700, 4999, 'SO'], [5000, 5999, 'AG'], [6000, 6299, 'LU'],
  [6300, 6349, 'ZG'], [6350, 6399, 'NW'], [6400, 6459, 'SZ'], [6460, 6499, 'UR'],
  [6500, 6999, 'TI'], [7000, 7999, 'GR'], [8000, 8199, 'ZH'], [8200, 8299, 'SH'],
  [8300, 8499, 'ZH'], [8500, 8599, 'TG'], [8600, 8799, 'ZH'], [8800, 8899, 'SZ'],
  [8900, 8999, 'ZH'], [9000, 9099, 'SG'], [9200, 9499, 'SG'], [9500, 9599, 'TG'],
  [9600, 9999, 'SG'],
];

export const plzToCanton = (addr: string): string | null => {
  const m = String(addr ?? '').match(/\b(\d{4})\b/);
  if (!m) return null;
  const p = parseInt(m[1], 10);
  for (const [lo, hi, code] of PLZ_RANGES) if (p >= lo && p <= hi) return code;
  return null;
};

export interface GeoAddress { 'ISO3166-2-lvl4'?: string; postcode?: string }

export const cantonFromGeo = (a: GeoAddress | null | undefined): string | null => {
  if (!a) return null;
  const iso = a['ISO3166-2-lvl4'] ?? '';
  const m = iso.match(/^CH-([A-Z]{2})$/);
  if (m && cantonByCode(m[1])) return m[1];
  if (a.postcode) return plzToCanton(a.postcode);
  return null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- plzRanges`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/plzRanges.ts src/data/plzRanges.test.ts
git commit -m "feat: add PLZ-to-canton lookup"
```

### Task 5: Venue types

**Files:**
- Create: `src/features/venues/types.ts`

- [ ] **Step 1: Create `src/features/venues/types.ts`**

```ts
export interface Venue {
  id: string;
  name: string;
  canton: string;
  address: string;
  lat: number;
  lng: number;
  indoor: boolean;
  outdoor: boolean;
  person: string;
  phone: string;
  website: string;
  photo_url: string | null;
}

export type VenueInput = Omit<Venue, 'id'>;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/features/venues/types.ts
git commit -m "feat: add venue types"
```

### Task 6: Venue filtering + canton grouping

**Files:**
- Create: `src/features/venues/grouping.ts`, `src/features/venues/grouping.test.ts`

- [ ] **Step 1: Write the failing test `src/features/venues/grouping.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { filterVenues, groupByCanton } from './grouping';
import type { Venue } from './types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '3000 Bern', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null, ...over,
});

const venues = [
  v({ id: '1', name: 'Emmental', canton: 'BE' }),
  v({ id: '2', name: 'Willisau', canton: 'LU' }),
  v({ id: '3', name: 'Allmend', canton: 'LU' }),
];

describe('filterVenues', () => {
  it('returns all when query empty', () => { expect(filterVenues(venues, '')).toHaveLength(3); });
  it('matches name case-insensitively', () => {
    expect(filterVenues(venues, 'willi').map((x) => x.id)).toEqual(['2']);
  });
  it('matches canton name', () => {
    expect(filterVenues(venues, 'luzern').map((x) => x.id)).toEqual(['2', '3']);
  });
});

describe('groupByCanton', () => {
  it('groups in canton order with counts', () => {
    const g = groupByCanton(venues);
    expect(g.map((x) => x.code)).toEqual(['BE', 'LU']);
    expect(g[1].count).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- grouping`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/features/venues/grouping.ts`**

Port the `filtered()` and `groups()` logic from prototype lines 466–484 (decoupled from React state).
```ts
import { CANTONS, cantonByCode } from '../../data/cantons';
import type { Venue } from './types';

export const filterVenues = (venues: Venue[], search: string): Venue[] => {
  const q = search.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    return `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''}`.toLowerCase().includes(q);
  });
};

export interface CantonGroup { code: string; name: string; count: number; venues: Venue[] }

export const groupByCanton = (venues: Venue[]): CantonGroup[] => {
  const by: Record<string, Venue[]> = {};
  venues.forEach((v) => { (by[v.canton] = by[v.canton] ?? []).push(v); });
  return CANTONS.filter((c) => by[c.code]).map((c) => ({
    code: c.code, name: c.name, count: by[c.code].length, venues: by[c.code],
  }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- grouping`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/grouping.ts src/features/venues/grouping.test.ts
git commit -m "feat: add venue filtering and canton grouping"
```

### Task 7: Import/export (CSV + JSON)

**Files:**
- Create: `src/features/venues/importExport.ts`, `src/features/venues/importExport.test.ts`

- [ ] **Step 1: Write the failing test `src/features/venues/importExport.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV, normalizeVenue } from './importExport';

describe('parseCSV', () => {
  it('parses header + rows with quoted commas', () => {
    const rows = parseCSV('name,address\n"A, B",3000 Bern');
    expect(rows[0]).toEqual({ name: 'A, B', address: '3000 Bern' });
  });
});

describe('toCSV', () => {
  it('emits header and escapes special chars', () => {
    const csv = toCSV([normalizeVenue({ name: 'A,B', canton: 'be', lat: '1', lng: '2' }, 0)]);
    const [header, row] = csv.split('\n');
    expect(header).toContain('name');
    expect(row).toContain('"A,B"');
  });
});

describe('normalizeVenue', () => {
  it('coerces types and uppercases canton', () => {
    const n = normalizeVenue({ name: 'X', canton: 'be', lat: '46.9', lng: '7.8', indoor: 'ja' }, 0);
    expect(n.canton).toBe('BE');
    expect(n.lat).toBeCloseTo(46.9);
    expect(n.indoor).toBe(true);
  });
  it('defaults missing coords', () => {
    const n = normalizeVenue({ name: 'X' }, 1);
    expect(n.lat).toBe(46.8);
    expect(n.lng).toBe(8.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- importExport`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/features/venues/importExport.ts`**

Port `parseCSV`, `normVenue`, and CSV export logic from prototype lines 593–605 and 598. Note: prototype `id` field maps to `photo_url` mapping is handled at the API layer; `normalizeVenue` returns a `VenueInput`-shaped object plus `id` for imports.
```ts
import type { Venue } from './types';

const truthy = (v: unknown) =>
  v === true || /^(true|1|ja|yes|x)$/i.test(String(v ?? ''));

export const normalizeVenue = (v: Record<string, unknown>, i: number): Venue => ({
  id: (v.id && String(v.id)) || `import_${i}`,
  name: String(v.name ?? ''),
  canton: String(v.canton ?? 'BE').toUpperCase(),
  address: String(v.address ?? ''),
  lat: parseFloat(String(v.lat)) || 46.8,
  lng: parseFloat(String(v.lng)) || 8.2,
  indoor: truthy(v.indoor),
  outdoor: truthy(v.outdoor),
  person: String(v.person ?? ''),
  phone: String(v.phone ?? ''),
  website: String(v.website ?? ''),
  photo_url: (v.photo_url as string) || (v.photo as string) || null,
});

const CSV_COLS: (keyof Venue)[] = [
  'id', 'name', 'canton', 'address', 'lat', 'lng',
  'indoor', 'outdoor', 'person', 'phone', 'website',
];

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (venues: Venue[]): string => {
  const rows = [CSV_COLS.join(',')].concat(
    venues.map((v) => CSV_COLS.map((c) => esc(v[c])).join(',')),
  );
  return '﻿' + rows.join('\n');
};

export const toJSON = (venues: Venue[]): string => JSON.stringify(venues, null, 2);

const splitLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === ',') { out.push(cur); cur = ''; }
    else if (ch === '"') q = true;
    else cur += ch;
  }
  out.push(cur);
  return out;
};

export const parseCSV = (txt: string): Record<string, string>[] => {
  const lines = txt.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const head = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const o: Record<string, string> = {};
    head.forEach((h, i) => { o[h] = cells[i]; });
    return o;
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- importExport`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/importExport.ts src/features/venues/importExport.test.ts
git commit -m "feat: add CSV/JSON import-export logic"
```

### Task 8: Geocoding (Nominatim) mapping

**Files:**
- Create: `src/features/venues/geocoding.ts`, `src/features/venues/geocoding.test.ts`

- [ ] **Step 1: Write the failing test `src/features/venues/geocoding.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reverseGeocode, forwardGeocode } from './geocoding';

beforeEach(() => { vi.restoreAllMocks(); });

describe('reverseGeocode', () => {
  it('maps address + canton from a Nominatim reverse response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { road: 'Schlossstrasse', house_number: '3', postcode: '3550', town: 'Langnau', 'ISO3166-2-lvl4': 'CH-BE' } }),
    }));
    const r = await reverseGeocode(46.9, 7.7);
    expect(r?.address).toBe('Schlossstrasse 3, 3550 Langnau');
    expect(r?.canton).toBe('BE');
  });
  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await reverseGeocode(0, 0)).toBeNull();
  });
});

describe('forwardGeocode', () => {
  it('maps lat/lng + canton from a search response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ lat: '46.9389', lon: '7.7869', address: { postcode: '3550' } }]),
    }));
    const r = await forwardGeocode('Schlossstrasse 3, 3550 Langnau');
    expect(r?.lat).toBeCloseTo(46.9389);
    expect(r?.canton).toBe('BE');
  });
  it('returns null for short queries', async () => {
    expect(await forwardGeocode('abc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- geocoding`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/features/venues/geocoding.ts`**

Port `reverseGeocode`/`forwardGeocode` logic from prototype lines 438–463; return plain objects instead of mutating React state.
```ts
import { cantonFromGeo } from '../../data/plzRanges';

const HEADERS = { 'Accept-Language': 'de' };

export interface ReverseResult { address: string; canton: string | null }
export interface ForwardResult { lat: number; lng: number; canton: string | null }

export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseResult | null> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`,
      { headers: HEADERS },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const a = d?.address;
    if (!a) return null;
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const plz = a.postcode ?? '';
    const town = a.city || a.town || a.village || a.municipality || a.hamlet || '';
    const address = [street, [plz, town].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (!address) return null;
    return { address, canton: cantonFromGeo(a) };
  } catch { return null; }
};

export const forwardGeocode = async (query: string): Promise<ForwardResult | null> => {
  const q = String(query ?? '').trim();
  if (q.length < 6) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch&addressdetails=1&q=${encodeURIComponent(q)}`,
      { headers: HEADERS },
    );
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr.length) return null;
    const d = arr[0];
    const lat = +parseFloat(d.lat).toFixed(5);
    const lng = +parseFloat(d.lon).toFixed(5);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat, lng, canton: cantonFromGeo(d.address) };
  } catch { return null; }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- geocoding`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venues/geocoding.ts src/features/venues/geocoding.test.ts
git commit -m "feat: add Nominatim geocoding mapping"
```

### Task 9: i18n module

**Files:**
- Create: `src/i18n/translations.ts`, `src/i18n/translations.test.ts`

- [ ] **Step 1: Write the failing test `src/i18n/translations.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { STR, LANGS } from './translations';

describe('translations', () => {
  it('defines de, fr, it', () => { expect(LANGS).toEqual(['de', 'fr', 'it']); });
  it('all languages share the same keys', () => {
    const keys = Object.keys(STR.de).sort();
    expect(Object.keys(STR.fr).sort()).toEqual(keys);
    expect(Object.keys(STR.it).sort()).toEqual(keys);
  });
  it('resolves a known key', () => { expect(STR.de.search).toBe('Schwingkeller suchen …'); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- translations`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/i18n/translations.ts`**

Port the `STR` object verbatim from prototype lines 330–334. Wrap with types:
```ts
export const LANGS = ['de', 'fr', 'it'] as const;
export type Lang = (typeof LANGS)[number];

// Paste the de/fr/it objects exactly from prototype lines 331-333.
export const STR = {
  de: { /* ...prototype de object... */ },
  fr: { /* ...prototype fr object... */ },
  it: { /* ...prototype it object... */ },
} as const;

export type TKey = keyof typeof STR.de;
```
The three objects MUST be copied character-for-character from the prototype (including the umlauts and accented characters) so all keys match.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- translations`
Expected: PASS (3 tests). If "shared keys" fails, a key is missing in one language — fix to match.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts src/i18n/translations.test.ts
git commit -m "feat: add i18n translation dictionaries"
```

---

## Phase 3 — Supabase backend (migrations, RLS, storage)

### Task 10: Initialize Supabase + venues migration

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/0001_init.sql`, `supabase/seed.sql`

- [ ] **Step 1: Initialize Supabase locally**

Run:
```bash
supabase init
```
Expected: creates `supabase/config.toml`.

- [ ] **Step 2: Write `supabase/migrations/0001_init.sql`**

```sql
-- venues table
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canton text not null,
  address text default '',
  lat double precision,
  lng double precision,
  indoor boolean not null default false,
  outdoor boolean not null default false,
  person text default '',
  phone text default '',
  website text default '',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_venues_updated_at on public.venues;
create trigger trg_venues_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- Row Level Security: public read, authenticated write
alter table public.venues enable row level security;

create policy "venues_public_read" on public.venues
  for select using (true);

create policy "venues_auth_insert" on public.venues
  for insert to authenticated with check (true);

create policy "venues_auth_update" on public.venues
  for update to authenticated using (true) with check (true);

create policy "venues_auth_delete" on public.venues
  for delete to authenticated using (true);

-- Storage bucket for venue photos
insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true)
on conflict (id) do nothing;

create policy "venue_photos_public_read" on storage.objects
  for select using (bucket_id = 'venue-photos');

create policy "venue_photos_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'venue-photos');

create policy "venue_photos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'venue-photos');

create policy "venue_photos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'venue-photos');
```

- [ ] **Step 3: Write `supabase/seed.sql` (dev/CI only)**

Port the 8 venues from prototype lines 336–343:
```sql
insert into public.venues (name, canton, address, lat, lng, indoor, outdoor, person, phone, website) values
('Schwingkeller Emmental','BE','Schlossstrasse 3, 3550 Langnau i. E.',46.9389,7.7869,true,true,'Hans Wüthrich','+41 34 402 11 22','schwingen-emmental.ch'),
('Turnhalle Schlossmatt','BE','Schlossmattstrasse 12, 3400 Burgdorf',47.0590,7.6280,true,false,'Ueli Gerber','+41 34 422 33 44','schwingklub-burgdorf.ch'),
('Schwinghalle Boden','BE','Dorfstrasse 23, 3715 Adelboden',46.4926,7.5610,true,true,'Peter Tschanz','+41 33 673 80 80','adelboden-schwingen.ch'),
('Eidg. Schwingkeller Willisau','LU','Schlossfeldstrasse 8, 6130 Willisau',47.1213,7.9925,true,true,'Sepp Bucher','+41 41 970 12 34','schwingen-willisau.ch'),
('Schwingerkeller Allmend','LU','Horwerstrasse 87, 6005 Luzern',47.0356,8.3060,true,false,'Bruno Felder','+41 41 360 55 66','schwingen-luzern.ch'),
('Brünig Schwinget Arena','OW','Brünigstrasse 1, 6078 Lungern',46.7870,8.1580,false,true,'Res Imfeld','+41 41 678 90 12','bruenig-schwinget.ch'),
('Mythen Schwingkeller','SZ','Schmiedgasse 5, 6430 Schwyz',47.0207,8.6530,true,true,'Toni Reichmuth','+41 41 811 22 33','schwingen-schwyz.ch'),
('Säntis Schwingkeller','AI','Weissbadstrasse 14, 9050 Appenzell',47.3300,9.4100,true,false,'Jakob Fässler','+41 71 787 11 22','schwingen-appenzell.ch');
```

- [ ] **Step 4: Start Supabase and verify migration + seed apply**

Run:
```bash
supabase start
supabase db reset
```
Expected: `db reset` applies `0001_init.sql` then `seed.sql` without error; output reports success. Note the API URL and keys printed by `supabase start` for the next task.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/migrations supabase/seed.sql
git commit -m "feat: add Supabase schema, RLS, storage bucket, dev seed"
```

---

## Phase 4 — App integration layer

### Task 11: Env template + Supabase client + Sentry init

**Files:**
- Create: `.env.example`, `src/lib/supabase.ts`, `src/lib/sentry.ts`, `src/vite-env.d.ts` (extend)

- [ ] **Step 1: Create `.env.example` (placeholders only — committed)**

```
# Supabase — use the NEW publishable key (sb_publishable_...) in the cloud.
# For local dev, use the key printed by `supabase start`.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Sentry (browser-safe DSN)
VITE_SENTRY_DSN=
```

- [ ] **Step 2: Type the env in `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SENTRY_DSN?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

- [ ] **Step 3: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient(url, key);
```

- [ ] **Step 4: Create `src/lib/sentry.ts`**

```ts
import * as Sentry from '@sentry/react';

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
};
```

- [ ] **Step 5: Create local `.env.local` (gitignored) for development**

Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` with the values from `supabase start`. Leave `VITE_SENTRY_DSN` empty locally.

Verify it is ignored: `git status --porcelain .env.local` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib/supabase.ts src/lib/sentry.ts src/vite-env.d.ts
git commit -m "feat: add env template, supabase client, sentry init"
```

### Task 12: Venues API + TanStack Query hooks

**Files:**
- Create: `src/features/venues/api.ts`, `src/features/venues/api.test.ts`, `src/features/venues/useVenues.ts`

- [ ] **Step 1: Write the failing test `src/features/venues/api.test.ts`**

Mock the supabase client module.
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.fn();
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
vi.mock('../../lib/supabase', () => ({ supabase: { from } }));

import { listVenues } from './api';

beforeEach(() => { vi.clearAllMocks(); });

describe('listVenues', () => {
  it('selects venues ordered by name', async () => {
    order.mockResolvedValue({ data: [{ id: '1', name: 'A' }], error: null });
    const result = await listVenues();
    expect(from).toHaveBeenCalledWith('venues');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([{ id: '1', name: 'A' }]);
  });
  it('throws on error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(listVenues()).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- venues/api`
Expected: FAIL (cannot find module './api').

- [ ] **Step 3: Implement `src/features/venues/api.ts`**

```ts
import { supabase } from '../../lib/supabase';
import type { Venue, VenueInput } from './types';

export const listVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase.from('venues').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Venue[];
};

export const createVenue = async (input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as Venue;
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as Venue;
};

export const removeVenue = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const replaceAllVenues = async (venues: VenueInput[]): Promise<void> => {
  const del = await supabase.from('venues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (del.error) throw new Error(del.error.message);
  if (venues.length) {
    const ins = await supabase.from('venues').insert(venues);
    if (ins.error) throw new Error(ins.error.message);
  }
};

export const uploadPhoto = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- venues/api`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `src/features/venues/useVenues.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listVenues, createVenue, updateVenue, removeVenue, replaceAllVenues,
} from './api';
import type { VenueInput } from './types';

const KEY = ['venues'] as const;

export const useVenues = () =>
  useQuery({ queryKey: KEY, queryFn: listVenues });

export const useVenueMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({ mutationFn: (v: VenueInput) => createVenue(v), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Partial<VenueInput> }) => updateVenue(a.id, a.input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => removeVenue(id), onSuccess: invalidate }),
    replaceAll: useMutation({ mutationFn: (v: VenueInput[]) => replaceAllVenues(v), onSuccess: invalidate }),
  };
};
```

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.
```bash
git add src/features/venues/api.ts src/features/venues/api.test.ts src/features/venues/useVenues.ts
git commit -m "feat: add venues API and query hooks"
```

### Task 13: Auth provider + hook

**Files:**
- Create: `src/features/auth/AuthProvider.tsx`, `src/features/auth/useAuth.ts`, `src/features/auth/useAuth.test.tsx`

- [ ] **Step 1: Implement `src/features/auth/AuthProvider.tsx`**

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface AuthValue {
  session: Session | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, isAdmin: !!session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
```

- [ ] **Step 2: Implement `src/features/auth/useAuth.ts`**

```ts
import { useContext } from 'react';
import { AuthContext } from './AuthProvider';

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

- [ ] **Step 3: Write test `src/features/auth/useAuth.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const getSession = vi.fn().mockResolvedValue({ data: { session: null } });
const onAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));

import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

const Probe = () => {
  const { isAdmin } = useAuth();
  return <div>admin:{String(isAdmin)}</div>;
};

describe('AuthProvider', () => {
  it('defaults to not-admin when no session', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('admin:false')).toBeInTheDocument());
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm test -- useAuth`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth
git commit -m "feat: add auth provider and hook"
```

---

## Phase 5 — UI components (ported from prototype)

> For each component, port the JSX structure, inline styles, and SVG icons verbatim from the
> referenced prototype line ranges. Convert `onClick="{{ handler }}"` → `onClick={handler}`,
> `style="..."` strings → React `style={{ ... }}` objects (the prototype's `renderVals()` at
> lines 621–665 already expresses every style as a JS object — reuse those object literals),
> and `<sc-if>` / `<sc-for>` → conditional rendering / `.map()`.

### Task 14: i18n context + Topbar + Modal primitive

**Files:**
- Create: `src/i18n/useTranslation.ts`, `src/components/Modal.tsx`, `src/components/Topbar.tsx`

- [ ] **Step 1: Implement `src/i18n/useTranslation.ts`**

```ts
import { createContext, useContext } from 'react';
import { STR, type Lang } from './translations';

interface I18nValue { lang: Lang; t: typeof STR.de; setLang: (l: Lang) => void }
export const I18nContext = createContext<I18nValue | null>(null);

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nContext');
  return ctx;
};

export const loadLang = (): Lang => {
  try { return (localStorage.getItem('schwing_lang') as Lang) || 'de'; } catch { return 'de'; }
};
export const saveLang = (l: Lang) => { try { localStorage.setItem('schwing_lang', l); } catch { /* ignore */ } };
```

(The provider is created inline in `App.tsx`, Task 19, holding `lang` state and passing `t = STR[lang]`.)

- [ ] **Step 2: Implement `src/components/Modal.tsx`**

A shared overlay: fixed full-screen scrim, centered card, click-scrim-to-close, `stopPropagation` on the card. Port the overlay pattern from prototype lines 147–148.
```tsx
import type { ReactNode } from 'react';

interface ModalProps { onClose: () => void; width?: number; children: ReactNode; zIndex?: number }

export const Modal = ({ onClose, width = 440, children, zIndex = 1300 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(30,20,10,.52)', zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'fadeIn .2s ease',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="sk-scroll"
      style={{
        background: '#f6edd9', borderRadius: 16, width, maxWidth: '100%', maxHeight: '92vh',
        overflow: 'auto', boxShadow: '0 26px 64px rgba(30,20,10,.5)', animation: 'popIn .26s ease',
      }}
    >
      {children}
    </div>
  </div>
);
```

- [ ] **Step 3: Implement `src/components/Topbar.tsx`**

Port markup from prototype lines 41–62. Props: `{ onToggleSidebar, showHamburger, onOpenLogin }`. Uses `useAuth()` (`isAdmin`, `signOut`) and `useTranslation()` (`lang`, `t`, `setLang`). Renders logo, title + tagline, DE/FR/IT language buttons (active style from prototype `langStyle`, lines 619), and the Admin login/logout button (lines 56–61).

- [ ] **Step 4: Write a render test `src/components/Topbar.test.tsx`**

Wrap in `AuthProvider` + an `I18nContext.Provider` with `lang='de'`. Assert the title text `SCHWINGKELLER` and the login button label `STR.de.login` are present. (Mock `../../lib/supabase` auth as in Task 13.)

- [ ] **Step 5: Run test + commit**

Run: `npm test -- Topbar`
Expected: PASS.
```bash
git add src/i18n/useTranslation.ts src/components/Modal.tsx src/components/Topbar.tsx src/components/Topbar.test.tsx
git commit -m "feat: add i18n context, Modal, Topbar"
```

### Task 15: Sidebar

**Files:**
- Create: `src/features/sidebar/Sidebar.tsx`, `src/features/sidebar/Sidebar.test.tsx`

- [ ] **Step 1: Implement `src/features/sidebar/Sidebar.tsx`**

Port markup from prototype lines 68–125. Props:
```ts
interface SidebarProps {
  venues: Venue[];
  search: string; onSearch: (s: string) => void;
  expanded: Record<string, boolean>; onToggleCanton: (code: string) => void;
  selectedId: string | null; onSelect: (id: string) => void;
  isMobile: boolean; sidebarOpen: boolean; onToggleSidebar: () => void;
  // admin tools:
  onAdd: () => void; onExportJSON: () => void; onExportCSV: () => void;
  onImport: (file: File) => void;
}
```
- Uses `filterVenues` + `groupByCanton` (Task 6) to render canton groups; when `search` is non-empty, all groups render expanded (prototype line 479).
- Each canton row shows the Wappen `<img src={wappenUrl(code)}>`, name, count badge, chevron.
- Admin tools block (Add / Export JSON / Export CSV / Import file input) renders only when `useAuth().isAdmin`.
- Search clear button shown when `search` non-empty.
- "no results" message when filtered list is empty (`t.noResults`).

- [ ] **Step 2: Write test `src/features/sidebar/Sidebar.test.tsx`**

Render with the 3-venue fixture (reuse the shape from Task 6) inside `AuthProvider` (not admin) + `I18nContext`. Assert:
- Canton group names `Bern` and `Luzern` appear.
- Typing `willi` into the search input (via `onSearch` controlled by a wrapper) filters to one venue. (Use a small stateful wrapper component in the test.)
- The Add button (`t.add`) is NOT present when not admin.

- [ ] **Step 3: Run test + commit**

Run: `npm test -- Sidebar`
Expected: PASS.
```bash
git add src/features/sidebar
git commit -m "feat: add Sidebar with search and canton groups"
```

### Task 16: Map markers helpers + MapView

**Files:**
- Create: `src/features/map/markers.ts`, `src/features/map/markers.test.ts`, `src/features/map/MapView.tsx`

- [ ] **Step 1: Write the failing test `src/features/map/markers.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pinHtml, popupHtml } from './markers';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';

const venue: Venue = {
  id: '1', name: 'Emmental', canton: 'BE', address: '3550 Langnau', lat: 46.9, lng: 7.7,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null,
};

describe('markers html', () => {
  it('pinHtml differs for selected', () => {
    expect(pinHtml(true)).not.toBe(pinHtml(false));
  });
  it('popupHtml includes name and a data-detail hook', () => {
    const html = popupHtml(venue, STR.de);
    expect(html).toContain('Emmental');
    expect(html).toContain('data-detail="1"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- map/markers`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/features/map/markers.ts`**

Port `pinHtml` (lines 487–492), `popupHtml` (lines 493–504), and `clusterIcon` (line 367). `popupHtml(v, t)` takes the translation object; `clusterIcon` takes the Leaflet instance.
```ts
import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { cantonByCode, wappenUrl } from '../../data/cantons';

type T = typeof STR.de;

export const pinHtml = (sel: boolean): string => /* port lines 488-491 verbatim */ '';
export const popupHtml = (v: Venue, t: T): string => /* port lines 494-503 verbatim, using cantonByCode/wappenUrl */ '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => /* port line 367 verbatim */ L.divIcon({});
```
Replace the prototype's `this.wappenUrl`/`this.CANTONS.find` with the imported `wappenUrl`/`cantonByCode`. Replace `this.STR[this.state.lang]` with the `t` parameter. Keep the returned HTML strings byte-for-byte otherwise so styling matches.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- map/markers`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `src/features/map/MapView.tsx`**

A React component wrapping raw Leaflet (the prototype uses the imperative Leaflet API, not react-leaflet bindings, so keep that approach inside `useEffect` for a faithful port). Port from prototype `initMap` (369–390), `setTile`/`applyMaskTint` (393–414), `cantonStyle` (392), cluster handling (`onClusterClick` 422–434), marker refresh (`refreshMarkers` 505–516, `updatePins` 517–520, `focusVenue` 521–526), and map-click placing (`onMapClick` 435).

Props:
```ts
interface MapViewProps {
  venues: Venue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  baseKind: 'map' | 'sat';
  onChangeBase: (k: 'map' | 'sat') => void;
  placing: boolean;
  onPickLocation: (lat: number, lng: number) => void;
  registerFitAll?: (fn: () => void) => void;
}
```
Implementation notes:
- First install the missing types: `npm install -D @types/leaflet.markercluster` (the runtime pkg ships none).
- `import L from 'leaflet'; import 'leaflet/dist/leaflet.css'; import 'leaflet.markercluster'; import 'leaflet.markercluster/dist/MarkerCluster.css';`
- Create the map once in a `useEffect` keyed on mount; store `map`, `markerGroup`, layers in refs.
- Fetch `/cantons.geojson` (served from `public/`) for the mask + borders (lines 375–382).
- Re-run `refreshMarkers` when `venues`/`selectedId` change (mirror `componentDidUpdate` lines 528–535).
- Popup "Details" button: bind via `popupopen` handler reading `data-detail` (line 464) → call `onOpenDetail`.
- Render the map/satellite toggle + fit-all control overlay (lines 135–141); wire to `onChangeBase` and expose `flyToBounds` via `registerFitAll`.
- Map/sat button styles from `layerBtnStyle` (line 420).

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.
```bash
git add src/features/map
git commit -m "feat: add Leaflet map view and marker helpers"
```

### Task 17: Detail modal

**Files:**
- Create: `src/features/venue-detail/DetailModal.tsx`

- [ ] **Step 1: Implement `src/features/venue-detail/DetailModal.tsx`**

Port markup from prototype lines 146–195 using the `Modal` primitive. Props:
```ts
interface DetailModalProps {
  venue: Venue;
  onClose: () => void;
  onNavigate: () => void;     // window.open Google Maps dir (line 587)
  onEdit: () => void;
  onDelete: () => void;
}
```
- Show photo (`venue.photo_url`) or the diagonal-stripe placeholder (lines 151–155).
- Wappen badge (line 156–158), indoor/outdoor tags (165–171), contact rows (173–185).
- "Navigate" button (186) always; Edit/Delete buttons (187–192) only when `useAuth().isAdmin`.
- Derive `phoneUrl = 'tel:' + phone.replace(/\s/g,'')` and `websiteUrl = 'https://' + website.replace(/^https?:\/\//,'')` (line 638).

- [ ] **Step 2: Write test `src/features/venue-detail/DetailModal.test.tsx`**

Render with a venue + admin-not-logged-in. Assert name + address render and that the Edit button (`t.edit`) is absent. Then render inside an `AuthProvider` mocked to a logged-in session and assert Edit IS present.

- [ ] **Step 3: Run test + commit**

Run: `npm test -- DetailModal`
Expected: PASS.
```bash
git add src/features/venue-detail
git commit -m "feat: add venue detail modal"
```

### Task 18: Edit/Add form

**Files:**
- Create: `src/features/venue-edit/EditForm.tsx`

- [ ] **Step 1: Implement `src/features/venue-edit/EditForm.tsx`**

Port markup from prototype lines 199–264 using `Modal`. This is the most stateful component.
Props:
```ts
interface EditFormProps {
  initial: Venue | null;          // null => new venue
  onClose: () => void;
  onSaved: (v: Venue, andNew: boolean) => void;
  onStartPlacing: () => void;     // App switches map to placing mode + hides form
  pickedCoords: { lat: number; lng: number } | null; // delivered back from map click
}
```
Local state holds an editable draft (`Venue`-shaped, `photo_url` may be a blob preview). Behaviors to port:
- **Fields:** name, address, canton `<select>` (options from `CANTONS`), indoor/outdoor toggle buttons (styles `spOn`/`spOff`, lines 634–635), person/phone/website.
- **Photo upload:** on file select, call `uploadPhoto` (Task 12) → set `photo_url`. Show preview or upload placeholder (lines 209–217).
- **Address → geocode + canton:** on address change, debounce 900ms then call `forwardGeocode` (Task 8); also synchronously call `plzToCanton` to set canton + show "canton auto-detected" hint (lines 564, 231–233). Use a `cantonAuto` flag.
- **Pick on map:** "Pick on map" button calls `onStartPlacing`; when `pickedCoords` prop changes, update draft lat/lng and call `reverseGeocode` to backfill address/canton (line 435–447). Guard against the reverse→forward loop with a skip flag mirroring `_syncSkip` (lines 446, 452).
- **Coords display:** `lat.toFixed(4), lng.toFixed(4)` (line 660).
- **Save:** validate `name` non-empty (line 576). Map draft → `VenueInput` (drop transient `cantonAuto`). Call `create`/`update` mutation (Task 12). "Save & close" → `onSaved(v, false)`; "Save & new" → `onSaved(v, true)`.
- **blankVenue** default (line 574): canton `BE`, indoor true, centered coords.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/venue-edit
git commit -m "feat: add venue add/edit form"
```

---

## Phase 6 — App composition

### Task 19: App shell, layout, providers, wiring

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `public/cantons.geojson` (copy)

- [ ] **Step 1: Copy the geojson**

Run:
```bash
mkdir -p public
cp ".tmp/schwingkeller-design/cantons.geojson" public/cantons.geojson
```

- [ ] **Step 2: Port global styles into `src/index.css`**

Copy the `<style>` block from prototype lines 19–35 (Leaflet overrides, `.sk-scroll`, keyframes) and add the Google Fonts `@import` for `Bitter` and `Work Sans` (prototype line 17). Set `html,body,#root { height:100%; margin:0 }`.

- [ ] **Step 3: Wire providers in `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/AuthProvider';
import { initSentry } from './lib/sentry';
import App from './App';
import './index.css';

initSentry();
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 4: Implement `src/App.tsx`**

Compose the whole UI and own cross-cutting state. Port the responsive logic from prototype `renderVals` (621–665) and `mode()` (363).
- **i18n provider:** hold `lang` state (init `loadLang()`), provide `{ lang, t: STR[lang], setLang }`; `setLang` also `saveLang`.
- **Responsive:** track `window.innerWidth` via a resize listener; `mode = vw>=1024?'d':vw>=640?'t':'m'`; compute `sidebarStyle`, `mainStyle`, `mapWrapStyle` from lines 624–631.
- **State:** `search`, `expanded` (`{ BE: true }` default), `selectedId`, `detailId`, `editing` (Venue|null), `isNew`, `baseKind`, `placing`, `sidebarOpen`, `pickedCoords`, `showLogin`, `confirmId`.
- **Data:** `const { data: venues = [] } = useVenues();` and `useVenueMutations()`.
- **Layout:** `<Topbar/>` + main flex row of `<Sidebar/>` and `<MapView/>`; conditionally render `<DetailModal/>`, `<EditForm/>`, `<LoginModal/>`, delete-confirm (`Modal`, lines 301–312), and the placing banner (lines 267–272).
- **Import handler:** read file (FileReader), branch CSV vs JSON (lines 609–615), `parseCSV`/`JSON.parse` → `normalizeVenue[]` → strip `id` → `replaceAll` mutation; alert on empty/error.
- **Export handlers:** `toJSON`/`toCSV` (Task 7) → trigger download via a blob anchor (port `download`, line 590).
- **Navigate / delete / edit open** wiring per prototype handlers (lines 558–588).
- **Pick-on-map:** when `placing` and the map reports a click, set `pickedCoords` and clear `placing`, reopen the form.

- [ ] **Step 5: Create `src/features/auth/LoginModal.tsx`**

Port markup from prototype lines 275–298 using `Modal`. Email + password fields, error line, hint text. On submit call `useAuth().signIn`; on `{ error }` show it, else close. Update the hint text (`t.loginHint`) to reflect real auth (remove "demo — any email/password"); use a neutral "Sign in with your admin account" message — add a `loginHintReal` key to all three languages in `translations.ts` and use it here.

- [ ] **Step 6: Run app against local Supabase**

Ensure `supabase start` is running and `.env.local` is set. Run: `npm run dev`
Expected: map loads with the 8 seeded venues, canton groups populate, search works, language switch works. Sign in with an admin user created via `supabase` (see README) and verify add/edit/delete + photo upload write to the local DB.

- [ ] **Step 7: Typecheck, lint, test, commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.
```bash
git add -A
git commit -m "feat: compose app shell, layout, and wiring"
```

---

## Phase 7 — Infra, CI/CD, docs

### Task 20: Docker local dev

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
dist
coverage
.git
.tmp
.env
.env.*
!.env.example
```

- [ ] **Step 3: Create `docker-compose.yml`**

The Supabase stack is managed by the Supabase CLI (`supabase start`) on the host; this compose runs the app dev server and reaches the host's Supabase via `host.docker.internal`.
```yaml
services:
  web:
    build: .
    ports:
      - "5173:5173"
    volumes:
      - ./:/app
      - /app/node_modules
    env_file:
      - .env.local
    extra_hosts:
      - "host.docker.internal:host-gateway"
    command: npm run dev
```
Note in README: in `.env.local` used by Docker, set `VITE_SUPABASE_URL=http://host.docker.internal:54321`.

- [ ] **Step 4: Verify**

Run: `docker compose up --build`
Expected: dev server reachable at `http://localhost:5173` and loads venues from the host Supabase.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "chore: add Docker local dev environment"
```

### Task 21: Netlify config

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Create `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

# SPA fallback
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 2: Verify production build**

Run: `npm run build`
Expected: `dist/` produced with no errors.

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "chore: add Netlify config"
```

### Task 22: GitHub Actions CI + Codecov

**Files:**
- Create: `.github/workflows/ci.yml`, `codecov.yml`

- [ ] **Step 1: Create `codecov.yml`**

```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 2%
    patch:
      default:
        target: 60%
comment: false
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run coverage
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: false
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
```

Note: the build step's env vars are optional for CI (build succeeds without them; the client just logs a warning). They are listed so CI mirrors production. No secret values appear in the file.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml codecov.yml
git commit -m "ci: add GitHub Actions pipeline with Codecov"
```

### Task 23: Sentry source maps in CI (release builds)

**Files:**
- Modify: `.github/workflows/ci.yml`, `vite.config.ts`, `package.json`

- [ ] **Step 1: Enable source maps in `vite.config.ts`**

Add `build: { sourcemap: true }` to the Vite config (alongside `plugins`/`test`).

- [ ] **Step 2: Install the Sentry Vite plugin**

Run: `npm install -D @sentry/vite-plugin`

- [ ] **Step 3: Add the plugin to `vite.config.ts`, gated on an auth token**

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';
// in plugins array, after react():
...(process.env.SENTRY_AUTH_TOKEN
  ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    })]
  : []),
```

- [ ] **Step 4: Pass Sentry env to the CI build step**

Add to the `npm run build` step `env:` block in `ci.yml`:
```yaml
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```
When the secret is absent (e.g. forks/PRs), the plugin is skipped and the build still succeeds.

- [ ] **Step 5: Verify build still works without the token**

Run: `npm run build`
Expected: PASS (plugin skipped locally).

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json package-lock.json .github/workflows/ci.yml
git commit -m "ci: upload Sentry source maps on build when token present"
```

### Task 24: README + CONTRIBUTING (mandatory setup docs)

**Files:**
- Modify: `README.md`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write `README.md`** with these sections (real content, no placeholders):

1. **Title + one-paragraph description** + a screenshot from `.tmp/schwingkeller-design/screenshots/`.
2. **Features** (bullet list mirroring the Feature Scope of the spec).
3. **Tech stack** (table).
4. **Architecture** — short paragraph + the `src/` module tree.
5. **Prerequisites** — Docker, Node 20, `supabase` CLI; free accounts: Supabase, Netlify, Codecov, Sentry.
6. **Environment variables** — the full table below.
7. **Local development** — exact commands:
   - `cp .env.example .env.local`
   - `supabase start` (prints URL + keys) → copy into `.env.local`
   - `supabase db reset` (applies migrations + seed)
   - create an admin: `supabase` dashboard (Studio at `http://localhost:54323`) → Authentication → Add user, OR document the `auth.admin` approach
   - `npm install && npm run dev` **or** `docker compose up --build`
   - running tests: `npm test`, coverage: `npm run coverage`
8. **Supabase (cloud) setup** — create project; **Project Settings → API keys**: copy the **publishable** key (`sb_publishable_…`) for the frontend and keep the **secret** key (`sb_secret_…`) private; **disable public signups** (Authentication → Providers → Email → turn off "Enable sign-ups", or Auth settings "Allow new users to sign up" = off); invite admins (Authentication → Users → Invite); link & push migrations: `supabase link --project-ref <ref>` then `supabase db push`; confirm the `venue-photos` bucket exists (created by migration).
9. **Netlify setup** — connect the GitHub repo; build command `npm run build`, publish dir `dist`; add env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`; deploy previews on PRs.
10. **Codecov setup** — add the repo on codecov.io; for public repos a token is optional, but add `CODECOV_TOKEN` as a GitHub Actions secret to be safe.
11. **Sentry setup** — create a project (React); copy the DSN into `VITE_SENTRY_DSN`; for source maps create an auth token and add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as GitHub secrets.
12. **Security note** — RLS is the security boundary; publishable key + DSN are browser-safe; the secret key and all tokens live only in Netlify/GitHub secret stores; nothing sensitive is committed.

   **Environment variable table (include verbatim):**

   | Variable | Used by | Browser-exposed? | Where to get it |
   |---|---|---|---|
   | `VITE_SUPABASE_URL` | frontend | yes | Supabase → Project Settings → API |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend | yes (safe) | Supabase → API keys → publishable (`sb_publishable_…`) |
   | `VITE_SENTRY_DSN` | frontend | yes (safe) | Sentry → Project → Client Keys (DSN) |
   | `CODECOV_TOKEN` | GitHub Actions | no | codecov.io → repo settings |
   | `SENTRY_AUTH_TOKEN` | GitHub Actions | no | Sentry → Account → Auth Tokens |
   | `SENTRY_ORG` / `SENTRY_PROJECT` | GitHub Actions | no | Sentry org/project slugs |
   | secret key (`sb_secret_…`) | server/tooling only | **NO — never** | Supabase → API keys → secret |

- [ ] **Step 2: Write `CONTRIBUTING.md`**

Cover: project layout, the TDD workflow (`npm test`), code style (`npm run lint`), commit conventions, how to add a migration (`supabase migration new <name>` + `supabase db reset`), and the rule that **no secrets are ever committed** (only `.env.example` placeholders).

- [ ] **Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: add README and CONTRIBUTING with full setup guide"
```

### Task 25: Final verification

- [ ] **Step 1: Full local gate**

Run: `npm run lint && npm run typecheck && npm run coverage && npm run build`
Expected: all PASS; coverage report generated; `dist/` built.

- [ ] **Step 2: Manual smoke (against local Supabase)**

Confirm: map + 8 seed venues, canton grouping, search, language switch (DE/FR/IT), detail modal, navigate link, admin login, add (with photo upload + geocode + pick-on-map), edit, delete, JSON+CSV export, JSON+CSV import.

- [ ] **Step 3: Confirm no secrets tracked**

Run: `git ls-files | grep -E '\.env' || echo "clean"`
Expected: prints only `.env.example` (or `clean` plus that one file) — no `.env.local`/secrets.

- [ ] **Step 4: Push and verify CI**

Push the branch; open a PR. Confirm GitHub Actions runs lint/typecheck/coverage/build, Codecov reports, and Netlify produces a deploy preview.

---

## Self-Review Notes (completed)

- **Spec coverage:** map/sidebar/detail/admin CRUD/geocoding/import-export/i18n (Tasks 3–9, 14–19) ✓; Supabase schema + RLS + storage + publishable-key model (Tasks 10–12) ✓; invited-admin auth, signup disabled (Task 13 + README §8) ✓; seed dev/CI-only (Task 10) ✓; Docker (Task 20) ✓; Netlify (Task 21) ✓; Codecov (Task 22) ✓; Sentry + source maps (Tasks 11, 23) ✓; no-secrets policy (`.gitignore` Task 1, `.env.example` Task 11, verify Task 25) ✓; mandatory docs (Task 24) ✓.
- **Naming consistency:** `wappenUrl`, `cantonByCode`, `plzToCanton`, `cantonFromGeo`, `filterVenues`, `groupByCanton`, `normalizeVenue`/`parseCSV`/`toCSV`/`toJSON`, `forwardGeocode`/`reverseGeocode`, `listVenues`/`createVenue`/`updateVenue`/`removeVenue`/`replaceAllVenues`/`uploadPhoto`, `useVenues`/`useVenueMutations`, `pinHtml`/`popupHtml`/`clusterIcon` — used consistently across tasks.
- **Photo migration note:** imports carrying `photo`/`photo_url` strings are stored as-is (URL); only interactive uploads go through `uploadPhoto` to Storage — consistent with the spec's note.
