# ESV.ch-Style Visual Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the whole app from its current warm parchment/brown/gold look to a flat, high-contrast red/black/white style inspired by esv.ch, per `docs/superpowers/specs/2026-07-07-esv-visual-restyle-design.md`.

**Architecture:** Introduce one shared `src/theme.ts` token module (colors, fonts, radius), then update every component's inline styles (this codebase has no CSS modules/Tailwind — all styling is inline `style={{}}` objects) to reference those tokens instead of hardcoded parchment/gold hex values. `index.css` and `markers.ts`'s raw-HTML strings can't `import` React style objects the same way but `markers.ts` (a `.ts` module) CAN import `theme` directly; only `index.css` needs literal hex values kept in sync by comment reference.

**Tech Stack:** React 19 + TypeScript + Vite, inline styles, Leaflet/react-leaflet, Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies (per CLAUDE.md) — `theme.ts` is a plain TS file, no SCSS/CSS-in-JS library added.
- No `any` in TypeScript.
- Radius is `0px` everywhere (`theme.radius`); no `boxShadow` anywhere — remove the property, don't set it to `'none'` if it can just be omitted (removing a `boxShadow: '...'` line is the way to satisfy "no shadows").
- Single accent color: Swiss red (`theme.color.accent`, `#e30613`) replaces **both** the previous gold accent and the previous green admin-badge/success color — there is no green left anywhere in the UI after this plan.
- `Bitter` (serif) is replaced by `Oswald` (bold condensed, all-caps) for headings/titles only; `Work Sans` stays the body font, unchanged.
- Every task in this plan is a pure visual change — no behavior, no new features, no i18n key changes. Confirmed via `Grep` that no existing test in this repo asserts on colors, inline style values, `border-radius`, or `box-shadow`, so `npm run test` is a regression safety net for every task, not a source of new failing tests to fix.
- Run `npm run lint` and `npm run test` after every task; both must pass before committing.

---

### Task 1: Shared theme tokens

**Files:**
- Create: `src/theme.ts`
- Test: `src/theme.test.ts`

**Interfaces:**
- Produces: `theme` object with shape `{ color: { bg, ink, paper, accent, accentInk, line, muted }, font: { display, body }, radius }`, all `string` values, imported by every other task in this plan as `import { theme } from '<relative-path-to>/theme'`.

- [ ] **Step 1: Write the failing test**

```ts
// src/theme.test.ts
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/theme.ts
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/theme.test.ts
git commit -m "feat: add shared theme tokens for ESV-style restyle"
```

---

### Task 2: Global CSS — fonts, Leaflet overrides, scrollbar

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing (plain CSS, can't import `theme.ts`). Hex values below are literal copies of `theme.color.*` — a comment at the top of the file says so, so future edits to `theme.ts` remember to update this file too.

- [ ] **Step 1: Replace the whole file**

Current full content (24 lines):

```css
@import url('https://fonts.googleapis.com/css2?family=Bitter:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
input, select, button, textarea { font-family: inherit; }

/* Leaflet overrides */
.leaflet-container { background: #e3d8bf; font-family: 'Work Sans', sans-serif; }
.leaflet-control-attribution { font-size: 10px; background: rgba(246, 237, 217, .82) !important; color: #7a6342 !important; }
.leaflet-popup-content-wrapper { background: #f8efdb; border: 1px solid #cbb077; border-radius: 13px; box-shadow: 0 12px 30px rgba(60, 40, 15, .34); padding: 0; overflow: hidden; }
.leaflet-popup-content { margin: 0; width: auto !important; }
.leaflet-popup-tip { background: #f8efdb; border: 1px solid #cbb077; }
.leaflet-popup-close-button { color: #9a7c45 !important; font-size: 20px !important; padding: 6px 8px 0 0 !important; }
.canton-tip { background: #2e2013; color: #f4ead4; border: none; border-radius: 8px; padding: 5px 10px; font-family: 'Bitter', serif; font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0, 0, 0, .35); }
.canton-tip.leaflet-tooltip-top:before { border-top-color: #2e2013; }
.canton-tip.leaflet-tooltip-bottom:before { border-bottom-color: #2e2013; }

/* Custom scrollbar */
.sk-scroll::-webkit-scrollbar { width: 9px; }
.sk-scroll::-webkit-scrollbar-thumb { background: #d8c089; border-radius: 8px; border: 2px solid #f6edd9; }

/* Modal animations */
@keyframes popIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```

New full content:

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

Note: `box-shadow` on `.leaflet-popup-content-wrapper` and `.canton-tip` is dropped entirely (flat, per spec), not set to `none`.

- [ ] **Step 2: Run the full test suite and lint**

Run: `npm run test && npm run lint`
Expected: PASS (no test touches this file; this just confirms nothing else broke)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: switch global fonts and Leaflet chrome to flat ESV palette"
```

---

### Task 3: Topbar

**Files:**
- Modify: `src/components/Topbar.tsx`
- Test: `src/components/Topbar.test.tsx` (existing — no changes needed, run as regression check)

**Interfaces:**
- Consumes: `theme` from `../theme`

- [ ] **Step 1: Add the import**

Add after the existing imports (after line 4, `import { LANGS, type Lang } from '../i18n/translations';`):

```ts
import { theme } from '../theme';
```

- [ ] **Step 2: Replace `langStyle` and the admin pill**

Old (lines 15-24):

```ts
const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#e0b25f' : 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  lineHeight: '1',
  padding: '6px 8px',
  borderRadius: '7px',
  filter: active ? 'none' : 'grayscale(.45) opacity(.65)',
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
  borderRadius: theme.radius,
});
```

(The `filter: grayscale/opacity` trick for the inactive flag emoji is dropped — color contrast now comes from the token-driven `color`/`background` pair, matching the single-accent system instead of a desaturation hack.)

- [ ] **Step 3: Replace the admin pill block**

Old (lines 45-58):

```tsx
  const adminPill = isAdmin && (
    <div
      title={t.adminMode}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 'none',
        background: '#1faa55', color: '#ffffff', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 12px',
        borderRadius: '999px', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(31,170,85,.5)',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eafff1', flex: 'none' }}></span>
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
        borderRadius: theme.radius, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: theme.color.accentInk, flex: 'none' }}></span>
      {isMobile ? 'Admin' : t.adminMode}
    </div>
  );
