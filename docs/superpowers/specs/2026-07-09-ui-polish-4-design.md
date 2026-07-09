# UI Polish Round 4: Favicon, Zoom-to-Fit Border, Drag Handle, Tablet Sidebar, Admin Header

## Context

Follow-up polish round addressing [issue #8](https://github.com/hoferan/schwingkeller/issues/8), filed after the red/black/white restyle (#7). Five items, all cosmetic/interaction fixes with no data or auth logic changes:

1. Favicon doesn't match the app's red/white identity.
2. Zoom-to-fit button's border doesn't match Leaflet's native +/- control.
3. Mobile sheet's drag handle is oversized and the header gets clipped when collapsed.
4. The side menu is unusable at tablet width / mobile landscape (640–1023px) — it falls back to the fixed desktop column, which doesn't fit.
5. The admin-mode pill overlaps/clutters the header at narrow widths.

Scope: `public/favicon.svg`, `src/features/map/MapView.tsx`, `src/features/sidebar/Sidebar.tsx`, `src/App.tsx`, `src/components/Topbar.tsx`, plus corresponding test files. No changes to `theme.ts` tokens themselves (values are reused, not redefined), i18n keys, or Supabase/data-fetching logic.

## 1. Favicon (`public/favicon.svg`)

Current SVG uses `fill="#c0851d"` (brown/gold) for the background and `font-family: 'Bitter'`, a font the app never loads (only `Oswald`/`Work Sans` are `@import`ed in `src/index.css`), so the "S" silently falls back to a generic serif.

Change:
- Background `fill` → `theme.color.accent`'s value, `#e30613`.
- Text `fill` → `theme.color.accentInk`'s value, `#ffffff`.
- `font-family` → `'Oswald', sans-serif` (matches `theme.font.display`, actually loaded by the app).

No other markup changes; same 64×64 viewBox, same `rx="14"` rounding.

## 2. Zoom-to-fit button border (`MapView.tsx`)

`nativeCtrlStyle` (lines 31–33) currently sets `border: 1px solid rgba(0,0,0,.15)` and no shadow — a much fainter edge than Leaflet's own `.leaflet-bar` control, which relies on `box-shadow: 0 1px 5px rgba(0,0,0,.65)` (no border) for its edge definition. Change `nativeCtrlStyle`:

```ts
const nativeCtrlStyle: CSSProperties = {
  background: '#fff', borderRadius: '4px', boxShadow: '0 1px 5px rgba(0,0,0,.65)', overflow: 'hidden',
};
```

`border` is dropped entirely (replaced by the shadow). This object is shared with `fitAllWrapStyle`, so the fit-all button picks up the change automatically; no other usage of `nativeCtrlStyle` exists (the map/satellite toggle was moved off it in the prior polish round).

## 3. Mobile drag handle + peek height (`Sidebar.tsx`)

### Handle size

Current handle wrapper (lines 258–269): `padding: '14px 0 12px'` around a `56×6px` pill (`borderRadius: theme.radius.pill`, already fully rounded — no shape change needed there). Shrink the tap-zone padding and the pill itself:

```tsx
<div style={{ padding: '8px 0 8px', display: 'flex', justifyContent: 'center', flex: 'none' }}>
  <div style={{ width: '40px', height: '4px', borderRadius: theme.radius.pill, background: theme.color.ink }} />
</div>
```

### Peek height

`PEEK_HEIGHT = 108` (line 29) is a hardcoded guess that's shorter than the actual rendered handle+header block (~126px: handle zone + the dark header's title/count-pill content + its own padding), so today the header's bottom padding/pill gets clipped in the collapsed state. Rather than hardcode a new magic number (fragile against translation-driven text reflow across DE/FR/IT), measure the real rendered height the same way `MapView.tsx` already measures the Leaflet zoom control (`map.whenReady` → `zoomEl.offsetHeight`, lines 184–191):

- Add `const [peekHeight, setPeekHeight] = useState(PEEK_HEIGHT_DEFAULT)`, where `PEEK_HEIGHT_DEFAULT = 116` replaces the old `PEEK_HEIGHT` constant as the pre-measurement fallback.
- `headerRef` (already exists, line 98, on the outer div wrapping *both* the handle and the dark header block) is measured in a `useEffect(() => { if (isMobile && headerRef.current) setPeekHeight(headerRef.current.offsetHeight); }, [isMobile, t])` — re-measuring when the language (`t`) changes, since DE/FR/IT strings differ in length and could wrap differently.
- Replace both usages of `PEEK_HEIGHT` (the closed-state `height` in `sidebarStyle`, line 235, and `dragStartHeightRef.current = sidebarOpen ? ... : PEEK_HEIGHT`, line 111, and the clamp `Math.max(PEEK_HEIGHT, newHeight)`, line 199) with `peekHeight`.

