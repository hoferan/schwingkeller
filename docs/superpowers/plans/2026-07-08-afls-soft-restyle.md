# Soft Rounded-Card Restyle (AFLS Reference) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shipped esv.ch-flat restyle's "zero radius, no shadow, black border" shape rules with a soft rounded-card system (rounded corners, soft shadows, light hairline borders) matching the afls-schwinglokale.wasmer.app reference, while keeping the red/black/white palette and Oswald/Work Sans typography from the prior restyle.

**Architecture:** `src/theme.ts`'s `radius` token changes from a single flat string to an object (`sm`/`pill`), plus a new `shadow` token and a lighter `line` (border) color. Every one of the 46 existing `theme.radius` call sites across 9 files must be updated to `theme.radius.sm` or `theme.radius.pill` (confirmed via `grep -rn "theme\.radius\b" src` — TypeScript will hard-fail the build on any site left unconverted, since `theme.radius` is no longer a plain string). A few components get structural changes beyond the token swap: Topbar goes from a black bar to a white one and drops its logo tile, Sidebar gains a new title-block section, MapView's base/satellite toggle becomes native radio buttons, and map pins become plain circles instead of teardrops.

**Tech Stack:** React 19 + TypeScript + Vite, inline styles, Leaflet/react-leaflet, Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies — native `<input type="radio">` plus the CSS `accentColor` property need no library.
- No `any` in TypeScript.
- `theme.radius` is now `{ sm: '10px', pill: '999px' }` — every previous flat `theme.radius` reference must become one of these two, never left bare (bare usage is now a TypeScript type error: assigning an object to a `borderRadius: string | number` CSS property).
- Circular shape primitives (dots, close buttons, the cluster bubble, the pin's own circular shape, drag-handle grab bar) use their own literal `50%` or `999px` and are unrelated to which `theme.radius` key is chosen for their container.
- `theme.color.line` changes from `#111111` (black) to `#e2e2e2` (light hairline gray) — this is a pure token-file edit; every consumer that already references `theme.color.line` picks up the new color automatically, no per-file changes needed for color alone.
- `theme.shadow` (`'0 4px 16px rgba(0,0,0,.12)'`) is added to floating/card elements: modals, popups, the map's zoom-replacement controls, the mobile sidebar drawer, the placing banner, and the flash toast. Inline content (list rows, form fields) does not get a shadow.
- Palette (red `#e30613` accent, black `#111111` ink, white `#ffffff` bg) and typography (`Oswald` display, `Work Sans` body) are unchanged from the prior restyle — do not touch font imports or hex values other than `line`.
- No i18n text changes except one new key (`searchTitle`) added to all three languages (DE/FR/IT) for the new Sidebar title block; the translations completeness test (`src/i18n/translations.test.ts`) already asserts all three languages share the same key set, so a key added to only one language fails that test.
- Confirmed via `Grep` that no existing test asserts on colors, radius, or shadow values (only text content and DOM structure), except `src/theme.test.ts` itself, which this plan updates directly. `npm run test` is otherwise a pure regression safety net.
- Run `npm run lint` and `npm run test` after every task; both must pass before committing.
- **Do not push to `origin` after any task.** Commit locally as usual after each task. Push only once, at the very end, after the final whole-branch review is clean.

---

### Task 1: Theme tokens — radius object, shadow, lighter border

**Files:**
- Modify: `src/theme.ts`
- Modify: `src/theme.test.ts`

**Interfaces:**
- Produces: `theme.radius.sm` (`'10px'`), `theme.radius.pill` (`'999px'`), `theme.shadow` (`'0 4px 16px rgba(0,0,0,.12)'`), `theme.color.line` now `'#e2e2e2'`. All other `theme.color.*`/`theme.font.*` keys unchanged. Every later task imports `theme` the same way it already does (`import { theme } from '<relative path>/theme'`) — only the shape of `theme.radius` changed for consumers.

- [ ] **Step 1: Replace `src/theme.ts`**

Old (full file):

```ts
export const theme = {
  color: {
    bg: '#ffffff',
    ink: '#111111',
    paper: '#f2f2f2',
    accent: '#e30613',
    accentInk: '#ffffff',
    line: '#111111',
    muted: '#6b6b6b',
  },
  font: {
    display: "'Oswald', sans-serif",
    body: "'Work Sans', sans-serif",
  },
  radius: '0px',
} as const;
```

New (full file):

```ts
export const theme = {
  color: {
    bg: '#ffffff',
    ink: '#111111',
    paper: '#f2f2f2',
    accent: '#e30613',
    accentInk: '#ffffff',
    line: '#e2e2e2',
    muted: '#6b6b6b',
  },
  font: {
    display: "'Oswald', sans-serif",
    body: "'Work Sans', sans-serif",
  },
  radius: {
    sm: '10px',
    pill: '999px',
  },
  shadow: '0 4px 16px rgba(0,0,0,.12)',
} as const;
```

- [ ] **Step 2: Replace `src/theme.test.ts`**

Old (full file):

```ts
import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme tokens', () => {
  it('defines the flat red/black/white palette', () => {
    expect(theme.color.bg).toBe('#ffffff');
    expect(theme.color.ink).toBe('#111111');
    expect(theme.color.accent).toBe('#e30613');
    expect(theme.color.accentInk).toBe('#ffffff');
    expect(theme.color.line).toBe('#111111');
  });

  it('uses Oswald for display text and keeps Work Sans for body text', () => {
    expect(theme.font.display).toBe("'Oswald', sans-serif");
    expect(theme.font.body).toBe("'Work Sans', sans-serif");
  });

  it('is fully flat: zero corner radius', () => {
    expect(theme.radius).toBe('0px');
  });
});
```

New (full file):

```ts
import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme tokens', () => {
  it('defines the red/black/white palette with a light hairline border', () => {
    expect(theme.color.bg).toBe('#ffffff');
    expect(theme.color.ink).toBe('#111111');
    expect(theme.color.accent).toBe('#e30613');
    expect(theme.color.accentInk).toBe('#ffffff');
    expect(theme.color.line).toBe('#e2e2e2');
  });

  it('uses Oswald for display text and keeps Work Sans for body text', () => {
    expect(theme.font.display).toBe("'Oswald', sans-serif");
    expect(theme.font.body).toBe("'Work Sans', sans-serif");
  });

  it('defines soft rounded-card radii and a floating-element shadow', () => {
    expect(theme.radius.sm).toBe('10px');
    expect(theme.radius.pill).toBe('999px');
    expect(theme.shadow).toBe('0 4px 16px rgba(0,0,0,.12)');
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run src/theme.test.ts`
Expected: PASS (3 tests). Note: the whole app will NOT typecheck/build again until every other task in this plan lands, since `theme.radius` bare references are now a type error — that's expected and resolved task-by-task.

- [ ] **Step 4: Commit**

```bash
git add src/theme.ts src/theme.test.ts
git commit -m "feat: switch theme radius to sm/pill tokens, add shadow, lighten border"
```

(Do not push — see Global Constraints.)

---

### Task 2: Global CSS — rounded Leaflet chrome, shadows, pill scrollbar

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing (plain CSS). Hex/shape values below are literal copies of the new `theme.ts` tokens (`#e2e2e2` for `line`, `0 4px 16px rgba(0,0,0,.12)` for `shadow`, `10px` for `radius.sm`, `999px` for `radius.pill`) — the existing sync-comment at the top of the file already documents this duplication.

- [ ] **Step 1: Replace the whole file**

Old (full file, 26 lines):

```css
/* Hex values below mirror src/theme.ts — update both if the palette changes. */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
input, select, button, textarea { font-family: inherit; }

/* Leaflet overrides */
.leaflet-container { background: #ffffff; font-family: 'Work Sans', sans-serif; }
.leaflet-control-attribution { font-size: 10px; background: rgba(255, 255, 255, .82) !important; color: #111111 !important; }
.leaflet-popup-content-wrapper { background: #ffffff; border: 1px solid #111111; border-radius: 0; padding: 0; overflow: hidden; }
.leaflet-popup-content { margin: 0; width: auto !important; }
.leaflet-popup-tip { background: #ffffff; border: 1px solid #111111; }
.leaflet-popup-close-button { color: #111111 !important; font-size: 20px !important; padding: 6px 8px 0 0 !important; }
.canton-tip { background: #111111; color: #ffffff; border: none; border-radius: 0; padding: 5px 10px; font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 12px; font-weight: 600; }
.canton-tip.leaflet-tooltip-top:before { border-top-color: #111111; }
.canton-tip.leaflet-tooltip-bottom:before { border-bottom-color: #111111; }

/* Custom scrollbar */
.sk-scroll::-webkit-scrollbar { width: 9px; }
.sk-scroll::-webkit-scrollbar-thumb { background: #111111; border-radius: 0; border: 2px solid #ffffff; }

/* Modal animations */
@keyframes popIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

New (full file):

```css
/* Hex/shape values below mirror src/theme.ts — update both if the palette or shape system changes. */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
input, select, button, textarea { font-family: inherit; }

/* Leaflet overrides */
.leaflet-container { background: #ffffff; font-family: 'Work Sans', sans-serif; }
.leaflet-control-attribution { font-size: 10px; background: rgba(255, 255, 255, .82) !important; color: #111111 !important; }
.leaflet-popup-content-wrapper { background: #ffffff; border: 1px solid #e2e2e2; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.12); padding: 0; overflow: hidden; }
.leaflet-popup-content { margin: 0; width: auto !important; }
.leaflet-popup-tip { background: #ffffff; border: 1px solid #e2e2e2; }
.leaflet-popup-close-button { color: #111111 !important; font-size: 20px !important; padding: 6px 8px 0 0 !important; }
.canton-tip { background: #111111; color: #ffffff; border: none; border-radius: 10px; padding: 5px 10px; font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 12px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
.canton-tip.leaflet-tooltip-top:before { border-top-color: #111111; }
.canton-tip.leaflet-tooltip-bottom:before { border-bottom-color: #111111; }

/* Custom scrollbar */
.sk-scroll::-webkit-scrollbar { width: 9px; }
.sk-scroll::-webkit-scrollbar-thumb { background: #111111; border-radius: 999px; border: 2px solid #ffffff; }

/* Modal animations */
@keyframes popIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 2: Run the full test suite and lint**

Run: `npm run test && npm run lint`
Expected: PASS (no test touches this file)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: round Leaflet chrome, add shadows, pill scrollbar thumb"
```

---

### Task 3: Topbar — white header, no logo tile, pill controls

**Files:**
- Modify: `src/components/Topbar.tsx`
- Test: `src/components/Topbar.test.tsx` (existing — asserts only that `/SCHWINGKELLER/` text and the login button render; unaffected by color/shape changes, run as regression check)

**Interfaces:**
- Consumes: `theme.radius.sm`, `theme.radius.pill`, `theme.shadow` (new); `theme` import path unchanged (`../theme`).

- [ ] **Step 1: Replace `langStyle`**

Old (lines 16-25):

```ts
const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  lineHeight: '1',
  padding: '6px 8px',
  borderRadius: theme.radius,
});
```

New:

```ts
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
```

- [ ] **Step 2: Replace the admin pill**

Old (lines 46-59):

```tsx
  const adminPill = isAdmin && (
    <div
      title={t.adminMode}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 'none',
        background: theme.color.accent, color: theme.color.accentInk, fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 12px',
        borderRadius: theme.radius, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: theme.color.accentInk, flex: 'none' }}></span>
      {isMobile ? 'Admin' : t.adminMode}
    </div>
  );
```

New:

```tsx
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
```

- [ ] **Step 3: Replace the bar container, hamburger, logo tile, and wordmark**

Old (lines 61-113):

```tsx
  return (
    <div
      style={{
        height: '60px', flex: 'none', background: theme.color.ink,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '3px solid ' + theme.color.accent, position: 'relative', zIndex: 1100,
      }}
    >
      {showHamburger && (
        <button
          onClick={onToggleSidebar}
          aria-label="Menu"
          style={{
            border: 'none', background: 'rgba(255,255,255,.09)', color: theme.color.bg,
            width: '38px', height: '38px', borderRadius: theme.radius, cursor: 'pointer',
            fontSize: '17px', flex: 'none',
          }}
        >
          ☰
        </button>
      )}
      <div
        style={{
          width: '32px', height: '32px', borderRadius: theme.radius, background: theme.color.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk,
          fontSize: '19px', flex: 'none',
        }}
      >
        S
      </div>
      {/* Wordmark + tagline — hidden on mobile to keep the bar from overflowing. */}
      {!isMobile && (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: theme.font.display, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: theme.color.bg, fontSize: '15px', lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            SCHWINGKELLER <span style={{ color: theme.color.accent }}>SCHWEIZ</span>
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
```

New (drops the logo tile entirely; wordmark is a single-color red line, no two-tone split; bar is white with a thin red border):

```tsx
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
```

- [ ] **Step 4: Replace the mobile language trigger button and popover**

Old (lines 124-172):

```tsx
      {isMobile ? (
        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            onClick={() => setLangMenuOpen((o) => !o)}
            aria-label="Sprache / langue / lingua"
            aria-expanded={langMenuOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,.07)',
              border: 'none', borderRadius: theme.radius, padding: '6px 8px', cursor: 'pointer',
              fontSize: '15px', lineHeight: 1, color: theme.color.bg,
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
                  background: theme.color.ink, border: '1px solid ' + theme.color.bg, borderRadius: theme.radius,
                  padding: '4px', minWidth: '92px',
                }}
              >
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setLangMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      background: l === lang ? theme.color.accent : 'transparent', border: 'none',
                      color: theme.color.bg, fontSize: '13px', fontWeight: 600, padding: '8px 10px',
                      borderRadius: theme.radius, cursor: 'pointer', textAlign: 'left',
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
```

New (trigger becomes a light pill; popover flips from a black card to a white card with hairline border + shadow, matching the rest of the app's card system):

```tsx
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
```

Note: the inactive menu-item text color also changes from `theme.color.bg` (white, for a black popover) to `theme.color.ink` (black, for the new white popover) — necessary for readability, not just a radius change.

- [ ] **Step 5: Replace the desktop language switcher wrapper**

Old (lines 175-185):

```tsx
        <div
          style={{
            display: 'flex', gap: '2px', background: 'rgba(255,255,255,.07)',
            padding: '4px', borderRadius: theme.radius, flex: 'none',
          }}
        >
          <button onClick={() => setLang('de')} aria-label="Deutsch" style={langStyle(lang === 'de')}>🇩🇪</button>
          <button onClick={() => setLang('fr')} aria-label="Français" style={langStyle(lang === 'fr')}>🇫🇷</button>
          <button onClick={() => setLang('it')} aria-label="Italiano" style={langStyle(lang === 'it')}>🇮🇹</button>
        </div>
```

New:

```tsx
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
```

- [ ] **Step 6: Replace the logout and login buttons**

Old (lines 187-221):

```tsx
      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.bg, background: 'transparent',
            border: '1.5px solid ' + theme.color.bg, borderRadius: theme.radius, cursor: 'pointer', flex: 'none',
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
            border: 'none', borderRadius: theme.radius, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '8px 14px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{lockIcon}</span>
          {!isMobile && t.login}
        </button>
      )}
```

New (logout's border/text flips from white-on-black to a dark hairline on white; both buttons become pill-shaped, matching the design's "login button and admin badge are action chips" rule):

```tsx
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
```

- [ ] **Step 7: Run tests and lint**

Run: `npx vitest run src/components/Topbar.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/Topbar.tsx
git commit -m "style: white header, drop logo tile, pill controls (soft restyle)"
```

---

### Task 4: Shared Modal shell — rounded card with shadow

**Files:**
- Modify: `src/components/Modal.tsx`

**Interfaces:**
- Consumes: `theme.radius.sm`, `theme.shadow` (new); `theme.color.line` (now light gray, automatic).

- [ ] **Step 1: Replace the whole file**

Old (full file):

```tsx
import type { ReactNode } from 'react';
import { theme } from '../theme';

interface ModalProps { onClose: () => void; width?: number; children: ReactNode; zIndex?: number }

export const Modal = ({ onClose, width = 440, children, zIndex = 1300 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'fadeIn .2s ease',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="sk-scroll"
      style={{
        background: theme.color.bg, border: '2px solid ' + theme.color.line, borderRadius: theme.radius,
        width, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', animation: 'popIn .26s ease',
      }}
    >
      {children}
    </div>
  </div>
);
```

New (full file):

```tsx
import type { ReactNode } from 'react';
import { theme } from '../theme';

interface ModalProps { onClose: () => void; width?: number; children: ReactNode; zIndex?: number }

export const Modal = ({ onClose, width = 440, children, zIndex = 1300 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'fadeIn .2s ease',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="sk-scroll"
      style={{
        background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', animation: 'popIn .26s ease',
      }}
    >
      {children}
    </div>
  </div>
);
```

Note: border weight drops from `2px` to `1px` since it's now a hairline gray line rather than a bold black one, with the shadow doing the visual separation work instead.

- [ ] **Step 2: Run the tests that render through Modal**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx src/features/venue-edit/EditForm.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "style: round shared Modal shell, add shadow, lighten border"
```

---

### Task 5: Sidebar — title block, rounded search box, pill count badges

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx`
- Modify: `src/i18n/translations.ts` (new `searchTitle` key, all three languages)
- Test: `src/features/sidebar/Sidebar.test.tsx` (existing, regression check — confirmed it does not assert on the new title block or on absence of any specific text this task adds)

**Interfaces:**
- Consumes: `theme.radius.sm`, `theme.radius.pill`, `theme.shadow` (new). Reuses the existing `totalText` variable (`${list.length} ${t.unitTotal}`, already computed at line 102) for the new count pill — no new count-formatting logic needed.
- Produces: new i18n key `t.searchTitle`, consumed only by this file.

- [ ] **Step 1: Add the new i18n key to all three languages**

In `src/i18n/translations.ts`, add `searchTitle` to each language block, directly after the existing `search` key (so the key ordering documents that it's a variant of the same concept — a bold heading vs. the input's placeholder):

DE — old (line 7):

```ts
    search: 'Schwingkeller suchen …',
```

DE — new:

```ts
    search: 'Schwingkeller suchen …',
    searchTitle: 'Schwingkeller suchen',
```

FR — old (line 72):

```ts
    search: 'Rechercher un lieu …',
```

FR — new:

```ts
    search: 'Rechercher un lieu …',
    searchTitle: 'Rechercher un lieu',
```

IT — old (line 137):

```ts
    search: 'Cerca una sede …',
```

IT — new:

```ts
    search: 'Cerca una sede …',
    searchTitle: 'Cerca una sede',
```

- [ ] **Step 2: Run the translations test to verify the new key is balanced across languages**

Run: `npx vitest run src/i18n/translations.test.ts`
Expected: PASS (the "all languages share the same keys" test passes since the key was added to all three)

- [ ] **Step 3: Add the theme import is already present; replace `exportBtnStyle` and `rowStyle`**

Old (lines 44-71):

```ts
const exportBtnStyle: CSSProperties = {
  flex: 1,
  border: '1px solid ' + theme.color.line,
  background: theme.color.bg,
  color: theme.color.ink,
  fontWeight: 600,
  fontSize: '11.5px',
  padding: '8px 6px',
  borderRadius: theme.radius,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
};

const rowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '9px 10px 9px 12px',
  margin: '3px 0',
  borderRadius: theme.radius,
  cursor: 'pointer',
  borderLeft: sel ? '2px solid ' + theme.color.accent : '2px solid ' + theme.color.line,
  background: sel ? theme.color.paper : 'transparent',
});
```

New:

```ts
const exportBtnStyle: CSSProperties = {
  flex: 1,
  border: '1px solid ' + theme.color.line,
  background: theme.color.bg,
  color: theme.color.ink,
  fontWeight: 600,
  fontSize: '11.5px',
  padding: '8px 6px',
  borderRadius: theme.radius.sm,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
};

const rowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '9px 10px 9px 12px',
  margin: '3px 0',
  borderRadius: theme.radius.sm,
  cursor: 'pointer',
  borderLeft: sel ? '2px solid ' + theme.color.accent : '2px solid ' + theme.color.line,
  background: sel ? theme.color.paper : 'transparent',
});
```

- [ ] **Step 4: Replace the mobile/desktop container styles and drag handle**

Old (lines 104-134):

```tsx
  const sidebarStyle: CSSProperties = isMobile
    ? {
        ...sbBase,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: sidebarOpen ? '80vh' : '108px',
        zIndex: 1200,
        borderTop: '1px solid ' + theme.color.line,
        borderRadius: theme.radius,
        transition: 'height .32s cubic-bezier(.4,0,.2,1)',
      }
    : { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid ' + theme.color.line };

  return (
    <div style={sidebarStyle}>
      {isMobile && (
        <div
          onClick={onToggleSidebar}
          style={{
            padding: '9px 0 5px',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <div style={{ width: '44px', height: '5px', borderRadius: theme.radius, background: theme.color.ink }} />
        </div>
      )}
```

New (the mobile drawer gets top-only rounded corners and a lifting shadow, matching the reference's bottom-sheet card; the drag handle stays a small pill):

```tsx
  const sidebarStyle: CSSProperties = isMobile
    ? {
        ...sbBase,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: sidebarOpen ? '80vh' : '108px',
        zIndex: 1200,
        borderTop: '1px solid ' + theme.color.line,
        borderRadius: theme.radius.sm + ' ' + theme.radius.sm + ' 0 0',
        boxShadow: theme.shadow,
        transition: 'height .32s cubic-bezier(.4,0,.2,1)',
      }
    : { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid ' + theme.color.line };

  return (
    <div style={sidebarStyle}>
      {isMobile && (
        <div
          onClick={onToggleSidebar}
          style={{
            padding: '9px 0 5px',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <div style={{ width: '44px', height: '5px', borderRadius: theme.radius.pill, background: theme.color.ink }} />
        </div>
      )}
```

- [ ] **Step 5: Insert the new title block, right before the search box**

Old (lines 137-148, the start of the search-box padding wrapper):

```tsx
      <div style={{ padding: '15px 15px 11px', flex: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: theme.color.bg,
            border: '1px solid ' + theme.color.line,
            borderRadius: theme.radius,
            padding: '11px 16px',
          }}
        >
```

New (adds the black title block above the search-box wrapper; search box radius becomes `theme.radius.sm`):

```tsx
      <div
        style={{
          background: theme.color.ink, padding: '18px 15px', display: 'flex',
          flexDirection: 'column', gap: '10px', flex: 'none',
        }}
      >
        <span
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700,
            color: theme.color.bg, fontSize: '19px', lineHeight: 1.15,
          }}
        >
          {t.searchTitle}
        </span>
        <span
          style={{
            display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.accent,
            color: theme.color.accentInk, fontFamily: theme.font.display, textTransform: 'uppercase',
            fontWeight: 700, fontSize: '12px', padding: '6px 14px', borderRadius: theme.radius.pill,
          }}
        >
          {totalText}
        </span>
      </div>

      <div style={{ padding: '15px 15px 11px', flex: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: theme.color.bg,
            border: '1px solid ' + theme.color.line,
            borderRadius: theme.radius.sm,
            padding: '11px 16px',
          }}
        >
```

- [ ] **Step 6: Replace the admin "add" button's radius**

Old (lines 200-220, only the `borderRadius` line changes):

```tsx
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              border: 'none',
              background: theme.color.accent,
              color: theme.color.accentInk,
              fontWeight: 600,
              fontSize: '13px',
              padding: '10px',
              borderRadius: theme.radius,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
```

New:

```tsx
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              border: 'none',
              background: theme.color.accent,
              color: theme.color.accentInk,
              fontWeight: 600,
              fontSize: '13px',
              padding: '10px',
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
```

- [ ] **Step 7: Replace the canton-group count badge's radius**

Old (lines 308-319):

```tsx
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: theme.color.accentInk,
                    background: theme.color.ink,
                    padding: '2px 9px',
                    borderRadius: theme.radius,
                  }}
                >
                  {group.count}
                </span>
```

New (this is a count pill too — pill radius):

```tsx
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: theme.color.accentInk,
                    background: theme.color.ink,
                    padding: '2px 9px',
                    borderRadius: theme.radius.pill,
                  }}
                >
                  {group.count}
                </span>
```

- [ ] **Step 8: Run tests and lint**

Run: `npx vitest run src/features/sidebar/Sidebar.test.tsx src/i18n/translations.test.ts && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/i18n/translations.ts
git commit -m "feat: add Sidebar title block, round search box and badges"
```

---

### Task 6: LoginModal — rounded card, dropped logo tile

**Files:**
- Modify: `src/features/auth/LoginModal.tsx`

**Interfaces:**
- Consumes: `theme.radius.sm`, `theme.shadow` (new).

- [ ] **Step 1: Replace `inputStyle`**

Old (lines 10-13):

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
```

New:

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
```

- [ ] **Step 2: Replace the panel and header, dropping the logo tile**

Old (lines 54-80):

```tsx
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.color.bg, border: '2px solid ' + theme.color.line, borderRadius: theme.radius,
          width: '360px', maxWidth: '100%', animation: 'popIn .26s ease', overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: theme.color.ink, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '11px',
          }}
        >
          <div
            style={{
              width: '30px', height: '30px', borderRadius: theme.radius, background: theme.color.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk, fontSize: '17px',
            }}
          >
            S
          </div>
          <span style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '16px', fontWeight: 700, color: theme.color.bg }}>
            {t.loginTitle}
          </span>
        </div>
```

New (drops the "S" tile, same as Topbar; panel gets `radius.sm` + shadow + a hairline border instead of a bold one):

```tsx
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
          boxShadow: theme.shadow, width: '360px', maxWidth: '100%', animation: 'popIn .26s ease', overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: theme.color.ink, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '11px',
          }}
        >
          <span style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '16px', fontWeight: 700, color: theme.color.bg }}>
            {t.loginTitle}
          </span>
        </div>