```

(The dot stays circular — `borderRadius: '50%'` is a shape primitive for "this is a dot," not a rounded-corner style choice, so it's untouched by the flat-radius rule; same reasoning applies later to the map pin's center dot and the cluster bubble.)

- [ ] **Step 4: Replace the bar container, logo swatch, and wordmark**

Old (lines 60-111):

```tsx
  return (
    <div
      style={{
        height: '60px', flex: 'none', background: 'linear-gradient(#352716,#2a1d10)',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '3px solid #c0851d', position: 'relative', zIndex: 1100,
      }}
    >
      {showHamburger && (
        <button
          onClick={onToggleSidebar}
          aria-label="Menu"
          style={{
            border: 'none', background: 'rgba(255,255,255,.09)', color: '#f4ead4',
            width: '38px', height: '38px', borderRadius: '9px', cursor: 'pointer',
            fontSize: '17px', flex: 'none',
          }}
        >
          ☰
        </button>
      )}
      <div
        style={{
          width: '32px', height: '32px', borderRadius: '7px', background: '#c0851d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bitter',serif", fontWeight: 800, color: '#2a1d10',
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
              fontFamily: "'Bitter',serif", fontWeight: 800, letterSpacing: '0.04em',
              color: '#f4ead4', fontSize: '15px', lineHeight: 1.1, whiteSpace: 'nowrap',
            }}
          >
            SCHWINGKELLER <span style={{ color: '#e0b25f' }}>SCHWEIZ</span>
          </div>
          <div
            style={{
              fontSize: '10.5px', color: '#b69a6b', lineHeight: 1.1, marginTop: '1px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {t.tagline}
          </div>
        </div>
      )}
```

New:

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

- [ ] **Step 5: Replace the desktop language switcher wrapper**

Old (lines 172-183):

```tsx
        <div
          style={{
            display: 'flex', gap: '2px', background: 'rgba(255,255,255,.07)',
            padding: '4px', borderRadius: '9px', flex: 'none',
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
            display: 'flex', gap: '2px', background: 'rgba(255,255,255,.07)',
            padding: '4px', borderRadius: theme.radius, flex: 'none',
          }}
        >
          <button onClick={() => setLang('de')} aria-label="Deutsch" style={langStyle(lang === 'de')}>🇩🇪</button>
          <button onClick={() => setLang('fr')} aria-label="Français" style={langStyle(lang === 'fr')}>🇫🇷</button>
          <button onClick={() => setLang('it')} aria-label="Italiano" style={langStyle(lang === 'it')}>🇮🇹</button>
        </div>
```

- [ ] **Step 6: Replace the mobile language menu popover**

Old (lines 146-151):

```tsx
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1200,
                  background: '#2a1d10', border: '1px solid #6b5634', borderRadius: '10px',
                  padding: '4px', boxShadow: '0 14px 32px rgba(0,0,0,.5)', minWidth: '92px',
                }}
              >
```

New:

```tsx
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1200,
                  background: theme.color.ink, border: '1px solid ' + theme.color.bg, borderRadius: theme.radius,
                  padding: '4px', minWidth: '92px',
                }}
              >
```

Old (lines 153-167):

```tsx
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setLangMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      background: l === lang ? 'rgba(224,178,95,.22)' : 'transparent', border: 'none',
                      color: '#f4ead4', fontSize: '13px', fontWeight: 600, padding: '8px 10px',
                      borderRadius: '7px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>{LANG_FLAGS[l]}</span>
                    {l.toUpperCase()}
                  </button>
                ))}
```

New:

```tsx
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
```

Also update the mobile language-menu trigger button (lines 129-134), old:

```tsx
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,.07)',
              border: 'none', borderRadius: '9px', padding: '6px 8px', cursor: 'pointer',
              fontSize: '15px', lineHeight: 1, color: '#f4ead4',
            }}
```

New:

```tsx
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,.07)',
              border: 'none', borderRadius: theme.radius, padding: '6px 8px', cursor: 'pointer',
              fontSize: '15px', lineHeight: 1, color: theme.color.bg,
            }}
```

- [ ] **Step 7: Replace the logout and login buttons**

Old (lines 185-219):

```tsx
      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: '#e8d6ab', background: 'transparent',
            border: '1.5px solid #6b5634', borderRadius: '8px', cursor: 'pointer', flex: 'none',
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
            fontSize: '12.5px', fontWeight: 600, color: '#2a1d10', background: '#c0851d',
            border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 'none',
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

New:

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

- [ ] **Step 8: Run tests and lint**

Run: `npx vitest run src/components/Topbar.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/components/Topbar.tsx
git commit -m "style: restyle Topbar to flat red/black/white ESV theme"
```

---

### Task 4: Shared Modal shell

**Files:**
- Modify: `src/components/Modal.tsx`

**Interfaces:**
- Consumes: `theme` from `../theme`

- [ ] **Step 1: Replace the whole file**

Old:

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

New:

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

- [ ] **Step 2: Run the tests that render through Modal**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx src/features/venue-edit/EditForm.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "style: restyle shared Modal shell to flat ESV theme"
```

---

### Task 5: Sidebar

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx`
- Test: `src/features/sidebar/Sidebar.test.tsx` (existing, regression check)

**Interfaces:**
- Consumes: `theme` from `../../theme`

- [ ] **Step 1: Add the import**

Add after line 6 (`import { useTranslation } from '../../i18n/useTranslation';`):

```ts
import { theme } from '../../theme';
```

- [ ] **Step 2: Replace `sbBase` and `exportBtnStyle`**

Old (lines 25, 43-58):

```ts
const sbBase: CSSProperties = { display: 'flex', flexDirection: 'column', background: '#f6edd9' };
```

```ts
const exportBtnStyle: CSSProperties = {
  flex: 1,
  border: '1px solid #d8c089',
  background: '#fbf6ea',
  color: '#5a4527',
  fontWeight: 600,
  fontSize: '11.5px',
  padding: '8px 6px',
  borderRadius: '8px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
};
```

New:

```ts
const sbBase: CSSProperties = { display: 'flex', flexDirection: 'column', background: theme.color.bg };
```

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
```

- [ ] **Step 3: Replace `rowStyle`**

Old (lines 60-70):

```ts
const rowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '9px 10px 9px 12px',
  margin: '3px 0',
  borderRadius: '0 8px 8px 0',
  cursor: 'pointer',
  borderLeft: sel ? '2px solid #c0851d' : '2px solid #e6d3a3',
  background: sel ? '#fbf6ea' : 'transparent',
});
```

New:

```ts
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

- [ ] **Step 4: Replace the mobile drag handle and drawer/desktop container styles**

