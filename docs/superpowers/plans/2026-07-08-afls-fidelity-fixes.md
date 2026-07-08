# AFLS Fidelity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining visual/behavioral gaps between the shipped restyle and the AFLS reference: an always-visible header identity with a text-label language toggle and no hamburger, and a map that uses real OpenStreetMap tiles, a clean satellite view, and no border mask or canton lines.

**Architecture:** Three files change, in dependency order: `Topbar.tsx` first (its prop signature shrinks), then `App.tsx` (updates its `<Topbar>` call site to match, and removes now-dead tablet-scrim code), then `MapView.tsx` (independent of the other two — tile/layer logic only).

**Tech Stack:** React 19 + TypeScript + Vite, inline styles, Leaflet/react-leaflet, Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies.
- No `any` in TypeScript.
- No changes to `theme.ts`, palette, typography, or any other component — this plan touches exactly `Topbar.tsx`, `Topbar.test.tsx`, `App.tsx`, `MapView.tsx`.
- No i18n key changes — the language-toggle label swap (flags → text) is a local `Record` in `Topbar.tsx`, not part of `src/i18n/translations.ts`.
- `npm run test` remains a pure regression safety net (no test asserts on colors/tiles/layout), except `Topbar.test.tsx`, which this plan updates directly to match the new prop signature.
- Run `npm run lint` and `npm run test` after every task; both must pass before committing.
- **Do not push to `origin`.** Commit locally after each task only — push is out of scope for this plan.

---

### Task 1: Topbar — always-visible wordmark, text-label language pills, no hamburger

**Files:**
- Modify: `src/components/Topbar.tsx`
- Modify: `src/components/Topbar.test.tsx`

**Interfaces:**
- Produces: `TopbarProps` shrinks to `{ onOpenLogin: () => void; isMobile: boolean }` — `onToggleSidebar` and `showHamburger` are removed. Task 2 (`App.tsx`) must update its `<Topbar>` call site to match this new signature, or the build fails to typecheck.

- [ ] **Step 1: Replace the whole file**

Old (full file, 215 lines):

```tsx
import { useState } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { useTranslation } from '../i18n/useTranslation';
import { LANGS, type Lang } from '../i18n/translations';
import { theme } from '../theme';

interface TopbarProps {
  onToggleSidebar: () => void;
  showHamburger: boolean;
  onOpenLogin: () => void;
  isMobile: boolean;
}

const LANG_FLAGS: Record<Lang, string> = { de: '🇩🇪', fr: '🇫🇷', it: '🇮🇹' };

const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  lineHeight: '1',
  padding: '6px 8px',
  borderRadius: theme.radius.pill,
});

const lockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
  </svg>
);

const unlockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 7.5-1.4"></path>
  </svg>
);

export const Topbar = ({ onToggleSidebar, showHamburger, onOpenLogin, isMobile }: TopbarProps) => {
  const { isAdmin, signOut } = useAuth();
  const { lang, t, setLang } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const adminPill = isAdmin && (
    <div
      title={t.adminMode}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 'none',
        background: theme.color.accent, color: theme.color.accentInk, fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 12px',
        borderRadius: theme.radius.pill, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: theme.color.accentInk, flex: 'none' }}></span>
      {isMobile ? 'Admin' : t.adminMode}
    </div>
  );

  return (
    <div
      style={{
        height: '60px', flex: 'none', background: theme.color.bg,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '2px solid ' + theme.color.accent, position: 'relative', zIndex: 1100,
      }}
    >
      {showHamburger && (
        <button
          onClick={onToggleSidebar}
          aria-label="Menu"
          style={{
            border: 'none', background: theme.color.paper, color: theme.color.ink,
            width: '38px', height: '38px', borderRadius: theme.radius.sm, cursor: 'pointer',
            fontSize: '17px', flex: 'none',
          }}
        >
          ☰
        </button>
      )}
      {/* Wordmark + tagline — hidden on mobile to keep the bar from overflowing. */}
      {!isMobile && (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: theme.font.display, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: theme.color.accent, fontSize: '15px', lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            SCHWINGKELLER SCHWEIZ
          </div>
          <div
            style={{
              fontSize: '10.5px', color: theme.color.muted, lineHeight: 1.1, marginTop: '1px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {t.tagline}
          </div>
        </div>
      )}

      {/* Centered admin pill: flanked by two flex spacers so it sits mid-bar. */}
      <div style={{ flex: 1 }}></div>
      {isAdmin && (
        <>
          {adminPill}
          <div style={{ flex: 1 }}></div>
        </>
      )}

      {/* Language switcher: compact menu on mobile, inline flags on desktop. */}
      {isMobile ? (
        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            onClick={() => setLangMenuOpen((o) => !o)}
            aria-label="Sprache / langue / lingua"
            aria-expanded={langMenuOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: theme.color.paper,
              border: 'none', borderRadius: theme.radius.pill, padding: '6px 8px', cursor: 'pointer',
              fontSize: '15px', lineHeight: 1, color: theme.color.ink,
            }}
          >
            {LANG_FLAGS[lang]}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {langMenuOpen && (
            <>
              <div
                onClick={() => setLangMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 1190 }}
              />
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1200,
                  background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
                  boxShadow: theme.shadow, padding: '4px', minWidth: '92px',
                }}
              >
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setLangMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      background: l === lang ? theme.color.accent : 'transparent', border: 'none',
                      color: l === lang ? theme.color.accentInk : theme.color.ink, fontSize: '13px', fontWeight: 600, padding: '8px 10px',
                      borderRadius: theme.radius.sm, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>{LANG_FLAGS[l]}</span>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex', gap: '2px', background: theme.color.paper,
            padding: '4px', borderRadius: theme.radius.pill, flex: 'none',
          }}
        >
          <button onClick={() => setLang('de')} aria-label="Deutsch" style={langStyle(lang === 'de')}>🇩🇪</button>
          <button onClick={() => setLang('fr')} aria-label="Français" style={langStyle(lang === 'fr')}>🇫🇷</button>
          <button onClick={() => setLang('it')} aria-label="Italiano" style={langStyle(lang === 'it')}>🇮🇹</button>
        </div>
      )}

      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.ink, background: 'transparent',
            border: '1.5px solid ' + theme.color.line, borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '7px 13px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{unlockIcon}</span>
          {!isMobile && t.logout}
        </button>
      ) : (
        <button
          onClick={onOpenLogin}
          type="button"
          title={t.login}
          aria-label={t.login}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.accentInk, background: theme.color.accent,
            border: 'none', borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '8px 14px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{lockIcon}</span>
          {!isMobile && t.login}
        </button>
      )}
    </div>
  );
};
```

