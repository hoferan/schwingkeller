# UI Polish Round 2: Native Control Styling, Lucide Icons, Swipeable Drawer

## Context

Second follow-up polish round after live-preview feedback (the first round covered the drag handle, venue-list cards, and the native-style map controls). This round:

1. Tunes the native-look map controls introduced last round (drop their shadow, use a translucent border instead, align the zoom-to-fit button's width precisely with the native zoom control).
2. Replaces every hand-drawn icon SVG and plain-text glyph (`⌕`, `✕`, `▾`/`▸`, `›`, `＋`) across the app with `lucide-react` icons, for a single consistent icon language.
3. Makes the mobile bottom-sheet drawer swipeable (in addition to its existing tap-to-toggle) and adds a standard click-outside-to-close behavior.

Scope: `src/features/map/MapView.tsx`, `src/features/sidebar/Sidebar.tsx`, `src/components/Topbar.tsx`, `src/App.tsx`, `package.json` (new dependency). No i18n changes, no changes to `theme.ts` color/font/radius tokens, no changes to data-fetching or Supabase logic.

## Decisions from brainstorming

- **New dependency:** `lucide-react` is added as a real npm dependency (discussed and explicitly chosen over CDN-script or hand-copied-SVG alternatives). It's tree-shakeable — only the icons actually imported end up in the bundle.
- **Control border:** `1px solid rgba(0,0,0,.15)` (a faint black-ish translucent line, closer to the app's existing `theme.color.line` hairline-border feel than a stark white line).
- **Swipe zone:** the drag-handle + black title-block header, not the search box or venue list (so list scrolling is never hijacked).
- **Close-on-outside-tap:** a generic click-outside pattern (listens on `document`, checks the tap against the drawer's own DOM node via a ref) rather than hooking into Leaflet's map click handler — this also catches taps on the Topbar, not just the map, and keeps the change fully contained inside `Sidebar.tsx`.

## 1. Native control styling (`MapView.tsx`)

`nativeCtrlStyle` (shared by `layerCardStyle` and `fitAllWrapStyle`, introduced last round) changes from:

```ts
{ background: '#fff', borderRadius: '4px', boxShadow: '0 1px 5px rgba(0,0,0,.65)', overflow: 'hidden' }
```

to:

```ts
{ background: '#fff', borderRadius: '4px', border: '1px solid rgba(0,0,0,.15)', overflow: 'hidden' }
```

— shadow dropped entirely, translucent border added. Because both controls already consume this one constant, this single change cascades to both the layer picker and the zoom-to-fit button automatically; no other style object needs editing for this part.

## 2. Zoom-to-fit width/position alignment (`MapView.tsx`)

Currently the fit button is hardcoded to `30×30px`, matching Leaflet's *touch-mode* zoom-control size but not its *mouse-mode* size (`26px`) — so on a non-touch desktop the two boxes' edges don't quite line up. Fix: extend the existing runtime measurement (already reading the zoom control's rendered height for vertical positioning) to also read its `offsetWidth`, and size the fit button — both `width` and `height`, since it's square — to that measured value instead of a hardcoded `30`. `FIT_ALL_DEFAULT_TOP`'s sibling constant, a `FIT_ALL_DEFAULT_SIZE = 30`, provides the pre-measurement fallback (same reasoning as the existing top-offset fallback: avoids a layout flash before `map.whenReady` fires). The `left: '10px'` positioning is unaffected — Leaflet's own `10px` top-left control margin is a fixed CSS constant, not something that needs measuring.

## 3. Icon inventory — `lucide-react` replacing hand-drawn SVGs and text glyphs

All icons use lucide's default `currentColor` fill/stroke behavior, so each replacement inherits whatever CSS `color` the surrounding element already declares — no new color plumbing needed anywhere in this table.

| File | Location | Current | Replacement | Size |
|---|---|---|---|---|
| `Sidebar.tsx` | search box icon | `⌕` character | `<Search />` | `16` |
| `Sidebar.tsx` | search clear button | `✕` character | `<X />` | `12` |
| `Sidebar.tsx` | canton expand/collapse indicator | `▾` / `▸` characters | single `<ChevronRight />`, rotated `90deg` via inline `transform` when expanded (one icon reused, not two) | `12` |
| `Sidebar.tsx` | venue-row chevron badge | `›` character | `<ChevronRight />` | `14` |
| `Sidebar.tsx` | admin "add venue" button | `＋` character | `<Plus />` | `16` |
| `Sidebar.tsx` | admin export (JSON/CSV) buttons | hand-drawn `downloadIcon` SVG const | `<Download />` | `13` |
| `Sidebar.tsx` | admin import button | hand-drawn `uploadIcon` SVG const | `<Upload />` | `13` |
| `Topbar.tsx` | login/logout button | hand-drawn `lockIcon`/`unlockIcon` SVG consts | `<Lock />` / `<Unlock />` | `13` |
| `MapView.tsx` | zoom-to-fit button | hand-drawn corner-arrows SVG | `<Maximize />` | `18` |

The canton-toggle rotation gets a `transition: 'transform .2s ease'` alongside the existing expand/collapse state — a one-property CSS addition, not a new animation system.

This removes the `downloadIcon`, `uploadIcon`, `lockIcon`, `unlockIcon` SVG constants and the hand-drawn zoom-to-fit SVG entirely — every icon in the app now comes from one library.

## 4. Swipeable drawer + close-on-outside-tap (`Sidebar.tsx`, `App.tsx`)

**New prop:** `Sidebar` gains `onSetSidebarOpen: (open: boolean) => void`, wired in `App.tsx` to `setSidebarOpen` directly (today only a pure toggle, `onToggleSidebar`, exists — which can't express "definitely open" vs. "definitely closed", both of which the swipe direction and the outside-tap-close need). `onToggleSidebar` is unchanged and keeps handling the existing plain-tap behavior.

**Swipe:** the drag-handle + title-block wrapper div gets `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers (mobile-only, same as today's `isMobile &&` gate). `onTouchStart` records the starting `clientY`. `onTouchEnd` computes the net vertical delta:
- `|delta| < 10px` → treated as a tap: calls `onToggleSidebar()`, exactly today's behavior.
- `delta <= -30px` (swiped up) → calls `onSetSidebarOpen(true)`.
- `delta >= 30px` (swiped down) → calls `onSetSidebarOpen(false)`.
- Anything between 10px and 30px in either direction is a dead zone — no action, avoids accidental toggles from small hand tremor during a tap.

No live drag-follow visual (the drawer doesn't visually track the finger mid-gesture) — it snaps between its two existing states (`108px` peek / `80vh` open) using the same `transition: height .32s` it already has. This keeps the change additive and small rather than building a fully free-dragging bottom sheet.

**Close on outside tap:** `Sidebar` holds a ref on its own root div. A `useEffect` keyed on `isMobile && sidebarOpen` adds a `document`-level `pointerdown` listener exactly while that condition is true (removed on cleanup) that calls `onSetSidebarOpen(false)` if the event target is outside the ref'd node. Using `pointerdown` (not `click`) matches the standard click-outside pattern and unifies touch/mouse. Gating the listener's attachment on the `sidebarOpen` effect dependency means the same tap that opens the drawer can never immediately close it again (the listener doesn't exist yet at the moment that tap fires; it's attached by the effect that runs after the state update).

## Out of scope

- No changes to the drawer's two-state height model (`108px`/`80vh`) or its transition timing.
- No live drag-follow visual during swipe (see above).
- No changes to `theme.ts`, i18n keys, or any component's data/behavior beyond what's described above.
- No changes to the Leaflet map's own `click` handler or admin pin-placement logic (the revised close-on-outside-tap approach doesn't touch `MapView.tsx` at all for this part).