Old (lines 104-118):

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
        borderTop: '1px solid #ddc9a0',
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -8px 30px rgba(40,26,10,.28)',
        transition: 'height .32s cubic-bezier(.4,0,.2,1)',
      }
    : { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid #ddc9a0' };
```

New:

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
```

Old (line 133, drag handle):

```tsx
          <div style={{ width: '44px', height: '5px', borderRadius: '3px', background: '#d3bd8c' }} />
```

New:

```tsx
          <div style={{ width: '44px', height: '5px', borderRadius: theme.radius, background: theme.color.ink }} />
```

- [ ] **Step 5: Replace the search box and clear button**

Old (lines 138-187):

```tsx
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#fff',
            border: '1px solid #e0cfa6',
            borderRadius: '24px',
            padding: '11px 16px',
          }}
        >
          <span style={{ color: '#bca673', fontSize: '15px' }}>⌕</span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t.search}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: '#3a2a18',
              width: '100%',
              minWidth: 0,
            }}
          />
          {hasSearch && (
            <button
              onClick={() => onSearch('')}
              aria-label="clear"
              style={{
                border: 'none',
                background: '#ece0c6',
                color: '#7a6342',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>
```

New:

```tsx
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
          <span style={{ color: theme.color.muted, fontSize: '15px' }}>⌕</span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t.search}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: theme.color.ink,
              width: '100%',
              minWidth: 0,
            }}
          />
          {hasSearch && (
            <button
              onClick={() => onSearch('')}
              aria-label="clear"
              style={{
                border: '1px solid ' + theme.color.line,
                background: theme.color.bg,
                color: theme.color.ink,
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>
```

(The clear button stays circular for the same "shape primitive, not a corner style" reasoning as Task 3's admin dot.)

- [ ] **Step 6: Replace the admin "add" button**

Old (lines 200-220):

```tsx
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              border: 'none',
              background: '#2e2013',
              color: '#f4ead4',
              fontWeight: 600,
              fontSize: '13px',
              padding: '10px',
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>＋</span>
            {t.add}
          </button>
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
              borderRadius: theme.radius,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>＋</span>
            {t.add}
          </button>
```

- [ ] **Step 7: Replace the canton section header and count badge**

Old (lines 255-267):

```tsx
        <span
          style={{
            fontFamily: "'Bitter',serif",
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#9a7c45',
            fontWeight: 700,
          }}
        >
          {t.byCanton}
        </span>
        <span style={{ fontSize: '11px', color: '#b09a6e' }}>{totalText}</span>
```

New:

```tsx
        <span
          style={{
            fontFamily: theme.font.display,
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.color.muted,
            fontWeight: 700,
          }}
        >
          {t.byCanton}
        </span>
        <span style={{ fontSize: '11px', color: theme.color.muted }}>{totalText}</span>
```

Old (lines 296-321, canton group row):

```tsx
                <span
                  style={{
                    fontFamily: "'Bitter',serif",
                    fontWeight: 700,
                    color: '#2e2013',
                    fontSize: '15.5px',
                    flex: 1,
                  }}
                >
                  {group.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#7a5618',
                    background: '#ecd7a0',
                    padding: '2px 9px',
                    borderRadius: '20px',
                  }}
                >
                  {group.count}
                </span>
                <span style={{ color: '#b59a63', fontSize: '11px', width: '12px', textAlign: 'center' }}>
                  {exp ? '▾' : '▸'}
                </span>
```

New:

```tsx
                <span
                  style={{
                    fontFamily: theme.font.display,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: theme.color.ink,
                    fontSize: '15.5px',
                    flex: 1,
                  }}
                >
                  {group.name}
                </span>
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
                <span style={{ color: theme.color.ink, fontSize: '11px', width: '12px', textAlign: 'center' }}>
                  {exp ? '▾' : '▸'}
                </span>
```

- [ ] **Step 8: Replace the venue row text/chevron and the no-results message**

Old (lines 327-352):

```tsx
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#3a2a18',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {v.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: '#a08a64',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {townOf(v.address)}
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', color: '#c0851d', flex: 'none' }}>›</span>
```

New:

```tsx
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: theme.color.ink,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {v.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: theme.color.muted,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {townOf(v.address)}
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', color: theme.color.accent, flex: 'none' }}>›</span>
```

Old (line 361):

```tsx
          <div style={{ padding: '34px 12px', textAlign: 'center', color: '#a08a64', fontSize: '13px' }}>
```

New:

```tsx
          <div style={{ padding: '34px 12px', textAlign: 'center', color: theme.color.muted, fontSize: '13px' }}>
```

- [ ] **Step 9: Run tests and lint**

Run: `npx vitest run src/features/sidebar/Sidebar.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx
git commit -m "style: restyle Sidebar to flat red/black/white ESV theme"
```

---

### Task 6: LoginModal

**Files:**
- Modify: `src/features/auth/LoginModal.tsx`

**Interfaces:**
- Consumes: `theme` from `../../theme`

- [ ] **Step 1: Add the import**

Add after line 2 (`import { useAuth } from './useAuth';`):

```ts
import { theme } from '../../theme';
```

- [ ] **Step 2: Replace `inputStyle` and `labelStyle`**

Old (lines 9-16):

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0cfa6', borderRadius: '9px', padding: '11px 13px',
  fontSize: '14px', color: '#3a2a18', background: '#fff', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#9a7c45', marginBottom: '6px',
};
```

New:

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};
```

- [ ] **Step 3: Replace the backdrop, panel, and header**

Old (lines 46-79):

```tsx
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(30,20,10,.52)', zIndex: 1500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#f6edd9', borderRadius: '16px', width: '360px', maxWidth: '100%',
          boxShadow: '0 26px 64px rgba(30,20,10,.5)', animation: 'popIn .26s ease', overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(#352716,#2a1d10)', padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '11px',
          }}
        >
          <div
            style={{
              width: '30px', height: '30px', borderRadius: '7px', background: '#c0851d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bitter',serif", fontWeight: 800, color: '#2a1d10', fontSize: '17px',
            }}
          >
            S
          </div>
          <span style={{ fontFamily: "'Bitter',serif", fontSize: '16px', fontWeight: 800, color: '#f4ead4' }}>
            {t.loginTitle}
          </span>
        </div>
```

New:

```tsx
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        animation: 'fadeIn .2s ease',
      }}
    >
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

- [ ] **Step 4: Replace the error text, hint, and action buttons**

Old (lines 96-122):

```tsx
          {err && (
            <div style={{ marginTop: '10px', color: '#a3402c', fontSize: '12.5px' }}>{err}</div>
          )}
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#a08a64', fontStyle: 'italic' }}>
            {t.loginHintReal}
          </div>
          <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, border: '1.5px solid #c9a85e', background: 'transparent', color: '#5a4527',
                fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => { void doLogin(); }}
              disabled={busy}
              style={{
                flex: 1, border: 'none', background: '#c0851d', color: '#2a1d10',
                fontWeight: 700, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
              }}
            >
              {t.login}
            </button>
          </div>
```

New:

```tsx
          {err && (
            <div style={{ marginTop: '10px', color: theme.color.accent, fontSize: '12.5px' }}>{err}</div>
          )}
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: theme.color.muted, fontStyle: 'italic' }}>
            {t.loginHintReal}
          </div>
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