New (full file):

```tsx
import { useAuth } from '../features/auth/useAuth';
import { useTranslation } from '../i18n/useTranslation';
import { LANGS, type Lang } from '../i18n/translations';
import { theme } from '../theme';

interface TopbarProps {
  onOpenLogin: () => void;
  isMobile: boolean;
}

const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', fr: 'Français', it: 'Italiano' };

const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: '1',
  padding: '6px 10px',
  borderRadius: theme.radius.pill,
});

const lockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
  </svg>
);

const unlockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 7.5-1.4"></path>
  </svg>
);

export const Topbar = ({ onOpenLogin, isMobile }: TopbarProps) => {
  const { isAdmin, signOut } = useAuth();
  const { lang, t, setLang } = useTranslation();

  const adminPill = isAdmin && (
    <div
      title={t.adminMode}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 'none',
        background: theme.color.accent, color: theme.color.accentInk, fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 12px',
        borderRadius: theme.radius.pill, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: theme.color.accentInk, flex: 'none' }}></span>
      {isMobile ? 'Admin' : t.adminMode}
    </div>
  );

  return (
    <div
      style={{
        height: '60px', flex: 'none', background: theme.color.bg,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '2px solid ' + theme.color.accent, position: 'relative', zIndex: 1100,
      }}
    >
      {/* Wordmark: always visible, matching the AFLS reference. Tagline stays mobile-hidden to save vertical space. */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.font.display, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: theme.color.accent, fontSize: '15px', lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          SCHWINGKELLER
        </div>
        {!isMobile && (
          <div
            style={{
              fontSize: '10.5px', color: theme.color.muted, lineHeight: 1.1, marginTop: '1px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {t.tagline}
          </div>
        )}
      </div>

      {/* Centered admin pill: flanked by two flex spacers so it sits mid-bar. */}
      <div style={{ flex: 1 }}></div>
      {isAdmin && (
        <>
          {adminPill}
          <div style={{ flex: 1 }}></div>
        </>
      )}

      {/* Language switcher: one text-pill row at every width, matching the AFLS reference. */}
      <div
        style={{
          display: 'flex', gap: '2px', background: theme.color.paper,
          padding: '4px', borderRadius: theme.radius.pill, flex: 'none',
        }}
      >
        {LANGS.map((l) => (
          <button key={l} onClick={() => setLang(l)} aria-label={LANG_NAMES[l]} style={langStyle(lang === l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.ink, background: 'transparent',
            border: '1.5px solid ' + theme.color.line, borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '7px 13px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{unlockIcon}</span>
          {!isMobile && t.logout}
        </button>
      ) : (
        <button
          onClick={onOpenLogin}
          type="button"
          title={t.login}
          aria-label={t.login}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.accentInk, background: theme.color.accent,
            border: 'none', borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '8px 14px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{lockIcon}</span>
          {!isMobile && t.login}
        </button>
      )}
    </div>
  );
};
```