```

- [ ] **Step 3: Replace the cancel and login buttons' radius**

Old (lines 103-123):

```tsx
          <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => { void doLogin(); }}
              disabled={busy}
              style={{
                flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                fontWeight: 700, fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
              }}
            >
              {t.login}
            </button>
          </div>
```

New:

```tsx
          <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => { void doLogin(); }}
              disabled={busy}
              style={{
                flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                fontWeight: 700, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
              }}
            >
              {t.login}
            </button>
          </div>
```

- [ ] **Step 4: Run tests and lint**

Run: `npm run test && npm run lint`
Expected: PASS (no dedicated LoginModal test file; full suite is the regression check)

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/LoginModal.tsx
git commit -m "style: round LoginModal card, drop logo tile (soft restyle)"
```

---

### Task 7: DetailModal — rounded cards, tags, and buttons

**Files:**
- Modify: `src/features/venue-detail/DetailModal.tsx`
- Test: `src/features/venue-detail/DetailModal.test.tsx` (existing, regression check)

**Interfaces:**
- Consumes: `theme.radius.sm` (new). No shadow needed here — this content sits inside the already-shadowed `Modal` shell from Task 4, so adding a second shadow on inner elements would double up.

- [ ] **Step 1: Replace the top-level style constants**

Old (lines 16-31):