- [ ] **Step 5: Run tests and lint**

Run: `npm run test && npm run lint`
Expected: PASS (no dedicated LoginModal test file; full suite is the regression check)

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/LoginModal.tsx
git commit -m "style: restyle LoginModal to flat ESV theme"
```

---

### Task 7: DetailModal

**Files:**
- Modify: `src/features/venue-detail/DetailModal.tsx`
- Test: `src/features/venue-detail/DetailModal.test.tsx` (existing, regression check)

**Interfaces:**
- Consumes: `theme` from `../../theme`

- [ ] **Step 1: Add the import**

Add after line 4 (`import type { Venue } from '../venues/types';`):

```ts
import { theme } from '../../theme';
```

- [ ] **Step 2: Replace the top-level style constants**

Old (lines 15-29):

```ts
const contactIcon: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: '9px', background: '#ecdcb6',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
  color: '#7a5e2e', flex: 'none',
};
const contactLabel: React.CSSProperties = {
  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#b09a6e',
};
const contactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0', textDecoration: 'none',
};
const tag: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: '#5a4a2a', background: '#ead8aa',
  padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px',
};
```

New:

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

- [ ] **Step 3: Replace the photo header block (image wrapper, hatch placeholder, wappen badge, close button)**

Old (lines 41-91):

```tsx
      <div
        style={{
          position: 'relative', height: '194px', background: '#d8c79c',
          borderRadius: '16px 16px 0 0', overflow: 'hidden',
        }}
      >
        {venue.photo_url ? (
          <img
            src={venue.photo_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg,#d8c79c 0 12px,#cdbb8c 12px 24px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace', fontSize: '11px', letterSpacing: '.12em', color: '#7a6342',
                background: 'rgba(248,239,219,.88)', padding: '6px 11px', borderRadius: '5px',
              }}
            >
              FOTO · {venue.name}
            </span>
          </div>
        )}
        <div
          style={{
            position: 'absolute', top: '11px', right: '11px', width: '36px', height: '44px',
            background: 'rgba(246,237,217,.92)', borderRadius: '6px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          }}
        >
          {wappen && (
            <img src={wappen} alt="" style={{ width: '26px', height: '32px', objectFit: 'contain' }} />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '11px', left: '11px', width: '32px', height: '32px',
            borderRadius: '50%', border: 'none', background: 'rgba(42,29,16,.62)', color: '#f4ead4',
            fontSize: '17px', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
```

New:

```tsx
      <div
        style={{
          position: 'relative', height: '194px', background: theme.color.paper,
          overflow: 'hidden',
        }}
      >
        {venue.photo_url ? (
          <img
            src={venue.photo_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg,#e5e5e5 0 12px,#d4d4d4 12px 24px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace', fontSize: '11px', letterSpacing: '.12em', color: theme.color.ink,
                background: theme.color.bg, border: '1px solid ' + theme.color.line, padding: '6px 11px',
              }}
            >
              FOTO · {venue.name}
            </span>
          </div>
        )}
        <div
          style={{
            position: 'absolute', top: '11px', right: '11px', width: '36px', height: '44px',
            background: theme.color.bg, border: '1px solid ' + theme.color.line, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {wappen && (
            <img src={wappen} alt="" style={{ width: '26px', height: '32px', objectFit: 'contain' }} />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '11px', left: '11px', width: '32px', height: '32px',
            borderRadius: '50%', border: 'none', background: 'rgba(17,17,17,.7)', color: theme.color.bg,
            fontSize: '17px', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
```

(The close button keeps its circular shape for the same reason as the earlier "shape primitive" dots/badges. The image wrapper's top corners drop `16px 16px 0 0` entirely — it now shares a flush edge with the flat modal panel above it.)

- [ ] **Step 4: Replace the title, address row, tags, and divider**

Old (lines 93-115):

```tsx
        <div
          style={{
            fontFamily: "'Bitter',serif", fontSize: '21px', fontWeight: 800,
            color: '#2e2013', lineHeight: 1.18,
          }}
        >
          {venue.name}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '5px',
            color: '#9a8460', fontSize: '13px',
          }}
        >
          <span style={{ marginTop: '1px' }}>⌖</span>
          <span>{venue.address}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {venue.indoor && <span style={tag}>⌂ {t.indoor}</span>}
          {venue.outdoor && <span style={tag}>⛰ {t.outdoor}</span>}
        </div>
        <div style={{ height: '1px', background: '#e3d3ad', margin: '18px 0 14px' }}></div>
        <div
          style={{
            fontFamily: "'Bitter',serif", fontSize: '11px', letterSpacing: '.14em',
            textTransform: 'uppercase', color: '#9a7c45', fontWeight: 700, marginBottom: '4px',
          }}
        >
          {t.contact}
        </div>
```

New:

```tsx
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '21px', fontWeight: 700,
            color: theme.color.ink, lineHeight: 1.18,
          }}
        >
          {venue.name}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '5px',
            color: theme.color.muted, fontSize: '13px',
          }}
        >
          <span style={{ marginTop: '1px' }}>⌖</span>
          <span>{venue.address}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {venue.indoor && <span style={tag}>⌂ {t.indoor}</span>}
          {venue.outdoor && <span style={tag}>⛰ {t.outdoor}</span>}
        </div>
        <div style={{ height: '1px', background: theme.color.line, margin: '18px 0 14px' }}></div>
        <div
          style={{
            fontFamily: theme.font.display, fontSize: '11px', letterSpacing: '.14em',
            textTransform: 'uppercase', color: theme.color.muted, fontWeight: 700, marginBottom: '4px',
          }}
        >
          {t.contact}
        </div>
```

- [ ] **Step 5: Replace the contact rows, navigate button, and edit/delete buttons**

Old (lines 124-183):

```tsx
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0' }}>
          <span style={contactIcon}>◉</span>
          <div>
            <div style={contactLabel}>{t.person}</div>
            <div style={{ fontSize: '14px', color: '#3a2a18', fontWeight: 600 }}>{venue.person}</div>
          </div>
        </div>
        {venue.phone && (
          <a href={phoneUrl} style={contactRow}>
            <span style={contactIcon}>✆</span>
            <div>
              <div style={contactLabel}>{t.phone}</div>
              <div style={{ fontSize: '14px', color: '#2a6f6a', fontWeight: 600 }}>{venue.phone}</div>
            </div>
          </a>
        )}
        {venue.website && (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={contactRow}>
            <span style={{ ...contactIcon, fontSize: '14px' }}>⊕</span>
            <div>
              <div style={contactLabel}>{t.website}</div>
              <div style={{ fontSize: '14px', color: '#2a6f6a', fontWeight: 600 }}>{venue.website}</div>
            </div>
          </a>
        )}
        <button
          onClick={onNavigate}
          style={{
            marginTop: '16px', width: '100%', border: 'none', cursor: 'pointer',
            background: '#2e2013', color: '#f4ead4', fontWeight: 600, fontSize: '14px',
            padding: '13px', borderRadius: '11px', display: 'flex', alignItems: 'center',
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
                flex: 1, border: '1.5px solid #c9a85e', background: '#fbf6ea', color: '#5a4527',
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px',
                cursor: 'pointer',
              }}
            >
              {t.edit}
            </button>
            <button
              onClick={onDelete}
              style={{
                flex: 1, border: '1.5px solid #cf9a8a', background: '#f8ece8', color: '#a3402c',
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0' }}>
          <span style={contactIcon}>◉</span>
          <div>
            <div style={contactLabel}>{t.person}</div>
            <div style={{ fontSize: '14px', color: theme.color.ink, fontWeight: 600 }}>{venue.person}</div>
          </div>
        </div>
        {venue.phone && (
          <a href={phoneUrl} style={contactRow}>
            <span style={contactIcon}>✆</span>
            <div>
              <div style={contactLabel}>{t.phone}</div>
              <div style={{ fontSize: '14px', color: theme.color.accent, fontWeight: 600 }}>{venue.phone}</div>
            </div>
          </a>
        )}
        {venue.website && (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={contactRow}>
            <span style={{ ...contactIcon, fontSize: '14px' }}>⊕</span>
            <div>
              <div style={contactLabel}>{t.website}</div>
              <div style={{ fontSize: '14px', color: theme.color.accent, fontWeight: 600 }}>{venue.website}</div>
            </div>
          </a>
        )}
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

- [ ] **Step 6: Run tests and lint**

Run: `npx vitest run src/features/venue-detail/DetailModal.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/venue-detail/DetailModal.tsx
git commit -m "style: restyle DetailModal to flat ESV theme"
```

---

### Task 8: EditForm

**Files:**
- Modify: `src/features/venue-edit/EditForm.tsx`
- Test: `src/features/venue-edit/EditForm.test.tsx` (existing, regression check)

**Interfaces:**
- Consumes: `theme` from `../../theme`

- [ ] **Step 1: Add the import**

Add after line 9 (`import type { Venue, VenueInput } from '../venues/types';`):

```ts
import { theme } from '../../theme';
```

- [ ] **Step 2: Replace `inputStyle`, `labelStyle`, `spOn`, `spOff`**

Old (lines 40-55):

```ts
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0cfa6', borderRadius: '9px', padding: '11px 13px',
  fontSize: '14px', color: '#3a2a18', background: '#fff', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#9a7c45', marginBottom: '6px',
};
const spOn: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: '9px', border: '1.5px solid #c0851d', background: '#f3e2b6', color: '#5a4527',
};
const spOff: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: '9px', border: '1.5px solid #e0cfa6', background: '#fff', color: '#a8916c',
};
```

New:

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

- [ ] **Step 3: Replace the sticky header**

Old (lines 165-180):

```tsx
      <div
        style={{
          position: 'sticky', top: 0, background: '#f0e4c4', borderBottom: '1px solid #ddc99a',
          padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
        }}
      >
        <span style={{ fontFamily: "'Bitter',serif", fontSize: '17px', fontWeight: 800, color: '#2e2013' }}>
          {editTitle}
        </span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', color: '#9a7c45', fontSize: '19px', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
```

New:

```tsx
      <div
        style={{
          position: 'sticky', top: 0, background: theme.color.bg, borderBottom: '1px solid ' + theme.color.line,
          padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
        }}
      >
        <span style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '17px', fontWeight: 700, color: theme.color.ink }}>
          {editTitle}
        </span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', color: theme.color.ink, fontSize: '19px', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
```

- [ ] **Step 4: Replace the photo-upload dropzone and its hatch placeholder**

Old (lines 185-210):

```tsx
        <label
          style={{
            display: 'block', height: '128px', borderRadius: '11px', overflow: 'hidden', cursor: 'pointer',
            border: '1.5px dashed #c9a85e', position: 'relative', marginBottom: '16px',
          }}
        >
          {draft.photo_url ? (
            <img
              src={draft.photo_url}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg,#ece0c6 0 11px,#e3d4b2 11px 22px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', color: '#9a7c45',
              }}
            >
              <span style={{ fontSize: '22px' }}>⬆</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{t.upload}</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>
```

New:

```tsx
        <label
          style={{
            display: 'block', height: '128px', overflow: 'hidden', cursor: 'pointer',
            border: '1.5px dashed ' + theme.color.line, position: 'relative', marginBottom: '16px',
          }}
        >
          {draft.photo_url ? (
            <img
              src={draft.photo_url}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg,#e5e5e5 0 11px,#d4d4d4 11px 22px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', color: theme.color.ink,
              }}
            >
              <span style={{ fontSize: '22px' }}>⬆</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{t.upload}</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>
```

- [ ] **Step 5: Replace the canton-auto confirmation, location readout, and pick-on-map button**

Old (lines 241-285):

```tsx
        {draft.cantonAuto && (
          <div style={{ fontSize: '11px', color: '#6f8a4e', marginTop: '5px', fontWeight: 600 }}>
            ✓ {t.cantonAuto}
          </div>
        )}
```

New:

```tsx
        {draft.cantonAuto && (
          <div style={{ fontSize: '11px', color: theme.color.ink, marginTop: '5px', fontWeight: 600 }}>
            ✓ {t.cantonAuto}
          </div>
        )}
```

Old (lines 265-285):

```tsx
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1, background: '#fff', border: '1px solid #e0cfa6', borderRadius: '9px',
              padding: '11px 13px', fontSize: '13px', color: '#7a6342', fontFamily: 'monospace',
            }}
          >
            {editingCoords}
          </div>
          <button
            onClick={onStartPlacing}
            style={{
              border: '1.5px solid #c9a85e', background: '#fbf6ea', color: '#5a4527', fontWeight: 600,
              fontSize: '13px', padding: '11px 14px', borderRadius: '9px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⌖ {t.pickOnMap}
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#a08a64', marginTop: '5px' }}>↕ {t.locSync}</div>
```

New:

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
        <div style={{ fontSize: '11px', color: theme.color.muted, marginTop: '5px' }}>↕ {t.locSync}</div>
```

- [ ] **Step 6: Replace the sticky footer and its buttons**

Old (lines 311-348):

```tsx
      <div
        style={{
          position: 'sticky', bottom: 0, background: '#f0e4c4', borderTop: '1px solid #ddc99a',
          padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: '9px',
        }}
      >
        <button
          onClick={() => { void save(false); }}
          disabled={saving}
          style={{
            width: '100%', border: 'none', background: '#2e2013', color: '#f4ead4', fontWeight: 600,
            fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
          }}
        >
          {t.saveClose}
        </button>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid #c9a85e', background: 'transparent', color: '#5a4527',
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px', cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>
          <button
            onClick={() => { void save(true); }}
            disabled={saving}
            style={{
              flex: 1, border: '1.5px solid #b3892f', background: '#fbf0d4', color: '#7a5618',
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px', cursor: 'pointer',
            }}
          >
            {t.saveNew}
          </button>
        </div>
      </div>
```

New:

```tsx
      <div
        style={{
          position: 'sticky', bottom: 0, background: theme.color.bg, borderTop: '1px solid ' + theme.color.line,
          padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: '9px',
        }}
      >
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
      </div>
```

- [ ] **Step 7: Run tests and lint**

Run: `npx vitest run src/features/venue-edit/EditForm.test.tsx && npm run lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/features/venue-edit/EditForm.tsx
git commit -m "style: restyle EditForm to flat ESV theme"
```

---

### Task 9: MapView chrome

**Files:**
- Modify: `src/features/map/MapView.tsx`

**Interfaces:**
- Consumes: `theme` from `../../theme`

- [ ] **Step 1: Add the import**

Add after line 8 (`import { pinHtml, popupHtml, clusterIcon } from './markers';`):

```ts
import { theme } from '../../theme';
```

- [ ] **Step 2: Replace the overlay button styles and canton stroke style**

Old (lines 35-51):

```ts
const toggleWrapStyle: CSSProperties = {
  display: 'flex', background: '#f6edd9', border: '1px solid #cbb077',
  borderRadius: '9px', overflow: 'hidden', boxShadow: '0 3px 10px rgba(60,40,15,.25)',
};
const fitAllBtnStyle: CSSProperties = {
  width: '38px', height: '38px', border: '1px solid #cbb077', background: '#f6edd9',
  color: '#5a4527', borderRadius: '9px', cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(60,40,15,.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const layerBtnStyle = (active: boolean): CSSProperties => ({
  border: 'none', cursor: 'pointer', fontFamily: "'Work Sans',sans-serif", fontSize: '12px',
  fontWeight: 600, padding: '7px 13px',
  background: active ? '#c0851d' : 'transparent', color: active ? '#2a1d10' : '#7a6342',
});

const cantonStyle = (): L.PathOptions => ({ color: '#9a7c45', weight: 1, fill: false, fillOpacity: 0 });
```

New:

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

const cantonStyle = (): L.PathOptions => ({ color: theme.color.ink, weight: 1, fill: false, fillOpacity: 0 });
```

- [ ] **Step 3: Replace the mask-tint and canton-stroke colors used for the base/satellite toggle**

Old (line 107-108):

```ts
    if (maskLayerRef.current) maskLayerRef.current.setStyle({ fillColor: kind === 'sat' ? '#0e1c12' : '#6f6553', fillOpacity: kind === 'sat' ? 0.5 : 0.6 });
    if (cantonLayerRef.current) cantonLayerRef.current.setStyle({ color: kind === 'sat' ? '#f4ead4' : '#9a7c45', weight: kind === 'sat' ? 1.2 : 1 });
```

New:

```ts
    if (maskLayerRef.current) maskLayerRef.current.setStyle({ fillColor: kind === 'sat' ? '#1a1a1a' : '#3a3a3a', fillOpacity: kind === 'sat' ? 0.5 : 0.6 });
    if (cantonLayerRef.current) cantonLayerRef.current.setStyle({ color: kind === 'sat' ? theme.color.bg : theme.color.ink, weight: kind === 'sat' ? 1.2 : 1 });
```

- [ ] **Step 4: Replace the initial mask polygon fill**

Old (line 199):

```ts
        maskLayerRef.current = L.polygon([world as L.LatLngExpression[], ...(holes as unknown as L.LatLngExpression[][])], { stroke: false, fillColor: '#6f6553', fillOpacity: 0.6, interactive: false }).addTo(map);
```

New:

```ts
        maskLayerRef.current = L.polygon([world as L.LatLngExpression[], ...(holes as unknown as L.LatLngExpression[][])], { stroke: false, fillColor: '#3a3a3a', fillOpacity: 0.6, interactive: false }).addTo(map);
```

- [ ] **Step 5: Run lint (no dedicated MapView test file)**

Run: `npm run test && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/map/MapView.tsx
git commit -m "style: restyle MapView chrome to flat ESV theme"
```

---

### Task 10: Markers, popups, and clusters

**Files:**
- Modify: `src/features/map/markers.ts`
- Test: `src/features/map/markers.test.ts` (existing, regression check)

**Interfaces:**
- Consumes: `theme` from `../../theme`

- [ ] **Step 1: Add the import**

Add after line 3 (`import { cantonByCode, wappenUrl } from '../../data/cantons';`):

```ts
import { theme } from '../../theme';
```

- [ ] **Step 2: Replace `pinHtml`**

Old (lines 7-11):

```ts
export const pinHtml = (sel: boolean): string =>
  '<div style="position:relative;width:32px;height:40px;">'
  + '<div style="position:absolute;left:1px;top:0;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + (sel ? 'linear-gradient(135deg,#ecc05a,#bd7a14)' : 'linear-gradient(135deg,#a86a1f,#6e4314)') + ';border:2.5px solid #f4ead4;box-shadow:0 4px 9px rgba(0,0,0,.4);"></div>'
  + '<div style="position:absolute;left:11px;top:9px;width:10px;height:10px;border-radius:50%;background:#f4ead4;box-shadow:inset 0 0 0 2px ' + (sel ? '#bd7a14' : '#6e4314') + ';"></div>'
  + '</div>';
```

New:

```ts
export const pinHtml = (sel: boolean): string =>
  '<div style="position:relative;width:32px;height:40px;">'
  + '<div style="position:absolute;left:1px;top:0;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';"></div>'
  + '<div style="position:absolute;left:11px;top:9px;width:10px;height:10px;border-radius:50%;background:' + theme.color.bg + ';box-shadow:inset 0 0 0 2px ' + theme.color.accent + ';"></div>'
  + '</div>';
```

(The teardrop's own `border-radius: 50% 50% 50% 0` is the pin *shape*, not a corner-flattening target — it stays. Selected vs. unselected used to be two shades of gold; with a single accent color there's nothing left to differentiate via color, so selection is still visible via the map's `focusVenue` fly-to zoom and open popup — no color-based selected/unselected distinction is lost in practice since both states will render the same red pin. This is an intentional simplification: call it out if reviewing this task.)

- [ ] **Step 3: Replace `popupHtml`**

Old (lines 13-23):

```ts
export const popupHtml = (v: Venue, t: T): string => {
  const c = cantonByCode(v.canton);
  const photo = v.photo_url ? '<div style="height:104px;background:url(' + v.photo_url + ') center/cover;"></div>' : '<div style="height:104px;background:repeating-linear-gradient(45deg,#d8c79c 0 9px,#cdbb8c 9px 18px);display:flex;align-items:center;justify-content:center;"><span style="font-family:monospace;font-size:10px;letter-spacing:.1em;color:#7a6342;background:rgba(248,239,219,.85);padding:3px 7px;border-radius:4px;">FOTO</span></div>';
  return '<div style="width:222px;font-family:Work Sans,sans-serif;">' + photo
    + '<div style="padding:11px 13px 13px;">'
    + '<div style="display:flex;align-items:center;gap:7px;">' + (c ? '<img src="' + wappenUrl(c.code) + '" style="width:15px;height:19px;object-fit:contain;">' : '') + '<span style="font-family:Bitter,serif;font-weight:700;font-size:14.5px;color:#2e2013;line-height:1.2;">' + v.name + '</span></div>'
    + '<div style="font-size:11.5px;color:#9a8460;margin-top:3px;">' + v.address + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:9px;">' + (v.indoor ? '<span style="font-size:10.5px;font-weight:600;color:#5a4a2a;background:#e9d8ab;padding:3px 8px;border-radius:6px;">⌂ ' + t.indoor + '</span>' : '') + (v.outdoor ? '<span style="font-size:10.5px;font-weight:600;color:#5a4a2a;background:#e9d8ab;padding:3px 8px;border-radius:6px;">⛰ ' + t.outdoor + '</span>' : '') + '</div>'
    + '<button data-detail="' + v.id + '" style="margin-top:11px;width:100%;border:none;cursor:pointer;background:#2e2013;color:#f4ead4;font-family:Work Sans;font-weight:600;font-size:12.5px;padding:9px;border-radius:8px;">' + t.details + ' →</button>'
    + '</div></div>';
};
```

New:

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

- [ ] **Step 4: Replace `clusterIcon`**

Old (lines 26-30):

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c89a3e,#8a5a14);border:2.5px solid #f4ead4;box-shadow:0 4px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff8e6;font-family:Bitter,serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
```

New:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
```

(The cluster bubble stays circular — again a shape primitive, not a corner-radius style choice.)

- [ ] **Step 5: Run tests and lint**

Run: `npx vitest run src/features/map/markers.test.ts && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/map/markers.ts
git commit -m "style: restyle map pins, popups, and clusters to flat ESV theme"
```

---

### Task 11: App shell — page background, dialogs, and flash toast

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `theme` from `./theme`

- [ ] **Step 1: Add the import**

Add after line 14 (`import { captureAndFormat } from './lib/sentry';`):

```ts
import { theme } from './theme';
```

- [ ] **Step 2: Replace the page shell background and the tablet drawer scrim**

Old (lines 235-240):

```tsx
    <div
      style={{
        height: '100vh', display: 'flex', flexDirection: 'column', background: '#efe3c9',
        overflow: 'hidden', fontFamily: "'Work Sans',sans-serif",
      }}
    >
```

New:

```tsx
    <div
      style={{
        height: '100vh', display: 'flex', flexDirection: 'column', background: theme.color.bg,
        overflow: 'hidden', fontFamily: theme.font.body,
      }}
    >
```

Old (lines 262-267):

```tsx
        {scrimShow && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(30,20,10,.42)', zIndex: 1150, animation: 'fadeIn .2s ease' }}
          />
        )}
```

New:

```tsx
        {scrimShow && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1150, animation: 'fadeIn .2s ease' }}
          />
        )}
```

- [ ] **Step 3: Replace the placing banner**

Old (lines 310-329):

```tsx
        <div
          style={{
            position: 'fixed', top: '74px', left: '50%', transform: 'translateX(-50%)', zIndex: 1700,
            background: '#2e2013', color: '#f4ead4', padding: '12px 16px', borderRadius: '13px',
            boxShadow: '0 12px 30px rgba(0,0,0,.4)', display: 'flex', gap: '14px', alignItems: 'center',
            maxWidth: 'calc(100% - 32px)', animation: 'popIn .24s ease',
          }}
        >
          <span style={{ fontSize: '13px' }}>⌖ {t.pickHint}</span>
          <button
            onClick={cancelPlacing}
            style={{
              border: '1px solid #6b5634', background: 'transparent', color: '#e8d6ab', fontWeight: 600,
              fontSize: '12.5px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
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

- [ ] **Step 4: Replace the delete-confirm dialog**

Old (lines 333-363):

```tsx
        <Modal onClose={cancelDelete} width={340} zIndex={1600}>
          <div style={{ padding: '22px' }}>
            <div style={{ fontFamily: "'Bitter',serif", fontSize: '18px', fontWeight: 800, color: '#2e2013' }}>
              {t.deleteTitle}
            </div>
            <div style={{ fontSize: '13.5px', color: '#7a6342', marginTop: '8px', lineHeight: 1.5 }}>
              {t.deleteBody}
            </div>
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelDelete}
                style={{
                  flex: 1, border: '1.5px solid #c9a85e', background: 'transparent', color: '#5a4527',
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void confirmDelete(); }}
                style={{
                  flex: 1, border: 'none', background: '#a3402c', color: '#f8ece8',
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
                }}
              >
                {t.confirmDelete}
              </button>
            </div>
          </div>
        </Modal>
```

New:

```tsx
        <Modal onClose={cancelDelete} width={340} zIndex={1600}>
          <div style={{ padding: '22px' }}>
            <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700, color: theme.color.ink }}>
              {t.deleteTitle}
            </div>
            <div style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '8px', lineHeight: 1.5 }}>
              {t.deleteBody}
            </div>
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
          </div>
        </Modal>
```

- [ ] **Step 5: Replace the import-confirm dialog**

Old (lines 368-408):

```tsx
        <Modal onClose={cancelImport} width={360} zIndex={1600}>
          <div style={{ padding: '22px' }}>
            <div style={{ fontFamily: "'Bitter',serif", fontSize: '18px', fontWeight: 800, color: '#2e2013' }}>
              {t.importTitle}
            </div>
            <div style={{ fontSize: '13.5px', color: '#7a6342', marginTop: '8px', lineHeight: 1.5 }}>
              {t.importBody}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ flex: 1, background: '#f3ead4', borderRadius: '9px', padding: '9px 11px', color: '#5a4527' }}>
                <div style={{ opacity: 0.7 }}>{t.importExisting}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Bitter',serif" }}>{venues.length}</div>
              </div>
              <div style={{ color: '#b08a3c', fontSize: '18px', flex: 'none' }}>→</div>
              <div style={{ flex: 1, background: '#f3ead4', borderRadius: '9px', padding: '9px 11px', color: '#5a4527' }}>
                <div style={{ opacity: 0.7 }}>{t.import}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Bitter',serif" }}>{pendingImport.count}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelImport}
                style={{
                  flex: 1, border: '1.5px solid #c9a85e', background: 'transparent', color: '#5a4527',
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void runImport(); }}
                style={{
                  flex: 1, border: 'none', background: '#a3402c', color: '#f8ece8',
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
                }}
              >
                {t.importReplace}
              </button>
            </div>
          </div>
        </Modal>