Notes on what changed beyond the literal ask: `useState` import is dropped (its only use, `langMenuOpen`, no longer exists). `LANG_FLAGS` (emoji lookup) is replaced by `LANG_NAMES` (full names), now used only for the `aria-label` — the visible button text is `l.toUpperCase()` (`"DE"`/`"FR"`/`"IT"`). `langStyle` gains `fontWeight: 700` and a slightly smaller `fontSize`/adjusted `padding`, appropriate for bold text labels where the old values were tuned for emoji glyphs.

- [ ] **Step 2: Update the test's render call to match the new props**

Old (`src/components/Topbar.test.tsx` lines 21-28):

```tsx
const renderTopbar = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <Topbar onToggleSidebar={() => {}} showHamburger={false} onOpenLogin={() => {}} isMobile={false} />
      </I18nContext.Provider>
    </AuthProvider>,
  );
```

New:

```tsx
const renderTopbar = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <Topbar onOpenLogin={() => {}} isMobile={false} />
      </I18nContext.Provider>
    </AuthProvider>,
  );
```

- [ ] **Step 3: Run the test and lint**

Run: `npx vitest run src/components/Topbar.test.tsx && npm run lint`
Expected: PASS (1/1 test — the test only asserts `/SCHWINGKELLER/` text and the login button render, both still true)

- [ ] **Step 4: Commit**

```bash
git add src/components/Topbar.tsx src/components/Topbar.test.tsx
git commit -m "style: always-visible wordmark, text-label language pills, drop hamburger"
```

(Do not push — see Global Constraints.)

---

### Task 2: App shell — update Topbar call site, remove dead tablet-scrim code

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Topbar`'s new props from Task 1 — `{ onOpenLogin, isMobile }`, no `onToggleSidebar`/`showHamburger`.

- [ ] **Step 1: Update the `<Topbar>` call site**

Old (line 242):

```tsx
      <Topbar onToggleSidebar={() => setSidebarOpen((o) => !o)} showHamburger={mode !== 'd'} onOpenLogin={() => setShowLogin(true)} isMobile={isMobile} />
```

New:

```tsx
      <Topbar onOpenLogin={() => setShowLogin(true)} isMobile={isMobile} />
```

- [ ] **Step 2: Remove the now-dead `scrimShow` computation**

Old (lines 92-96):

```tsx
  // ---- layout styles (prototype renderVals ~624-631) ----
  // Sidebar owns its own desktop/mobile layout. The tablet drawer scrim is
  // rendered here (shown only in tablet mode when the drawer is open).
  const scrimShow = mode === 't' && sidebarOpen;
  const mainStyle: CSSProperties = { position: 'relative', flex: '1 1 auto', display: 'flex', minHeight: 0 };
```

New:

```tsx
  // ---- layout styles (prototype renderVals ~624-631) ----
  const mainStyle: CSSProperties = { position: 'relative', flex: '1 1 auto', display: 'flex', minHeight: 0 };
```

Reasoning (for the implementer, not for the diff): `scrimShow` was only ever set to `true` by the Topbar hamburger's `onClick`, which no longer exists on tablet after Task 1 — nothing else in the file sets `sidebarOpen` to `true` on tablet width. Leaving `scrimShow` in place would be permanently-dead code computing a value nothing can ever make true.

- [ ] **Step 3: Remove the now-unreachable tablet scrim JSX**

Old (lines 262-269, including the blank line before `<div style={mapWrapStyle}>`):

```tsx
        {/* Tablet drawer scrim */}
        {scrimShow && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1150, animation: 'fadeIn .2s ease' }}
          />
        )}

        <div style={mapWrapStyle}>
```

New:

```tsx
        <div style={mapWrapStyle}>