This guarantees the handle + full header are always visible when collapsed, regardless of copy length.

## 4. Tablet / mobile-landscape collapsible sidebar (`App.tsx`, `Sidebar.tsx`)

### Root cause

`App.tsx` already computes a 3-way `mode: 'd' | 't' | 'm'` (line 18: `vw >= 1024 ? 'd' : vw >= 640 ? 't' : 'm'`), but only `isMobile = mode === 'm'` is ever consumed (line 55) — `Sidebar` and `Topbar` only receive that one boolean. So the `'t'` band (640–1023px, covering tablets and most phones in landscape) silently renders the fixed 344px desktop column, which doesn't fit and can't be dismissed.

### Prop change

`App.tsx` passes a new `isTablet={mode === 't'}` prop to `<Sidebar>` alongside the existing `isMobile` prop. `Topbar` is unaffected — the admin-header change in section 5 applies at every width, not just tablet.

### Sidebar behavior at tablet width

Reuses the *existing* `sidebarOpen` / `onSetSidebarOpen` / `onToggleSidebar` props (already passed down from `App.tsx`, already width-agnostic in their signatures) rather than inventing new state. Starts collapsed (`sidebarOpen` already initializes to `false` in `App.tsx`, line 63 — no change needed there).

**Rendering model:** the panel keeps a constant `344px` width (matching the desktop column) and slides via `transform: translateX(...)` rather than animating `width`/`height`, so its internal content never reflows during the gesture:

```ts
const TABLET_PANEL_WIDTH = 344;
// third branch in the existing isMobile ? {...} : {...} ternary (sidebarStyle, line 228)
const tabletX = dragX !== null ? dragX : (sidebarOpen ? 0 : -TABLET_PANEL_WIDTH);
: isTablet
? {
    ...sbBase,
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: `${TABLET_PANEL_WIDTH}px`,
    transform: `translateX(${tabletX}px)`,
    zIndex: 1200,
    borderRight: '1px solid ' + theme.color.line,
    boxShadow: theme.shadow,
    transition: dragX !== null ? 'none' : 'transform .28s cubic-bezier(.4,0,.2,1)',
  }
: { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid ' + theme.color.line }; // desktop, unchanged
```

**Floating arrow tab:** a small always-rendered button attached to the panel's trailing edge, sliding along with it via the same `tabletX` offset (`left: ${TABLET_PANEL_WIDTH + tabletX}px`, which resolves to `0px` when closed — flush with the screen edge — and `344px` when open — flush with the panel's right edge). Icon is `ChevronRight` when `!sidebarOpen` (affordance to expand) and `ChevronLeft` when open (affordance to collapse), `onClick={onToggleSidebar}`. This directly satisfies the issue's "arrow button to expand" ask and is the primary, mouse-and-touch-safe toggle (the 640–1023px band isn't guaranteed to be a touch device — a resized desktop window lands here too).

**Continuous free-drag (touch enhancement, layered on top of the tab):** mirrors the mobile sheet's existing vertical drag machinery (lines 100–206) exactly, just re-oriented to the horizontal axis, and scoped to gestures starting on the arrow tab (to open) or the header block (to close) — not the venue list, so it never fights with vertical list scrolling:

- New refs: `touchStartXRef`, `dragStartXRef` (the panel's `tabletX` at gesture start: `0` or `-TABLET_PANEL_WIDTH`), `dragXRef`, `tabletDraggingRef`, `startedOnDragZoneRef` (true if the touch started inside the tab or `headerRef`).
- New state: `dragX: number | null`.
- `onTouchStart` (attached to the panel's root div when `isTablet`, mirroring `handleTouchStart`): record the above, same pattern as lines 108–115.
- Native (non-passive) `onTouchMove` listener, same reasoning as the mobile sheet's comment at lines 169–172 (JSX `onTouchMove` is passive by default, making `preventDefault()` a no-op): once `startedOnDragZoneRef.current` is true and movement exceeds the same 8px slop, classify as dragging, `preventDefault()`, compute `clamped = Math.min(0, Math.max(-TABLET_PANEL_WIDTH, dragStartXRef.current + deltaX))`, write to `dragXRef`/`setDragX`.
- `onTouchEnd`: same 25%-of-range-from-drag-start commit rule as mobile (lines 138–156, `range = TABLET_PANEL_WIDTH`, `travelled = finalX - dragStartXRef.current`): `travelled > range * 0.25` → open, `travelled < -range * 0.25` → close, otherwise snap back to the state the drag started from. Falls back to the tab's own `onClick` toggle for a non-dragging tap (already handled by the tab being a real `<button>`, so no extra tap-detection logic needed here — unlike the mobile header, which has no natural click target and needs the `<10px` tap-vs-drag disambiguation at lines 126–133).
- `onTouchCancel`: reset refs and `setDragX(null)`, same as mobile's `handleTouchCancel` (lines 162–167).

**Dismiss on outside tap:** the existing pointerdown-outside-closes effect (lines 208–217), currently gated on `isMobile && sidebarOpen`, is widened to `(isMobile || isTablet) && sidebarOpen` — tapping the map area closes the tablet panel too, with no new code needed beyond the condition change.

**Scrolling:** the panel's internal content already scrolls via the existing `sk-scroll` class used in both other modes; no change needed since the tablet branch reuses the same child markup, only the outer `sidebarStyle` differs.

## 5. Admin mode: invert header (`Topbar.tsx`)

Remove `adminPill` (lines 30–43) and its placement block (lines 77–83) entirely. When `isAdmin` is true, the Topbar root (lines 46–52) swaps its two color tokens:

```ts
background: isAdmin ? theme.color.accent : theme.color.bg,
borderBottom: '2px solid ' + (isAdmin ? theme.color.ink : theme.color.accent),
```

And every element that currently hardcodes `theme.color.accent` for the wordmark or `theme.color.ink`/`theme.color.muted` for text needs to flip alongside it so contrast holds against the red background:
- Wordmark color (line 58): `isAdmin ? theme.color.accentInk : theme.color.accent`.
- Tagline color (line 67): `isAdmin ? theme.color.accentInk : theme.color.muted` (tagline is `!isMobile`-only, unaffected by this section otherwise).
- Logout button (the only button rendered when `isAdmin`, lines 100–115): currently `border: '1.5px solid ' + theme.color.line`, `color: theme.color.ink`, transparent background — against a red header this becomes `border: '1.5px solid ' + theme.color.accentInk`, `color: theme.color.accentInk`, background stays transparent (still readable, now white-on-red instead of dark-on-white).
- Language switcher pill row (lines 86–97, `background: theme.color.paper`): stays as-is — a light pill reads fine floating on either background, and changing it would touch shared logic (`langStyle`) used identically in both modes; no functional or contrast problem to fix here.

The lock/unlock icon swap on the login/logout button (already existing, unrelated to this change) continues to be the redundant non-color signal for admin state, same as today.

## Testing

- `Sidebar.test.tsx`: new tests for the tablet drag/tab behavior, mirroring the existing mobile swipe tests' structure (fire `touchStart`+`touchMove`+`touchEnd` sequences, assert on `onSetSidebarOpen` calls) — one for tab-click toggle, one for a drag past the 25% threshold, one for a drag that snaps back under threshold. Existing mobile tests are unaffected (different `isMobile`/`isTablet` prop, different refs).
- `Topbar.test.tsx` (if it exists) or a new test: assert the header's inline background/color values flip when `isAdmin` is true, and that no `adminPill` element (by text/role) renders.
- No new Vitest coverage needed for the favicon (static asset) or the zoom-to-fit border (pure inline-style value change, already implicitly covered by any existing MapView render test, if present).

## Out of scope

- No changes to `theme.ts` tokens — all new colors/values reuse existing tokens (`accent`, `accentInk`, `ink`, `bg`, `radius.pill`, `shadow`).
- No changes to the map/satellite toggle, detail modal, or any of the items already fixed in prior polish rounds (#1–#3).
- No PWA manifest / `apple-touch-icon` / PNG favicon fallback — out of scope for this issue, which only asked for the existing SVG's colors to match.
- Desktop (`mode === 'd'`, ≥1024px) sidebar rendering is completely unchanged.
