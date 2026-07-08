# UI Polish Round 3: Pill Toggle, Free-Drag Sheet, Detail Modal Fixes

## Context

Third follow-up polish round after live-preview feedback. Two items reported alongside this batch — the zoom-to-fit control's style and swipe-down-to-close not working — were set aside after the user confirmed they hadn't hard-reloaded the Netlify preview since the last push; those two features were just shipped, automated-tested, and smoke-tested with real touch emulation, so they're presumed already fixed pending a fresh reload rather than re-diagnosed here. This spec covers the four confirmed, genuine items:

1. Map/satellite toggle: replace the native-radio-based control with a segmented pill row.
2. Detail modal close button: replace the `✕` text glyph with a lucide icon.
3. Detail modal wappen: remove its white background box.
4. Mobile drawer: continuous free-drag instead of tap/threshold-only.

Scope: `src/features/map/MapView.tsx`, `src/features/venue-detail/DetailModal.tsx`, `src/features/sidebar/Sidebar.tsx`, `src/features/sidebar/Sidebar.test.tsx`. No changes to `theme.ts`, i18n keys, or data-fetching logic.

## 1. Map/satellite toggle → segmented pill row (`MapView.tsx`)

Replaces `layerCardStyle`/`radioRowStyle`/`radioInputStyle` and the `<label>`+`<input type="radio">` markup entirely with a pill toggle built exactly like the Topbar's DE/FR/IT language switcher (`src/components/Topbar.tsx`'s `langStyle`/pill-container pattern):

```ts
const baseToggleWrapStyle: CSSProperties = {
  display: 'flex', gap: '2px', background: theme.color.paper,
  padding: '4px', borderRadius: theme.radius.pill, flex: 'none',
};
const baseToggleBtnStyle = (active: boolean): CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
  lineHeight: '1', padding: '6px 10px', borderRadius: theme.radius.pill,
});
```

Two `<button>` elements (`onClick={() => onChangeBase('map')}` / `('sat')`), each styled via `baseToggleBtnStyle(baseKind === 'map' | 'sat')`, replacing the radio+label pairs. No native radio input remains for this control. Stays positioned top-right via the existing `overlayStyle`. The `sk-native-ctrl-btn` hover class and the "match Leaflet's native look" treatment (`nativeCtrlStyle`) are dropped for this specific control — `nativeCtrlStyle` remains used only by the zoom-to-fit button, which this change doesn't touch.

## 2. Detail modal close button (`DetailModal.tsx`)

The close button (currently a `✕` text character at `fontSize: '17px'` inside a `32×32px` circular flex-centered button) is replaced with `lucide-react`'s `<X size={16} />`, matching the icon language used everywhere else in the app now. The button's own styling (position, size, background, border-radius) is unchanged — only its content swaps from a text glyph to a true centered vector icon, which is what actually fixes the visual off-center appearance (text glyphs carry font-metric baseline offsets that a flex-centered `<span>` can't fully cancel out; an SVG icon component doesn't have this problem).

## 3. Detail modal wappen transparency (`DetailModal.tsx`)