```

- [ ] **Step 4: Run the full test suite, lint, and typecheck**

Run: `npm run test && npm run lint && npm run typecheck`
Expected: PASS (no dedicated `App.tsx` test file; the full suite is the regression check. Typecheck specifically confirms the `<Topbar>` call site matches Task 1's new `TopbarProps` shape.)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: drop dead tablet-scrim code, update Topbar call site"
```

---

### Task 3: MapView — real OpenStreetMap tiles, clean satellite, no mask, no canton lines

**Files:**
- Modify: `src/features/map/MapView.tsx`

**Interfaces:**
- Independent of Tasks 1-2 — no shared interfaces. This is the last file in the plan, so its verification step runs the full chain.

- [ ] **Step 1: Replace the whole file**

Old (full file, 320 lines) — reproduced here so the implementer doesn't need to cross-reference: see the current working tree at `src/features/map/MapView.tsx` for the exact byte-for-byte starting point (it matches what's shown in Task 1/2's "Old" context: unchanged by those tasks). Key regions being removed: the `GeoJSONFeatureCollection` interface, the `maskLayerRef`/`cantonLayerRef`/`satRefLayers` refs, the `cantonStyle` and `applyMaskTint` functions, the satellite reference-layer additions inside `setTile`, and the entire GeoJSON-fetching `init()` async function (plus its `cancelled` cancellation flag) inside the mount effect.

New (full file):

