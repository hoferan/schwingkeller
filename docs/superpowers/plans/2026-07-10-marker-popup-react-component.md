# Marker Popup React Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Leaflet marker popup's raw HTML-string content (`popupHtml` in `src/features/map/markers.ts`) with a real, mounted React component (`MarkerPopup`), lazily mounted when a popup opens and unmounted when it closes.

**Architecture:** A new `MarkerPopup.tsx` component (styled like the existing `DetailModal.tsx`) replaces the string-concatenation `popupHtml`/`svgIcon` helpers. `MapView.tsx`'s `refreshMarkers()` binds an empty `<div>` to each marker's popup via `bindPopup()`, then mounts a React root into that div on the marker's `popupopen` event and unmounts it on `popupclose` — avoiding a mounted root for every marker up front. `pinHtml` and `clusterIcon` in `markers.ts` are untouched.

**Tech Stack:** React 19, TypeScript, `react-dom/client` (`createRoot`), Leaflet, Vitest + React Testing Library.

## Global Constraints

- Popup content becomes a real React component; `pinHtml` (pin dot) and `clusterIcon` (cluster bubble) in `markers.ts` stay exactly as they are today — out of scope (spec: Scope boundary).
- Mounting is lazy: the React root for a marker's popup is created only in that marker's `popupopen` handler, and unmounted in its `popupclose` handler (spec: Mounting & lifecycle).
- After `root.render()`, call `m.getPopup()?.update()` to force Leaflet to recompute popup layout against the real (now-mounted) content — without this the popup renders undersized on first open (spec: Layout note).
- The mount/unmount wiring lives inline in `MapView.tsx`'s `refreshMarkers`, next to the existing per-marker `m.on('click', ...)` wiring — not extracted into a helper (spec: approved design).
- No new npm dependency: `createRoot`/`Root` come from `react-dom/client`, already available via the existing `react-dom` dependency (CLAUDE.md: don't add new npm dependencies; spec: Out of scope).
- Don't use `any` in TypeScript — use proper types or `unknown` (CLAUDE.md). Existing `// eslint-disable-next-line @typescript-eslint/no-explicit-any` lines already in `MapView.tsx`/`markers.ts` for untyped Leaflet plugin APIs (`leaflet.markercluster`) are pre-existing and out of scope — don't add new ones.
- Keep i18n keys in sync — no new user-facing text is introduced; `MarkerPopup` reuses the existing `t.indoor` / `t.outdoor` / `t.details` keys already used by `popupHtml` today (spec: Out of scope).
- Run `npm run test` and `npm run lint` before claiming any task complete (CLAUDE.md).

---

### Task 1: `MarkerPopup` component

**Files:**
- Create: `src/features/map/MarkerPopup.tsx`
- Test: `src/features/map/MarkerPopup.test.tsx`

**Interfaces:**
- Consumes: `Venue` type (`src/features/venues/types.ts`), `STR`/`typeof STR.de` (`src/i18n/translations.ts`), `cantonByCode`/`wappenUrl` (`src/data/cantons.ts`), `theme` (`src/theme.ts`), `Home`/`Mountain`/`ArrowRight` from `lucide-react`.
- Produces: `export function MarkerPopup({ venue, t, onDetail }: MarkerPopupProps)` where
  ```ts
  interface MarkerPopupProps {
    venue: Venue;
    t: T; // T = typeof STR.de
    onDetail: () => void;
  }
  ```
  Consumed by Task 2 (`MapView.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/features/map/MarkerPopup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { MarkerPopup } from './MarkerPopup';

const venue: Venue = {
  id: '1',
  name: 'Emmental',
  canton: 'BE',
  address: '3550 Langnau',
  lat: 46.9,
  lng: 7.7,
  indoor: true,
  outdoor: false,
  person: '',
  phone: '',
  website: '',
  photo_url: null,
};

describe('MarkerPopup', () => {
  it('renders the venue name, address, and indoor/outdoor tags', () => {
    render(<MarkerPopup venue={venue} t={STR.de} onDetail={vi.fn()} />);
    expect(screen.getByText('Emmental')).toBeInTheDocument();
    expect(screen.getByText('3550 Langnau')).toBeInTheDocument();
    expect(screen.getByText(STR.de.indoor)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.outdoor)).not.toBeInTheDocument();
  });

  it('calls onDetail when the details button is clicked', () => {
    const onDetail = vi.fn();
    render(<MarkerPopup venue={venue} t={STR.de} onDetail={onDetail} />);
    fireEvent.click(screen.getByRole('button', { name: STR.de.details }));
    expect(onDetail).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/map/MarkerPopup.test.tsx`
Expected: FAIL — `Failed to resolve import "./MarkerPopup"` (the module doesn't exist yet).

- [ ] **Step 3: Write the component**

Create `src/features/map/MarkerPopup.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { Home, Mountain, ArrowRight } from 'lucide-react';
import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { theme } from '../../theme';

type T = typeof STR.de;

interface MarkerPopupProps {
  venue: Venue;
  t: T;
  onDetail: () => void;
}

// Matches svgIcon's inline style from the old popupHtml string builder, preserved for
// pixel-equivalent alignment inside the badge/button text.
const iconStyle: CSSProperties = { flex: 'none', verticalAlign: '-2px' };

const wrapStyle: CSSProperties = { width: '222px', fontFamily: 'Work Sans, sans-serif' };
const photoStyle = (url: string): CSSProperties => ({
  height: '104px', background: `url(${url}) center/cover`,
});
const photoPlaceholderStyle: CSSProperties = {
  height: '104px', background: 'repeating-linear-gradient(45deg,#e5e5e5 0 9px,#d4d4d4 9px 18px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const fotoLabelStyle: CSSProperties = {
  fontFamily: 'monospace', fontSize: '10px', letterSpacing: '.1em', color: theme.color.ink,
  background: theme.color.bg, border: '1px solid ' + theme.color.line,
  borderRadius: theme.radius.pill, padding: '3px 7px',
};
const bodyStyle: CSSProperties = { padding: '11px 13px 13px' };
const headerRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '7px' };
const wappenStyle: CSSProperties = { width: '15px', height: '19px', objectFit: 'contain' };
const nameStyle: CSSProperties = {
  fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700, fontSize: '14.5px',
  color: theme.color.ink, lineHeight: 1.2,
};
const addressStyle: CSSProperties = { fontSize: '11.5px', color: theme.color.muted, marginTop: '3px' };
const tagsRowStyle: CSSProperties = { display: 'flex', gap: '6px', marginTop: '9px' };
const tagStyle: CSSProperties = {
  fontSize: '10.5px', fontWeight: 600, color: theme.color.ink, background: theme.color.bg,
  border: '1px solid ' + theme.color.line, borderRadius: theme.radius.pill, padding: '3px 8px',
};
const detailBtnStyle: CSSProperties = {
  marginTop: '11px', width: '100%', border: 'none', cursor: 'pointer', background: theme.color.accent,
  color: theme.color.accentInk, fontFamily: theme.font.body, fontWeight: 600, fontSize: '12.5px',
  padding: '9px', borderRadius: '10px',
};

export function MarkerPopup({ venue, t, onDetail }: MarkerPopupProps) {
  const c = cantonByCode(venue.canton);
  return (
    <div style={wrapStyle}>
      {venue.photo_url ? (
        <div style={photoStyle(venue.photo_url)} />
      ) : (
        <div style={photoPlaceholderStyle}>
          <span style={fotoLabelStyle}>FOTO</span>
        </div>
      )}
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          {c && <img src={wappenUrl(c.code)} alt="" style={wappenStyle} />}
          <span style={nameStyle}>{venue.name}</span>
        </div>
        <div style={addressStyle}>{venue.address}</div>
        <div style={tagsRowStyle}>
          {venue.indoor && (
            <span style={tagStyle}><Home size={11} style={iconStyle} /> {t.indoor}</span>
          )}
          {venue.outdoor && (
            <span style={tagStyle}><Mountain size={11} style={iconStyle} /> {t.outdoor}</span>
          )}
        </div>
        <button onClick={onDetail} style={detailBtnStyle}>
          {t.details} <ArrowRight size={13} style={iconStyle} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/map/MarkerPopup.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/map/MarkerPopup.tsx src/features/map/MarkerPopup.test.tsx
git commit -m "feat: add MarkerPopup React component"
```

---

### Task 2: Wire `MarkerPopup` into `MapView.tsx` and remove `popupHtml`

`MapView.tsx` is the only consumer of `popupHtml`, so switching it over to `MarkerPopup` and deleting `popupHtml` are done together — splitting them would leave the repo non-building in between (`MapView.tsx` importing a symbol `markers.ts` no longer exports, or vice versa).

**Files:**
- Modify: `src/features/map/markers.ts` (remove `popupHtml`, `svgIcon`, `homeIcon`, `mountainIcon`, `arrowRightIcon`, and their now-unused imports; keep `pinHtml`, `clusterIcon`)
- Modify: `src/features/map/markers.test.ts` (remove the `popupHtml` test, keep the `pinHtml` test)
- Modify: `src/features/map/MapView.tsx:1-10` (imports)
- Modify: `src/features/map/MapView.tsx:124-137` (`refreshMarkers`)
- Modify: `src/features/map/MapView.tsx:181-185` (remove `onPopupOpen`)
- Modify: `src/features/map/MapView.tsx:201` (remove `map.on('popupopen', onPopupOpen)`)

**Interfaces:**
- Consumes: `MarkerPopup` from `./MarkerPopup` (Task 1) — `<MarkerPopup venue={v} t={t} onDetail={onDetail} />`; `ReactDOM.createRoot` and `type Root` from `react-dom/client`.
- Produces: `markers.ts` now only exports `pinHtml` and `clusterIcon` (both unchanged in behavior). `MapView` component's external props/behavior (`MapViewProps`) are unchanged.

- [ ] **Step 1: Drop the `popupHtml` test from `markers.test.ts`**

Replace the full contents of `src/features/map/markers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pinHtml } from './markers';

describe('markers html', () => {
  it('pinHtml renders same color for both selected and unselected states with flat theme', () => {
    // With the flat theme, selected and unselected states render identically since there's only one accent color
    expect(pinHtml(true)).toBe(pinHtml(false));
  });
});
```

- [ ] **Step 2: Remove `popupHtml` and the SVG icon helpers from `markers.ts`**

Replace the full contents of `src/features/map/markers.ts`:

```ts
import { theme } from '../../theme';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pinHtml = (_sel: boolean): string =>
  '<div style="position:relative;width:28px;height:28px;">'
  + '<div style="position:absolute;inset:0;border-radius:50%;background:' + theme.color.accent + ';border:3px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';"></div>'
  + '<div style="position:absolute;left:9px;top:9px;width:10px;height:10px;border-radius:50%;background:' + theme.color.bg + ';"></div>'
  + '</div>';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
```

- [ ] **Step 3: Update `MapView.tsx` imports**

Replace lines 1-10 of `src/features/map/MapView.tsx`:

```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ReactDOM, { type Root } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { Maximize } from 'lucide-react';
import type { Venue } from '../venues/types';
import { useTranslation } from '../../i18n/useTranslation';
import { pinHtml, clusterIcon } from './markers';
import { MarkerPopup } from './MarkerPopup';
import { theme } from '../../theme';
```

- [ ] **Step 4: Replace `refreshMarkers` with lazy mount/unmount wiring**

Replace the `refreshMarkers` function (currently `src/features/map/MapView.tsx:124-137`):

```tsx
  const refreshMarkers = () => {
    const map = mapRef.current; const group = markerGroupRef.current;
    if (!group || !map) return;
    const sz = map.getSize ? map.getSize() : null;
    if (sz && (sz.x <= 0 || sz.y <= 0)) { window.setTimeout(refreshMarkers, 120); return; }
    group.clearLayers(); markersRef.current = {};
    venuesRef.current.forEach((v) => {
      const icon = L.divIcon({ className: '', html: pinHtml(v.id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] });
      const m = L.marker([v.lat, v.lng], { icon }).addTo(group);
      const popupContainer = document.createElement('div');
      let popupRoot: Root | null = null;
      m.bindPopup(popupContainer, { maxWidth: 240, minWidth: 222, closeButton: true });
      m.on('popupopen', () => {
        popupRoot = ReactDOM.createRoot(popupContainer);
        popupRoot.render(
          <MarkerPopup venue={v} t={tRef.current} onDetail={() => onOpenDetailRef.current(v.id)} />
        );
        m.getPopup()?.update();
      });
      m.on('popupclose', () => {
        popupRoot?.unmount();
        popupRoot = null;
      });
      m.on('click', () => onSelectRef.current(v.id));
      markersRef.current[v.id] = m;
    });
  };
```

- [ ] **Step 5: Remove the `onPopupOpen` handler and its registration**

Delete the `onPopupOpen` function (currently `src/features/map/MapView.tsx:181-185`):

```tsx
  const onPopupOpen = (e: L.PopupEvent) => {
    const el = e.popup.getElement(); if (!el) return;
    const b = el.querySelector('[data-detail]') as HTMLElement | null;
    if (b) b.onclick = () => { const id = b.getAttribute('data-detail'); if (id) onOpenDetailRef.current(id); };
  };
```

And remove its registration (currently `src/features/map/MapView.tsx:201`):

```tsx
    map.on('popupopen', onPopupOpen);
```

(Leave `map.on('click', onMapClick);` on the following line untouched.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no errors.

Run: `grep -n "popupHtml\|onPopupOpen\|data-detail" src/features/map/MapView.tsx src/features/map/markers.ts`
Expected: no output (all three fully removed).

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: PASS — all tests pass, including `MarkerPopup.test.tsx` and the trimmed `markers.test.ts` from Task 1 and this task. `MapView.tsx` itself has no unit tests (Leaflet needs real DOM/layout APIs unavailable under `jsdom`; no `MapView.test.*` exists in the repo today — this task doesn't change that).

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: PASS — no errors (in particular, no unused-import errors for anything removed in Steps 2/3/5).

- [ ] **Step 9: Commit**

```bash
git add src/features/map/markers.ts src/features/map/markers.test.ts src/features/map/MapView.tsx
git commit -m "feat: mount MarkerPopup lazily on popup open/close"
```

---

### Task 3: Final verification

**Files:** none (verification only, no code changes)

**Interfaces:** none.

- [ ] **Step 1: Run the full automated gate**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all four commands exit 0. `npm run build` in particular confirms the JSX added to `markers`-adjacent files compiles and bundles correctly through `tsc -b && vite build`.

- [ ] **Step 2: Manual browser verification (do this, or explicitly flag if you can't)**

Start the dev server (`npm run dev`) and, in a real browser, open a venue marker's popup:

- Confirm the popup renders identically to before (photo/placeholder, Wappen + name, address, indoor/outdoor tags, "Details" button) — no visual regression.
- Confirm clicking "Details" opens the venue's detail modal (replacing the old `data-detail` DOM-delegation click).
- Open and close several popups in a row (including switching directly between two different markers) and confirm no errors appear in the browser console — this is the real-world check that `popupclose` fires reliably and roots are cleaned up (React warns loudly in the console if `root.unmount()` is ever called twice or on an already-unmounted root).
- Switch the UI language (DE/FR/IT) while a popup is open, then reopen it, and confirm the popup shows the new language's `indoor`/`outdoor`/`details` text.

**Note for whoever executes this plan:** this app requires live Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`) to load real venue markers — see `.env.example`. If those aren't available in your environment, you cannot complete this step; say so explicitly rather than claiming it was verified (CLAUDE.md: "if you can't test the UI, say so explicitly rather than claiming success"), and flag it to the user for a manual check before merging.

- [ ] **Step 3: Confirm scope boundary held**

```bash
git diff --stat origin/main...HEAD
```

Expected: only `src/features/map/MarkerPopup.tsx`, `src/features/map/MarkerPopup.test.tsx`, `src/features/map/markers.ts`, `src/features/map/markers.test.ts`, `src/features/map/MapView.tsx` (plus the design doc from the earlier commit) are touched. No changes to `pinHtml`, `clusterIcon`, i18n translation files, or any other feature directory.