```

New:

```tsx
        <Modal onClose={cancelImport} width={360} zIndex={1600}>
          <div style={{ padding: '22px' }}>
            <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700, color: theme.color.ink }}>
              {t.importTitle}
            </div>
            <div style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '8px', lineHeight: 1.5 }}>
              {t.importBody}
            </div>
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
          </div>
        </Modal>
```

- [ ] **Step 6: Replace the flash/toast message**

Old (lines 412-425):

```tsx
        <div
          role="status"
          style={{
            position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)', zIndex: 1800,
            background: flash.kind === 'ok' ? '#2e5a2e' : '#7a2b22', color: '#f6efe2',
            padding: '12px 18px', borderRadius: '12px', boxShadow: '0 12px 30px rgba(0,0,0,.4)',
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
            padding: '12px 18px', borderRadius: theme.radius,
            fontSize: '13.5px', fontWeight: 600, maxWidth: 'calc(100% - 32px)', textAlign: 'center',
            animation: 'popIn .24s ease',
          }}
        >
          {flash.text}
        </div>
```

- [ ] **Step 7: Run the full test suite, lint, typecheck, and build**

Run: `npm run test && npm run lint && npm run typecheck && npm run build`
Expected: all PASS — this is the last source file in the restyle, so also confirm the production build succeeds end to end.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "style: restyle App shell dialogs and toast to flat ESV theme"
```