```tsx
import { useEffect, useRef, type CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Venue } from '../venues/types';
import { useTranslation } from '../../i18n/useTranslation';
import { pinHtml, popupHtml, clusterIcon } from './markers';
import { theme } from '../../theme';

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

const wrapStyle: CSSProperties = { position: 'relative', flex: 1, height: '100%' };
const mapElStyle: CSSProperties = { position: 'absolute', inset: 0 };
const overlayStyle: CSSProperties = {
  position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
  display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end',
};
const layerCardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '8px', background: theme.color.bg,
  border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, boxShadow: theme.shadow,
  padding: '10px 14px',
};
const radioRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', fontFamily: theme.font.body,
  fontSize: '13px', fontWeight: 600, color: theme.color.ink, cursor: 'pointer', whiteSpace: 'nowrap',
};
const radioInputStyle: CSSProperties = {
  accentColor: theme.color.accent, width: '16px', height: '16px', cursor: 'pointer', flex: 'none',
};
const fitAllBtnStyle: CSSProperties = {
  width: '38px', height: '38px', border: '1px solid ' + theme.color.line, background: theme.color.bg,
  color: theme.color.ink, borderRadius: theme.radius.sm, boxShadow: theme.shadow, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export function MapView({
  venues, selectedId, onSelect, onOpenDetail,
  baseKind, onChangeBase, placing, onPickLocation, registerFitAll,
}: MapViewProps) {
  const { t } = useTranslation();
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerGroupRef = useRef<any>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const tileRef = useRef<L.TileLayer | null>(null);

  // Latest-value refs so the imperative map callbacks (bound once) see fresh props.
  const venuesRef = useRef(venues);
  const selectedIdRef = useRef(selectedId);
  const placingRef = useRef(placing);
  const onSelectRef = useRef(onSelect);
  const onOpenDetailRef = useRef(onOpenDetail);
  const onPickLocationRef = useRef(onPickLocation);
  const tRef = useRef(t);
  useEffect(() => {
    venuesRef.current = venues;
    selectedIdRef.current = selectedId;
    placingRef.current = placing;
    onSelectRef.current = onSelect;
    onOpenDetailRef.current = onOpenDetail;
    onPickLocationRef.current = onPickLocation;
    tRef.current = t;
  });

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

  const refreshMarkers = () => {
    const map = mapRef.current; const group = markerGroupRef.current;
    if (!group || !map) return;
    const sz = map.getSize ? map.getSize() : null;
    if (sz && (sz.x <= 0 || sz.y <= 0)) { window.setTimeout(refreshMarkers, 120); return; }
    group.clearLayers(); markersRef.current = {};
    venuesRef.current.forEach((v) => {
      const icon = L.divIcon({ className: '', html: pinHtml(v.id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] });
      const m = L.marker([v.lat, v.lng], { icon }).addTo(group);
      m.bindPopup(popupHtml(v, tRef.current), { maxWidth: 240, minWidth: 222, closeButton: true });
      m.on('click', () => onSelectRef.current(v.id));
      markersRef.current[v.id] = m;
    });
  };

  const updatePins = () => {
    Object.keys(markersRef.current).forEach((id) => {
      markersRef.current[id].setIcon(L.divIcon({ className: '', html: pinHtml(id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] }));
    });
  };

  const focusVenue = (id: string) => {
    const map = mapRef.current; const m = markersRef.current[id];
    if (!m || !map) return;
    const mx = map.getMaxZoom ? map.getMaxZoom() : 17;
    const z = Math.min(mx, Math.max(map.getZoom() + 4, 16));
    map.flyTo(m.getLatLng(), z, { duration: 0.8 });
    window.setTimeout(() => { const mm = markersRef.current[id]; if (mm) mm.openPopup(); }, 880);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onClusterClick = (a: any) => {
    const map = mapRef.current;
    const cluster = a.layer || a.propagatedFrom;
    if (!cluster || !map) return;
    const mx = map.getMaxZoom ? map.getMaxZoom() : 17;
    let pts: number[][] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pts = (cluster.getAllChildMarkers ? cluster.getAllChildMarkers() : []).map((m: any) => { const ll = m.getLatLng(); return [ll.lat, ll.lng]; }).filter((p: number[]) => isFinite(p[0]) && isFinite(p[1]));
    } catch { /* ignore */ }
    if (pts.length > 1) {
      const spread = pts.some((p) => Math.abs(p[0] - pts[0][0]) > 1e-5 || Math.abs(p[1] - pts[0][1]) > 1e-5);
      if (spread) { map.flyToBounds(pts as L.LatLngBoundsExpression, { padding: [60, 60], maxZoom: 16, duration: 0.6 }); return; }
      if (cluster.spiderfy) { map.setView(pts[0] as L.LatLngExpression, Math.min(mx, map.getZoom() + 2), { animate: true }); window.setTimeout(() => { try { cluster.spiderfy(); } catch { /* ignore */ } }, 420); return; }
    }
    let ll: L.LatLng | undefined; try { ll = cluster.getLatLng(); } catch { /* ignore */ }
    map.flyTo(ll ? [ll.lat, ll.lng] : map.getCenter(), Math.min(mx, map.getZoom() + 3), { duration: 0.6 });
  };

  const onMapClick = (e: L.LeafletMouseEvent) => {
    if (!placingRef.current) return;
    const lat = +e.latlng.lat.toFixed(5);
    const lng = +e.latlng.lng.toFixed(5);
    onPickLocationRef.current(lat, lng);
  };

  const onPopupOpen = (e: L.PopupEvent) => {
    const el = e.popup.getElement(); if (!el) return;
    const b = el.querySelector('[data-detail]') as HTMLElement | null;
    if (b) b.onclick = () => { const id = b.getAttribute('data-detail'); if (id) onOpenDetailRef.current(id); };
  };

  // Mount: create the map once.
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: false, minZoom: 7, maxZoom: 17 }).setView([46.82, 8.23], 8);
    mapRef.current = map;
    L.control.attribution({ prefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' }).addTo(map);
    setTile(baseKind);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Lany = L as any;
    markerGroupRef.current = Lany.markerClusterGroup
      ? Lany.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true, zoomToBoundsOnClick: false, disableClusteringAtZoom: 16, removeOutsideVisibleBounds: false, animate: false, iconCreateFunction: clusterIcon(L) })
      : L.layerGroup();
    if (markerGroupRef.current.on) markerGroupRef.current.on('clusterclick', onClusterClick);
    map.on('popupopen', onPopupOpen);
    map.on('click', onMapClick);

    map.whenReady(() => {
      if (!mapRef.current) return;
      map.invalidateSize();
      window.setTimeout(() => {
        if (!mapRef.current || !markerGroupRef.current) return;
        map.invalidateSize();
        if (!map.hasLayer(markerGroupRef.current)) markerGroupRef.current.addTo(map);
        refreshMarkers();
      }, 160);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerGroupRef.current = null;
      markersRef.current = {};
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base layer change.
  useEffect(() => {
    if (!mapRef.current) return;
    setTile(baseKind);
  }, [baseKind]);

  // Venue list change → rebuild markers.
  useEffect(() => {
    if (!mapRef.current) return;
    refreshMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, t]);

  // Selection change → recolor pins and focus.
  useEffect(() => {
    if (!mapRef.current) return;
    updatePins();
    if (selectedId) focusVenue(selectedId);
  }, [selectedId]);

  // Crosshair cursor while placing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getContainer()) return;
    map.getContainer().style.cursor = placing ? 'crosshair' : '';
  }, [placing]);

  // Expose fit-all-bounds.
  useEffect(() => {
    if (!registerFitAll) return;
    registerFitAll(() => {
      const map = mapRef.current;
      if (map) map.flyToBounds([[45.7, 5.7], [47.95, 10.65]], { padding: [24, 24], duration: 0.8 });
    });
  }, [registerFitAll]);

  return (
    <div style={wrapStyle}>
      <div ref={mapElRef} style={mapElStyle} />
      <div style={overlayStyle}>
        <div style={layerCardStyle}>
          <label style={radioRowStyle}>
            <input
              type="radio"
              name="base-layer"
              checked={baseKind === 'map'}
              onChange={() => onChangeBase('map')}
              style={radioInputStyle}
            />
            {t.mapView}
          </label>
          <label style={radioRowStyle}>
            <input
              type="radio"
              name="base-layer"
              checked={baseKind === 'sat'}
              onChange={() => onChangeBase('sat')}
              style={radioInputStyle}
            />
            {t.satView}
          </label>
        </div>
        <button
          onClick={() => { const map = mapRef.current; if (map) map.flyToBounds([[45.7, 5.7], [47.95, 10.65]], { padding: [24, 24], duration: 0.8 }); }}
          title={t.fitAll}
          style={fitAllBtnStyle}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4" /><path d="M20 9V5a1 1 0 0 0-1-1h-4" /><path d="M4 15v4a1 1 0 0 0 1 1h4" /><path d="M20 15v4a1 1 0 0 1-1 1h-4" /></svg>
        </button>
      </div>
    </div>
  );
}
```