```ts
const contactIcon: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: theme.radius, background: theme.color.paper,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
  color: theme.color.ink, flex: 'none',
};
const contactLabel: React.CSSProperties = {
  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: theme.color.muted,
};
const contactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0', textDecoration: 'none',
};
const tag: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: theme.color.ink, background: theme.color.paper,
  border: '1px solid ' + theme.color.line, padding: '6px 12px', borderRadius: theme.radius,
  display: 'flex', alignItems: 'center', gap: '6px',
};
```

New:

```ts
const contactIcon: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: theme.radius.sm, background: theme.color.paper,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
  color: theme.color.ink, flex: 'none',
};
const contactLabel: React.CSSProperties = {
  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: theme.color.muted,
};
const contactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0', textDecoration: 'none',
};
const tag: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: theme.color.ink, background: theme.color.paper,
  border: '1px solid ' + theme.color.line, padding: '6px 12px', borderRadius: theme.radius.pill,
  display: 'flex', alignItems: 'center', gap: '6px',
};
```

Note: `tag` (the indoor/outdoor pills) becomes `theme.radius.pill`, not `sm` — these are small status chips, matching the same convention as the count badges.

- [ ] **Step 2: Replace the close button's radius (unchanged — confirm it stays `50%`)**

No change needed to the close button (`borderRadius: '50%'` at line 88 stays a circle, unrelated to `theme.radius`). Skip — included here only so the implementer doesn't mistakenly "fix" it.

