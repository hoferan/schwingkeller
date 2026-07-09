# UI Polish: Drag Handle, Venue List Cards, Map Controls

## Context

Follow-up polish pass after the AFLS fidelity-fix round, based on user feedback on the deployed mobile preview (screenshot of the bottom-sheet drawer). Four small, independent visual fixes:

1. The mobile drawer's drag handle is too small to notice/grab.
2. The venue list rows (under each canton) look too plain/flat and don't establish clear visual hierarchy between selected and unselected items.
3. The map/satellite layer picker and the zoom-to-fit button don't visually match Leaflet's own native zoom control (+/-).
4. The zoom-to-fit button should be repositioned to sit directly under the native zoom control, rather than sharing a box with the layer picker at top-right.

Scope is limited to `src/features/sidebar/Sidebar.tsx` and `src/features/map/MapView.tsx` (plus a couple of hover-state CSS rules in `src/index.css`). No new npm dependencies, no i18n changes, no data/behavior changes — purely visual/layout.

## 1. Drag handle (Sidebar.tsx)

Current: a `44px × 5px` pill bar inside a wrapper with `padding: '9px 0 5px'`.

Change:
- Bar size: `44×5px` → `56×6px`.
- Wrapper padding: `'9px 0 5px'` → `'14px 0 12px'`, enlarging the clickable/tappable header area along with the visible bar.

No behavior change — `onClick={onToggleSidebar}` stays as-is.

## 2. Venue list rows (Sidebar.tsx)

Current `rowStyle`: flat row, `borderLeft: 2px solid` (accent if selected, else line), background `paper` if selected else `transparent`, tight padding (`9px 10px 9px 12px`), 3px vertical margin, bare `›` chevron glyph.

Change — each row becomes a bordered card:
- `background: theme.color.bg` always (white), `border: '1px solid ' + theme.color.line`, `borderRadius: theme.radius.sm` (drop the borderLeft-accent-bar approach).
- Padding `13px 14px` (was `9px 10px 9px 12px`); margin `7px 0` (was `3px 0`) for clearer separation between cards.
- Selected state: `border: '1.5px solid ' + theme.color.accent`, `background: theme.color.paper`, `boxShadow: theme.shadow` — the shadow is selected-only, so the list stays visually calm while the active item clearly lifts off the page. Unselected rows get no shadow.
- Name text: `13px` → `14px` (fontWeight 600 unchanged). Address/town text: `11.5px` → `12px` (unchanged color/weight).
- Chevron: replace the bare `›` glyph with a small `22px` circular badge (`background: theme.color.paper`, `color: theme.color.accent`, flex `none`, centered `›`), giving the tap affordance more visual weight. On a selected row (background already `paper`), the badge uses `theme.color.bg` instead so it still stands out against the row's own background.

No behavior change — `onClick={() => onSelect(v.id)}` stays as-is.

## 3 & 4. Map controls (MapView.tsx)

### Rationale for a one-off "native control" style

Leaflet's built-in zoom control (`.leaflet-bar` / `.leaflet-control-zoom-*` in `leaflet.css`) uses: white background, `4px` border-radius, `box-shadow: 0 1px 5px rgba(0,0,0,.65)`, buttons stacked with a `1px solid #ccc` divider between them. This is deliberately sharper/flatter than the app's own soft-card language (`theme.radius.sm` = 10px, `theme.shadow` = `0 4px 16px rgba(0,0,0,.12)`), and the whole point of this task is to make our custom controls blend in with Leaflet's native one — so we introduce a small local style object (not new theme tokens) that mirrors Leaflet's own literal values:

```ts
const nativeCtrlStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '4px',
  boxShadow: '0 1px 5px rgba(0,0,0,.65)',
  overflow: 'hidden',
};
```

Colors for text/icons inside these controls stay on `theme.color.ink` (already near-black, `#111111`) rather than introducing a separate literal `#000`. The divider between stacked rows/buttons uses `theme.color.line` (`#e2e2e2`) — close enough to Leaflet's own `#ccc` to read as "native," while staying inside the app's existing palette.

A small CSS rule is added to `src/index.css` for the native-look hover state (`background-color: #f4f4f4` on hover, matching `leaflet-bar a:hover`), applied via a new `.sk-native-ctrl-btn` class, since inline styles can't express `:hover`.

### Layer picker (map/satellite)

Stays top-right. Structural change only:
- Outer wrapper (`layerCardStyle`) becomes `nativeCtrlStyle` + `display: flex, flexDirection: column` (drop the old padded card + pill shadow).
- Each `<label>` row gets its own padding (`8px 12px`) since the card no longer supplies uniform padding; the first row gets `borderBottom: '1px solid ' + theme.color.line` to act as the divider between the two options (map/satellite), the second row has none.
- Radio `<input>` stays a native `<input type="radio">` (per the earlier round's decision to keep native inputs) — only the surrounding chrome changes.

### Zoom-to-fit button

Moves from the top-right stack to a new standalone control at top-left, positioned directly beneath Leaflet's native zoom control:
- New wrapper div using `nativeCtrlStyle`, containing a single `30×30px` borderless button (the `nativeCtrlStyle` box supplies the shape/shadow/radius; the button itself has `background: transparent`, `border: none`).
- Position: `position: absolute; left: 10px` (matching Leaflet's own `10px` left margin for top-left controls) and a `top` value computed at runtime — not hardcoded — because Leaflet's zoom control renders at `26px` tall on desktop/mouse or `30px` tall in touch mode, and hardcoding one would misalign in the other.
  - After the map mounts, read `map.zoomControl.getContainer()` and store its `offsetHeight` in a ref.
  - Computed top = `10 (Leaflet's own top margin) + zoomControlHeight + 10 (gap matching Leaflet's own control-to-control spacing)`.
  - This is computed once after mount (zoom control height doesn't change afterward) and used as the fit-button wrapper's inline `top` style, with a `46px` fallback (10+26+10, the non-touch case) before the measurement effect runs, to avoid a layout flash.

No behavior change — same `flyToBounds` call on click.

## Out of scope

- No changes to `registerFitAll` wiring, translations, or the map/satellite switching logic itself — purely visual/positional.
- No attempt to pixel-match Leaflet's `leaflet-touch` breakpoint for the layer picker's own size (only the fit button's position depends on it) — the layer picker's row height is driven by its own padding, not by mimicking the exact 26/30px button box.