---

### Task 12: Manual visual verification + regenerate README screenshot

**Files:**
- Modify (replace binary): `docs/screenshot.png`
- No source changes — `README.md` already references `docs/screenshot.png` at line 13 and needs no edit.

This task is best-effort and environment-dependent (it needs either a working local Supabase backend or a graceful empty-data render), unlike Tasks 1-11 which are fully deterministic. Try the primary path first; fall back if it doesn't work in your execution environment.

- [ ] **Step 1: Manual visual pass in a running dev server**

Before touching the screenshot, actually look at the restyled app — this is a large visual change and the automated tests don't check colors:

```bash
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) in a browser (or drive it with Playwright, see Step 3) and check: Topbar (logo, wordmark, language switcher, login button), Sidebar (search box, canton groups, venue rows), the map (toggle buttons, pins, a popup), and — if you can sign in — an admin view (edit form, delete confirm). Confirm: no rounded corners, no drop shadows, red/black/white only, Oswald headings in caps. Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 2: Try the primary path — full stack via Docker Compose**

```bash
which dockerd && (dockerd >/tmp/dockerd.log 2>&1 &) && sleep 3
docker compose up -d
```

Wait for the app to become reachable (the compose stack's init step seeds 8 example venues from `supabase/seed.sql`):

```bash
timeout 60 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 2; done'
```

If this succeeds, skip to Step 4. If `dockerd` fails to start (common in a sandboxed/rootless container — no `/var/run/docker.sock`, no privilege to run a nested daemon) or the stack doesn't come up within the timeout, tear down anything partially started and go to Step 3 instead:

```bash
docker compose down 2>/dev/null || true
```

- [ ] **Step 3: Fallback path — dev server without a backend**

```bash
npm run dev &
DEV_PID=$!
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