- [ ] **Step 3: Replace the navigate/edit/delete buttons' radius**

Old (lines 151-184):

```tsx
        <button
          onClick={onNavigate}
          style={{
            marginTop: '16px', width: '100%', border: 'none', cursor: 'pointer',
            background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px',
            padding: '13px', borderRadius: theme.radius, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}
        >
          {t.navigate} ↗
        </button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={onEdit}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius,
                cursor: 'pointer',
              }}
            >
              {t.edit}
            </button>
            <button
              onClick={onDelete}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.accent, background: theme.color.bg, color: theme.color.accent,
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius,
                cursor: 'pointer',
              }}
            >
              {t.delete}
            </button>
          </div>
        )}
```

New:

```tsx
        <button
          onClick={onNavigate}
          style={{
            marginTop: '16px', width: '100%', border: 'none', cursor: 'pointer',
            background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px',
            padding: '13px', borderRadius: theme.radius.sm, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}
        >
          {t.navigate} ↗
        </button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={onEdit}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm,
                cursor: 'pointer',
              }}
            >
              {t.edit}
            </button>
            <button
              onClick={onDelete}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.accent, background: theme.color.bg, color: theme.color.accent,
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm,
                cursor: 'pointer',
              }}
            >
              {t.delete}
            </button>
          </div>
        )}
```

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-detail/DetailModal.tsx
git commit -m "style: round DetailModal tags and buttons (soft restyle)"
```

---

### Task 8: EditForm — rounded inputs, dropzone, and buttons

**Files:**
- Modify: `src/features/venue-edit/EditForm.tsx`
- Test: `src/features/venue-edit/EditForm.test.tsx` (existing, regression check)

**Interfaces:**
- Consumes: `theme.radius.sm` (new). Same "no extra shadow on inner content" reasoning as Task 7 — this form renders inside the already-shadowed `Modal` shell.

- [ ] **Step 1: Replace `inputStyle`, `spOn`, `spOff`**

Old (lines 41-56):

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};
const spOn: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: theme.radius, border: '1.5px solid ' + theme.color.accent, background: theme.color.accent, color: theme.color.accentInk,
};
const spOff: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: theme.radius, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.muted,
};
```