What changed and why: `GeoJSONFeatureCollection` interface, `maskLayerRef`, `cantonLayerRef`, `satRefLayers`, `cantonStyle`, and `applyMaskTint` are all deleted — they had exactly two consumers (the outside-Switzerland mask and the canton boundary lines), both removed per the spec, so the code that fetched `/cantons.geojson` and rendered them is now unreachable and is deleted rather than left as dead weight. `setTile('sat')` no longer adds the `World_Transportation`/`World_Boundaries_and_Places` reference layers — just the base `World_Imagery` layer. `setTile('map')` points at `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (was CartoDB Voyager) with `© OpenStreetMap contributors` attribution (was `© OpenStreetMap © CARTO`) and `maxZoom: 19` (unchanged). The mount effect's cleanup function drops the now-nonexistent `maskLayerRef`/`cantonLayerRef`/`satRefLayers` nulling. The base-layer-change effect drops its `applyMaskTint(baseKind)` call. Nothing else changes — markers, popups, clusters, the radio-button base/satellite card, and the fit-all button are untouched, all already correct from the prior restyle.

- [ ] **Step 2: Run the full verification chain — this is the last file in the plan**

Run: `npm run test && npm run lint && npm run typecheck && npm run build`
Expected: ALL PASS. There is no dedicated `MapView.tsx` test file, so the full suite is the regression check; typecheck/build confirm no leftover reference to the removed refs/functions anywhere (e.g. a stray call to `applyMaskTint` would fail here).

- [ ] **Step 3: Commit**

```bash
git add src/features/map/MapView.tsx
git commit -m "feat: switch to OpenStreetMap tiles, clean satellite view, drop border mask and canton lines"
```

---

## Self-Review Notes

- **Spec coverage:** every decision in the spec's "Decisions From Brainstorming" and "Component-by-Component Treatment" sections maps to a task — Topbar wordmark/language/hamburger (Task 1), App.tsx call-site + dead-code cleanup (Task 2), MapView tiles/satellite/mask/canton (Task 3).
- **Placeholder scan:** no TBD/TODO; both full-file replacements show complete, literal content.
- **Type consistency:** `TopbarProps`'s new shape (`{ onOpenLogin, isMobile }`) is defined in Task 1 and consumed identically in Task 2's `<Topbar>` call site — no mismatch. No task references a symbol removed by an earlier task (e.g. Task 2 doesn't reference `scrimShow` after removing it; Task 3 doesn't reference `applyMaskTint` after removing it).
- **Dead-code follow-through:** confirmed that removing the mask/canton-line features and the hamburger each have exactly one further consequence apiece (the `/cantons.geojson` fetch path in `MapView.tsx`; the `scrimShow`/tablet-scrim code in `App.tsx`) — both are included as explicit steps, not left as orphaned code for a future cleanup pass.