The wappen currently sits in a `36×44px` box with `background: theme.color.bg` and a `1px solid theme.color.line` border. That box is removed entirely; the `<img>` itself gains a `drop-shadow` filter for legibility against whatever photo is behind it — the same treatment already used for the canton wappen in `Sidebar.tsx`'s canton-group header (`filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.25))'`). The wappen keeps its current position (`top: 11px, right: 11px`) and size (`26×32px` for the image itself, no more outer box dimensions to worry about).

## 4. Free-drag mobile drawer (`Sidebar.tsx`, `Sidebar.test.tsx`)

### Current state being replaced

Today, `handleHeaderTouchStart`/`handleHeaderTouchEnd` live only on the header wrapper div and classify a single touchstart→touchend delta into three buckets (tap / swipe-up / swipe-down / dead zone), each immediately calling `onToggleSidebar()` or `onSetSidebarOpen(boolean)` — there's no visual feedback during the gesture, only a snap at release.

### New model

**State/refs added to `Sidebar`:**
- `dragHeight: number | null` (React state) — when non-null, overrides the sheet's CSS `height` with this exact pixel value and disables the `height` transition (`transition: 'none'`) so the sheet tracks the finger with zero lag. When `null`, the sheet uses its existing static `height: sidebarOpen ? '80vh' : '108px'` with the existing `transition: 'height .32s cubic-bezier(.4,0,.2,1)'`.
- `touchStartYRef: number | null` (existing, reused).
- `dragStartHeightRef: number | null` — the sheet's height in px at the moment the current gesture began.
- `openHeightPxRef: number` — `window.innerHeight * 0.8` recomputed fresh at the start of each gesture (handles orientation/resize between gestures without needing a resize listener).
- `isDraggingRef: boolean` — whether the current gesture has been classified as "controlling the sheet" (as opposed to a pass-through list scroll or a plain tap).
- `startedOnHeaderRef: boolean` — whether the current gesture's `touchstart` landed inside the header zone.
- `headerRef: HTMLDivElement | null` (ref on the existing header wrapper div, for containment checks) and `listRef: HTMLDivElement | null` (ref on the existing scrollable venue-list div, for `scrollTop` checks).

**Handlers, attached to the sheet's root div (not just the header) when `isMobile`:**

- `onTouchStart` (JSX prop, as today): records `touchStartYRef`, `dragStartHeightRef` (`sidebarOpen ? openHeightPxRef.current : 108`, with `openHeightPxRef.current` freshly recomputed here), `startedOnHeaderRef` (via `headerRef.current?.contains(e.target)`), and resets `isDraggingRef` to `false`.
- `onTouchMove`: **attached via a native `addEventListener('touchmove', handler, { passive: false })` in a `useEffect`, not as a JSX prop** — JSX's `onTouchMove` is passive by default in React, which makes `preventDefault()` inside it silently do nothing, so blocking native scroll while dragging requires the native listener form. On each move:
  - If `isDraggingRef.current` is still `false` (gesture not yet classified): if `startedOnHeaderRef.current` is `true`, or the sheet isn't currently fully open (`!sidebarOpen`), set `isDraggingRef.current = true` immediately. Otherwise (gesture started in the list body while the sheet is fully open), only flip to `true` once the list is scrolled to its top (`listRef.current.scrollTop <= 0`) and the finger has moved downward by more than 5px — otherwise return early and let the browser's native list scroll proceed untouched.
  - Once `isDraggingRef.current` is `true`: call `e.preventDefault()` (now effective, since this is the native non-passive listener) and compute `newHeight = dragStartHeightRef.current - (currentY - touchStartYRef.current)`, clamped to `[108, openHeightPxRef.current]`, and `setDragHeight(clamped)`.
- `onTouchEnd` (JSX prop, as today): if the gesture never became a drag (`isDraggingRef.current` was `false` throughout — i.e. it was either a pass-through list scroll or too small/never moved), fall back to the existing tap-toggle check, but only when `startedOnHeaderRef.current` is `true`: if `|finalDeltaY| < 10`, call `e.preventDefault()` (suppressing the compat click, as today) and `onToggleSidebar()`. If the gesture *was* a drag, compute the midpoint `(108 + openHeightPxRef.current) / 2`, call `setDragHeight(null)` (releasing manual control so the CSS transition takes over), and call `onSetSidebarOpen(lastDragHeight > midpoint)`.

**Sheet's rendered style**, conceptually:

```ts
height: dragHeight !== null ? `${dragHeight}px` : (sidebarOpen ? '80vh' : '108px'),
transition: dragHeight !== null ? 'none' : 'height .32s cubic-bezier(.4,0,.2,1)',
```

**Explicitly out of scope:** no velocity/fling-based snapping (purely position-vs-midpoint at release); no visual "rubber-banding" past the peek/open bounds (hard clamp instead); no changes to the click-outside-to-close effect (unrelated, untouched).

### Test changes (`Sidebar.test.tsx`)

The 4 existing tests that assert on swipe classification (`'opens the drawer on an upward swipe past the threshold'`, `'closes the drawer on a downward swipe past the threshold'`, `'treats exactly 30px downward as the swipe-close boundary'`, `'treats exactly -30px upward as the swipe-open boundary'`) currently fire only `touchStart`+`touchEnd`. Under the new model, `isDraggingRef` only ever becomes `true` inside the (now-native) `touchmove` handler, so these tests need an actual `fireEvent.touchMove(header, { touches: [{ clientY: ... }] })` between the start/end events to properly drive the new logic, and their assertions need updating to match the new release-time model (still asserting the final `onSetSidebarOpen` call, since that's the externally-observable contract that hasn't changed — only the internal mechanism producing it has). The tap test, the dead-zone test, and the two click-outside tests are unaffected, since a real tap generates no (or negligible) `touchmove` events and the dead-zone delta (10px, still under the classification path) doesn't change behavior.

## Out of scope

- No changes to `theme.ts`, i18n keys, or Supabase/data-fetching logic.
- No changes to the zoom-to-fit button or its native-control-matching style (already correct from the prior round) — only the layer picker's construction changes in this spec.
- Items reported as "zoom-to-fit style still the same" and "swipe-down doesn't close" are not addressed here pending the user re-testing after a hard reload of the deployed preview.