New:

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};
const spOn: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.accent, background: theme.color.accent, color: theme.color.accentInk,
};
const spOff: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.muted,
};
```

- [ ] **Step 2: Replace the photo-upload dropzone's radius**

Old (lines 186-190):

```tsx
        <label
          style={{
            display: 'block', height: '128px', overflow: 'hidden', cursor: 'pointer',
            border: '1.5px dashed ' + theme.color.line, position: 'relative', marginBottom: '16px',
          }}
        >
```

New:

```tsx
        <label
          style={{
            display: 'block', height: '128px', overflow: 'hidden', cursor: 'pointer', borderRadius: theme.radius.sm,
            border: '1.5px dashed ' + theme.color.line, position: 'relative', marginBottom: '16px',
          }}
        >
```

- [ ] **Step 3: Replace the coordinate readout box and pick-on-map button radius**

Old (lines 266-284):

```tsx
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1, background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius,
              padding: '11px 13px', fontSize: '13px', color: theme.color.ink, fontFamily: 'monospace',
            }}
          >
            {editingCoords}
          </div>
          <button
            onClick={onStartPlacing}
            style={{
              border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink, fontWeight: 600,
              fontSize: '13px', padding: '11px 14px', borderRadius: theme.radius, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⌖ {t.pickOnMap}
          </button>
        </div>
```

New:

```tsx
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1, background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
              padding: '11px 13px', fontSize: '13px', color: theme.color.ink, fontFamily: 'monospace',
            }}
          >
            {editingCoords}
          </div>
          <button
            onClick={onStartPlacing}
            style={{
              border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink, fontWeight: 600,
              fontSize: '13px', padding: '11px 14px', borderRadius: theme.radius.sm, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⌖ {t.pickOnMap}
          </button>
        </div>
```

- [ ] **Step 4: Replace the sticky footer buttons' radius**

Old (lines 317-347):

```tsx
        <button
          onClick={() => { void save(false); }}
          disabled={saving}
          style={{
            width: '100%', border: 'none', background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600,
            fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
          }}
        >
          {t.saveClose}
        </button>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius, cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>
          <button
            onClick={() => { void save(true); }}
            disabled={saving}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius, cursor: 'pointer',
            }}
          >
            {t.saveNew}
          </button>
        </div>
```

New:

```tsx
        <button
          onClick={() => { void save(false); }}
          disabled={saving}
          style={{
            width: '100%', border: 'none', background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600,
            fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
          }}
        >
          {t.saveClose}
        </button>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>
          <button
            onClick={() => { void save(true); }}
            disabled={saving}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.saveNew}
          </button>
        </div>