`useVenues()` in `src/features/venues/useVenues.ts` defaults to an empty array on fetch failure (`const { data: venues = [] } = useVenues();` in `App.tsx`), so the app renders its full chrome — Topbar, Sidebar, map — with zero venues rather than crashing. That's sufficient to showcase the new visual theme even without real data.

- [ ] **Step 4: Capture the screenshot with the pre-installed Chromium**

`playwright` is not an npm dependency of this project (confirmed via `grep -i playwright package.json`), so run it through `npx` rather than adding it to `package.json` — this only pulls the CLI into the npx cache for one-off use, it does not modify `package.json`/`package-lock.json`. The environment already sets `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, so this reuses the pre-installed Chromium instead of downloading one:

```bash
npx --yes playwright@latest screenshot --viewport-size=1280,800 http://localhost:5173 docs/screenshot.png
```

- [ ] **Step 5: Tear down whichever stack you started**

```bash
docker compose down 2>/dev/null || true
[ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null || true
```

- [ ] **Step 6: Confirm the new screenshot looks right**

```bash
file docs/screenshot.png
```

Expected: a valid PNG, non-trivial file size (a few KB+, not 0 bytes). Open it (e.g. via your editor's image preview) and confirm it shows the flat red/black/white theme, not the old parchment/gold look. If Docker wasn't available and you used the fallback path, the screenshot will show an empty venue list — that's acceptable; note in the commit message that it was captured without seed data.

- [ ] **Step 7: Commit**

```bash
git add docs/screenshot.png
git commit -m "docs: refresh README screenshot for the ESV-style restyle"
```

If neither the Docker path nor the dev-server fallback is usable in your execution environment (e.g. no network access to serve the page, or `npx` can't reach the Chromium binary), stop here and tell the user the screenshot still needs manual regeneration — do not leave the stale parchment-theme screenshot uncommitted-but-unmentioned.

---

## Self-Review Notes

- **Spec coverage:** every file listed in the spec's "Files Touched" section has a task (theme.ts → Task 1, index.css → Task 2, Topbar → Task 3, Modal → Task 4, Sidebar → Task 5, LoginModal → Task 6, DetailModal → Task 7, EditForm → Task 8, MapView → Task 9, markers.ts → Task 10, App.tsx → Task 11). The spec's non-goal "no new npm dependencies" is honored by Task 12 using `npx` rather than an installed dependency.
- **Placeholder scan:** no TBD/TODO; every step shows literal before/after code.
- **Type consistency:** `theme` is imported with the same shape (`theme.color.*`, `theme.font.*`, `theme.radius`) in every task; no task invents a token name not defined in Task 1.
- **Known simplification:** Task 10 flagged inline — the pin's selected/unselected color distinction is dropped (both render accent-red) since there's only one accent color left; selection is still visually confirmed via map fly-to + auto-opened popup, not color.