```

- [ ] **Step 5: Run tests and lint**

Run: `npx vitest run src/features/venue-edit/EditForm.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/venue-edit/EditForm.tsx
git commit -m "style: round EditForm inputs, dropzone, and buttons (soft restyle)"
```

---

### Task 9: MapView — rounded/shadowed controls, native radio base/satellite switcher, circular pin geometry

**Files:**
- Modify: `src/features/map/MapView.tsx`

**Interfaces:**
- Consumes: `theme.radius.sm`, `theme.shadow` (new).
- Produces: new marker icon geometry constants that Task 10 (markers.ts) must render into — `iconSize: [28, 28]`, `iconAnchor: [14, 14]`, `popupAnchor: [0, -20]` (was `[32, 40]` / `[16, 40]` / `[0, -36]`, sized for the old teardrop shape). Both `refreshMarkers` and `updatePins` construct a `L.divIcon` with these three options — both call sites in this file must use the new numbers.

- [ ] **Step 1: Replace `toggleWrapStyle`, `fitAllBtnStyle`, `layerBtnStyle` with the new radio-card styles**

Old (lines 36-49):

```ts
const toggleWrapStyle: CSSProperties = {
  display: 'flex', background: theme.color.bg, border: '1px solid ' + theme.color.line,
  borderRadius: theme.radius, overflow: 'hidden',
};
const fitAllBtnStyle: CSSProperties = {
  width: '38px', height: '38px', border: '1px solid ' + theme.color.line, background: theme.color.bg,
  color: theme.color.ink, borderRadius: theme.radius, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const layerBtnStyle = (active: boolean): CSSProperties => ({
  border: 'none', cursor: 'pointer', fontFamily: theme.font.body, fontSize: '12px',
  fontWeight: 600, padding: '7px 13px',
  background: active ? theme.color.accent : 'transparent', color: active ? theme.color.accentInk : theme.color.ink,
});
```

New (the segmented-button pair is replaced by a native-radio card; `toggleWrapStyle`/`layerBtnStyle` are renamed and restructured accordingly — `layerCardStyle` is the outer card, `radioRowStyle`/`radioInputStyle` style each option):

```ts
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
```

- [ ] **Step 2: Replace the base/satellite JSX with native radio buttons**

Old (lines 283-287):

```tsx
        <div style={toggleWrapStyle}>
          <button onClick={() => onChangeBase('map')} style={layerBtnStyle(baseKind === 'map')}>{t.mapView}</button>
          <button onClick={() => onChangeBase('sat')} style={layerBtnStyle(baseKind === 'sat')}>{t.satView}</button>
        </div>
```

New:

```tsx
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
```

- [ ] **Step 3: Update the marker icon geometry in `refreshMarkers`**

Old (line 118):

```ts
      const icon = L.divIcon({ className: '', html: pinHtml(v.id === selectedIdRef.current), iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36] });
```

New:

```ts
      const icon = L.divIcon({ className: '', html: pinHtml(v.id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] });
```

- [ ] **Step 4: Update the marker icon geometry in `updatePins`**

Old (line 128):

```ts
      markersRef.current[id].setIcon(L.divIcon({ className: '', html: pinHtml(id === selectedIdRef.current), iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36] }));
```

New:

```ts
      markersRef.current[id].setIcon(L.divIcon({ className: '', html: pinHtml(id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] }));
```

- [ ] **Step 5: Run lint and the full test suite (no dedicated MapView test file)**

Run: `npm run test && npm run lint`
Expected: PASS. `npm run typecheck` will still fail at this point if Task 10 hasn't landed yet, since `markers.ts`'s `pinHtml` (Task 10) is a separate file — that's expected; Task 10 is next.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/MapView.tsx
git commit -m "feat: replace map layer toggle with native radio card, resize pin icon geometry"
```

---

### Task 10: markers.ts — circular pins, shadowed popups and clusters

**Files:**
- Modify: `src/features/map/markers.ts`
- Test: `src/features/map/markers.test.ts` (existing — asserts `pinHtml(true)` differs from `pinHtml(false)`; this assertion was ALREADY changed to `.toBe(...)` (identical) in the prior restyle, since pin color no longer varies by selection. This task changes the pin's shape, not its selection behavior, so no further test change is needed — confirm the existing `.toBe` assertion still holds.)

**Interfaces:**
- Consumes: `theme.color.accent`, `theme.color.bg`, `theme.shadow` (new). Consumes the marker icon geometry decided in Task 9 (`iconSize: [28, 28]`, center-anchored) — this task's pin markup must visually fit a 28×28 box since that's what `MapView.tsx` now sizes the `divIcon` to.

- [ ] **Step 1: Replace `pinHtml` — teardrop to plain circle**

Old (lines 8-13):

```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pinHtml = (_sel: boolean): string =>
  '<div style="position:relative;width:32px;height:40px;">'
  + '<div style="position:absolute;left:1px;top:0;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';"></div>'
  + '<div style="position:absolute;left:11px;top:9px;width:10px;height:10px;border-radius:50%;background:' + theme.color.bg + ';border:2px solid ' + theme.color.accent + ';"></div>'
  + '</div>';
```

New (a plain 28×28 circle — red fill, white ring, white center dot, with a soft shadow to read as "raised" above the map, matching the reference's pin style):

```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pinHtml = (_sel: boolean): string =>
  '<div style="position:relative;width:28px;height:28px;">'
  + '<div style="position:absolute;inset:0;border-radius:50%;background:' + theme.color.accent + ';border:3px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';"></div>'
  + '<div style="position:absolute;left:9px;top:9px;width:10px;height:10px;border-radius:50%;background:' + theme.color.bg + ';"></div>'
  + '</div>';
```

- [ ] **Step 2: Replace `popupHtml` — rounded/shadowed tag chips and details button**

Old (lines 15-25):

```ts
export const popupHtml = (v: Venue, t: T): string => {
  const c = cantonByCode(v.canton);
  const photo = v.photo_url ? '<div style="height:104px;background:url(' + v.photo_url + ') center/cover;"></div>' : '<div style="height:104px;background:repeating-linear-gradient(45deg,#e5e5e5 0 9px,#d4d4d4 9px 18px);display:flex;align-items:center;justify-content:center;"><span style="font-family:monospace;font-size:10px;letter-spacing:.1em;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';padding:3px 7px;">FOTO</span></div>';
  return '<div style="width:222px;font-family:Work Sans,sans-serif;">' + photo
    + '<div style="padding:11px 13px 13px;">'
    + '<div style="display:flex;align-items:center;gap:7px;">' + (c ? '<img src="' + wappenUrl(c.code) + '" style="width:15px;height:19px;object-fit:contain;">' : '') + '<span style="font-family:Oswald,sans-serif;text-transform:uppercase;font-weight:700;font-size:14.5px;color:' + theme.color.ink + ';line-height:1.2;">' + v.name + '</span></div>'
    + '<div style="font-size:11.5px;color:' + theme.color.muted + ';margin-top:3px;">' + v.address + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:9px;">' + (v.indoor ? '<span style="font-size:10.5px;font-weight:600;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';padding:3px 8px;">⌂ ' + t.indoor + '</span>' : '') + (v.outdoor ? '<span style="font-size:10.5px;font-weight:600;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';padding:3px 8px;">⛰ ' + t.outdoor + '</span>' : '') + '</div>'
    + '<button data-detail="' + v.id + '" style="margin-top:11px;width:100%;border:none;cursor:pointer;background:' + theme.color.accent + ';color:' + theme.color.accentInk + ';font-family:Work Sans;font-weight:600;font-size:12.5px;padding:9px;">' + t.details + ' →</button>'
    + '</div></div>';
};
```

New (indoor/outdoor tags and the FOTO placeholder label become pill-shaped chips; the details button gets `radius.sm`; the popup card itself already gets rounded corners + shadow from `index.css`'s `.leaflet-popup-content-wrapper`, Task 2, so nothing changes on the outer wrapper here):

```ts
export const popupHtml = (v: Venue, t: T): string => {
  const c = cantonByCode(v.canton);
  const photo = v.photo_url ? '<div style="height:104px;background:url(' + v.photo_url + ') center/cover;"></div>' : '<div style="height:104px;background:repeating-linear-gradient(45deg,#e5e5e5 0 9px,#d4d4d4 9px 18px);display:flex;align-items:center;justify-content:center;"><span style="font-family:monospace;font-size:10px;letter-spacing:.1em;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';border-radius:999px;padding:3px 7px;">FOTO</span></div>';
  return '<div style="width:222px;font-family:Work Sans,sans-serif;">' + photo
    + '<div style="padding:11px 13px 13px;">'
    + '<div style="display:flex;align-items:center;gap:7px;">' + (c ? '<img src="' + wappenUrl(c.code) + '" style="width:15px;height:19px;object-fit:contain;">' : '') + '<span style="font-family:Oswald,sans-serif;text-transform:uppercase;font-weight:700;font-size:14.5px;color:' + theme.color.ink + ';line-height:1.2;">' + v.name + '</span></div>'
    + '<div style="font-size:11.5px;color:' + theme.color.muted + ';margin-top:3px;">' + v.address + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:9px;">' + (v.indoor ? '<span style="font-size:10.5px;font-weight:600;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';border-radius:999px;padding:3px 8px;">⌂ ' + t.indoor + '</span>' : '') + (v.outdoor ? '<span style="font-size:10.5px;font-weight:600;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';border-radius:999px;padding:3px 8px;">⛰ ' + t.outdoor + '</span>' : '') + '</div>'
    + '<button data-detail="' + v.id + '" style="margin-top:11px;width:100%;border:none;cursor:pointer;background:' + theme.color.accent + ';color:' + theme.color.accentInk + ';font-family:Work Sans;font-weight:600;font-size:12.5px;padding:9px;border-radius:10px;">' + t.details + ' →</button>'
    + '</div></div>';
};
```

- [ ] **Step 3: Replace `clusterIcon` — add shadow**

Old (lines 27-32):

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
```

New:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
```

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/features/map/markers.test.ts && npm run lint`
Expected: PASS (2/2 tests — `pinHtml(true)` still equals `pinHtml(false)` since selection never affected color, only shape changed, and `popupHtml` still contains the venue name and `data-detail` hook)

- [ ] **Step 5: Commit**

```bash
git add src/features/map/markers.ts
git commit -m "style: circular map pins, pill tag chips, shadowed cluster bubble"
```

---

### Task 11: App shell — rounded dialogs, shadowed banner and toast

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `theme.radius.sm`, `theme.shadow` (new). This is the last source file in the restyle.

- [ ] **Step 1: Replace the placing banner's radius and add a shadow**

Old (lines 311-330):

```tsx
        <div
          style={{
            position: 'fixed', top: '74px', left: '50%', transform: 'translateX(-50%)', zIndex: 1700,
            background: theme.color.ink, color: theme.color.bg, padding: '12px 16px', borderRadius: theme.radius,
            display: 'flex', gap: '14px', alignItems: 'center',
            maxWidth: 'calc(100% - 32px)', animation: 'popIn .24s ease',
          }}
        >
          <span style={{ fontSize: '13px' }}>⌖ {t.pickHint}</span>
          <button
            onClick={cancelPlacing}
            style={{
              border: '1px solid ' + theme.color.bg, background: 'transparent', color: theme.color.bg, fontWeight: 600,
              fontSize: '12.5px', padding: '6px 12px', borderRadius: theme.radius, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t.cancel}
          </button>
        </div>
```

New:

```tsx
        <div
          style={{
            position: 'fixed', top: '74px', left: '50%', transform: 'translateX(-50%)', zIndex: 1700,
            background: theme.color.ink, color: theme.color.bg, padding: '12px 16px', borderRadius: theme.radius.sm,
            boxShadow: theme.shadow, display: 'flex', gap: '14px', alignItems: 'center',
            maxWidth: 'calc(100% - 32px)', animation: 'popIn .24s ease',
          }}
        >
          <span style={{ fontSize: '13px' }}>⌖ {t.pickHint}</span>
          <button
            onClick={cancelPlacing}
            style={{
              border: '1px solid ' + theme.color.bg, background: 'transparent', color: theme.color.bg, fontWeight: 600,
              fontSize: '12.5px', padding: '6px 12px', borderRadius: theme.radius.sm, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t.cancel}
          </button>
        </div>
```

- [ ] **Step 2: Replace the delete-confirm dialog's button radius**

Old (lines 343-361):

```tsx
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelDelete}
                style={{
                  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void confirmDelete(); }}
                style={{
                  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
                }}
              >
                {t.confirmDelete}
              </button>
            </div>
```

New:

```tsx
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelDelete}
                style={{
                  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void confirmDelete(); }}
                style={{
                  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.confirmDelete}
              </button>
            </div>
```

- [ ] **Step 3: Replace the import-confirm dialog's info boxes and button radius**

Old (lines 377-406):

```tsx
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ flex: 1, background: theme.color.paper, border: '1px solid ' + theme.color.line, padding: '9px 11px', color: theme.color.ink }}>
                <div style={{ opacity: 0.7 }}>{t.importExisting}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: theme.font.display }}>{venues.length}</div>
              </div>
              <div style={{ color: theme.color.accent, fontSize: '18px', flex: 'none' }}>→</div>
              <div style={{ flex: 1, background: theme.color.paper, border: '1px solid ' + theme.color.line, padding: '9px 11px', color: theme.color.ink }}>
                <div style={{ opacity: 0.7 }}>{t.import}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: theme.font.display }}>{pendingImport.count}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelImport}
                style={{
                  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void runImport(); }}
                style={{
                  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius, cursor: 'pointer',
                }}
              >
                {t.importReplace}
              </button>
            </div>
```

New:

```tsx
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ flex: 1, background: theme.color.paper, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '9px 11px', color: theme.color.ink }}>
                <div style={{ opacity: 0.7 }}>{t.importExisting}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: theme.font.display }}>{venues.length}</div>
              </div>
              <div style={{ color: theme.color.accent, fontSize: '18px', flex: 'none' }}>→</div>
              <div style={{ flex: 1, background: theme.color.paper, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '9px 11px', color: theme.color.ink }}>
                <div style={{ opacity: 0.7 }}>{t.import}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: theme.font.display }}>{pendingImport.count}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelImport}
                style={{
                  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void runImport(); }}
                style={{
                  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.importReplace}
              </button>
            </div>
```

- [ ] **Step 4: Replace the flash/toast's radius and add a shadow**

Old (lines 413-426):

```tsx
        <div
          role="status"
          style={{
            position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)', zIndex: 1800,
            background: flash.kind === 'ok' ? theme.color.ink : theme.color.accent, color: theme.color.bg,
            padding: '12px 18px', borderRadius: theme.radius,
            fontSize: '13.5px', fontWeight: 600, maxWidth: 'calc(100% - 32px)', textAlign: 'center',
            animation: 'popIn .24s ease',
          }}
        >
          {flash.text}
        </div>
```

New:

```tsx
        <div
          role="status"
          style={{
            position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)', zIndex: 1800,
            background: flash.kind === 'ok' ? theme.color.ink : theme.color.accent, color: theme.color.bg,
            padding: '12px 18px', borderRadius: theme.radius.sm, boxShadow: theme.shadow,
            fontSize: '13.5px', fontWeight: 600, maxWidth: 'calc(100% - 32px)', textAlign: 'center',
            animation: 'popIn .24s ease',
          }}
        >
          {flash.text}
        </div>
```

- [ ] **Step 5: Run the full verification chain — this is the last source file**

Run: `npm run test && npm run lint && npm run typecheck && npm run build`
Expected: ALL PASS. This is the point where every `theme.radius` bare reference across the whole codebase has been converted — `npm run typecheck` (and `npm run build`, which runs `tsc -b` first) will fail if any site was missed. If it fails, re-run `grep -rn "theme\.radius\b" src --include="*.ts" --include="*.tsx" | grep -v "theme\.radius\.sm\|theme\.radius\.pill"` to find the leftover site(s) and fix them before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "style: round App shell dialogs, shadow the placing banner and toast"
```

---

### Task 12: Manual verification + regenerate README screenshot

**Files:**
- Modify (replace binary): `docs/screenshot.png`
- No source changes — `README.md` already references `docs/screenshot.png`.

Same best-effort, environment-dependent posture as the prior restyle's screenshot task: try the full Docker Compose stack first, fall back to the plain dev server with a temporary placeholder `.env` if Docker can't pull images in this sandbox (this happened last time — the sandbox's network policy blocked Docker Hub image pulls with a 403).

- [ ] **Step 1: Manual visual pass in a running dev server**

```bash
npm run dev
```

Open the printed local URL and check: Topbar (white bg, red uppercase wordmark, no logo tile, pill language switcher and login button), Sidebar (black title block with red count pill, rounded search box), the map (rounded/shadowed base-satellite radio card, rounded fit-all button, circular red pins with a soft shadow, a popup with pill-shaped tags), and — if you can sign in — an admin view (rounded edit form, rounded delete-confirm dialog). Confirm: rounded corners and soft shadows on cards/modals/popups/floating controls, hairline light-gray borders (not black), red/black/white palette unchanged, Oswald headings in caps unchanged. Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 2: Try the primary path — full stack via Docker Compose**

```bash
which dockerd && (dockerd >/tmp/dockerd.log 2>&1 &) && sleep 4
docker compose up -d
```

Wait for readiness:

```bash
timeout 60 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 2; done'
```

If this succeeds, skip to Step 4. If `dockerd` fails to start, or image pulls are blocked (as they were for the prior restyle's screenshot task — a `403 Forbidden` from the registry CDN under this sandbox's network policy), or the stack doesn't come up within the timeout, tear down and go to Step 3:

```bash
docker compose down 2>/dev/null || true
```

- [ ] **Step 3: Fallback path — dev server with a placeholder `.env`**

The Supabase client (`src/lib/supabase.ts`) calls `createClient(url, key)` at module load — if `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are both `undefined` (no `.env` at all), `createClient` throws synchronously and crashes the whole app before React can render anything, producing a blank white screenshot. A syntactically-valid placeholder URL avoids that crash; the subsequent REST fetch still fails gracefully (`useVenues()` defaults to an empty array), so the app renders its full chrome with zero venues:

```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder_for_screenshot_only
EOF
nohup npm run dev > /tmp/vite-dev.log 2>&1 &
sleep 4
curl -sf -m 3 http://localhost:5173 >/dev/null && echo UP || (echo DOWN; cat /tmp/vite-dev.log)
```

- [ ] **Step 4: Capture the screenshot with the pre-installed Chromium**

`playwright` is not an npm dependency of this project — do not add it. The pre-installed Chromium at `/opt/pw-browsers/chromium` may not match the browser revision that `npx playwright@latest` expects (this happened last time — a `chrome-headless-shell` version mismatch), so drive it directly via `playwright-core` in a scratch directory instead of the `playwright` CLI:

```bash
mkdir -p /tmp/pw-scratch && cd /tmp/pw-scratch
npm init -y >/dev/null 2>&1
npm install playwright-core@1.49.0 --no-audit --no-fund
cat > screenshot.mjs << 'EOF'
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/home/user/schwingkeller/docs/screenshot.png' });
await browser.close();
console.log('screenshot saved');
EOF
node screenshot.mjs
cd /home/user/schwingkeller
```

- [ ] **Step 5: Tear down whichever stack you started, and remove the temporary `.env`**

```bash
docker compose down 2>/dev/null || true
pkill -f "vite --host" 2>/dev/null || true
rm -f /home/user/schwingkeller/.env
rm -rf /tmp/pw-scratch /tmp/vite-dev.log /tmp/dockerd.log
```

`.env` is already gitignored (confirmed: `.gitignore` lines 5-7 exclude `.env` and `.env.*`), so this is a cleanliness step, not a leak-prevention step — but do it anyway so a stray placeholder credential doesn't linger in the working tree.

- [ ] **Step 6: Confirm the screenshot and look at it**

```bash
file docs/screenshot.png
```

Expected: a valid, non-trivial PNG. Actually view the file (not just check its file-type/size) and confirm it shows the new rounded/shadowed red/black/white look — white header with red wordmark, black sidebar title block with a red count pill, rounded search box, circular map pins — not the previous restyle's flat black-bar/sharp-corner look. If Docker wasn't usable and you used the fallback path, the screenshot will show an empty venue list on the map — that's acceptable, same as last time.

- [ ] **Step 7: Commit**

```bash
git add docs/screenshot.png
git commit -m "docs: refresh README screenshot for the soft rounded-card restyle"
```

Do not push (see Global Constraints — push happens once, at the very end, after the final whole-branch review).

---

## Self-Review Notes

- **Spec coverage:** every item in the spec's "Component-by-Component Treatment" section has a task — theme tokens (Task 1), global CSS (Task 2), Topbar (Task 3), Modal (Task 4), Sidebar + new title block (Task 5), LoginModal (Task 6), DetailModal (Task 7), EditForm (Task 8), MapView incl. native radio switcher (Task 9), markers.ts incl. circular pins (Task 10), App.tsx (Task 11), screenshot (Task 12).
- **Placeholder scan:** no TBD/TODO; every step shows literal before/after code, including the new i18n key's exact three-language values.
- **Type consistency:** `theme.radius.sm`/`theme.radius.pill`/`theme.shadow` are referenced identically in every task; the marker icon geometry (`[28, 28]` / `[14, 14]` / `[0, -20]`) is decided once in Task 9 and consumed by Task 10's pin markup with matching dimensions (a 28×28 pin box matches a 28×28 `iconSize`).
- **Exhaustiveness check:** `grep -rn "theme\.radius\b" src` (46 sites across 9 files, confirmed against the actual post-prior-restyle codebase before writing this plan) matches exactly the sites this plan's tasks touch — no file left with a bare `theme.radius` reference after Task 11, which Step 5 of that task explicitly re-verifies via `npm run build`.
