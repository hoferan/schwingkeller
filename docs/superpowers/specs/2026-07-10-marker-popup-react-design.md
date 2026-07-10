# Render marker popup content as a real React component — design

## Problem

`popupHtml` in `src/features/map/markers.ts` builds the Leaflet marker
popup's content by concatenating raw HTML strings, passed to `bindPopup()`.
This means:

- Icons (indoor/outdoor tags, the details-button arrow) are hand-embedded
  inline `<svg>` markup with manually copied path data (`svgIcon`,
  `homeIcon`, `mountainIcon`, `arrowRightIcon`), instead of importing
  `lucide-react` components like the rest of the app does.
- The "Details" button uses a `data-detail="<id>"` attribute plus manual DOM
  event delegation (`MapView.tsx`'s `onPopupOpen`, which queries
  `[data-detail]` on every `popupopen` and assigns `.onclick`), instead of a
  plain `onClick`.
- No type safety inside the popup markup, and no reuse of the
  `CSSProperties`/`theme.ts` styling pattern used everywhere else
  (`DetailModal.tsx` is the closest sibling).

This is a follow-up from #8, where the popup's text-glyph icons were
replaced with hand-embedded inline SVGs as a minimal fix. This issue (#19)
tracks the deferred, more thorough refactor to a real mounted React
component.

## Approach

`L.Marker.bindPopup()` accepts an `HTMLElement` as content, not just a
string. A real React root is mounted into an empty container div and passed
to `bindPopup()`, giving the popup a genuine JSX component built the same
way as the rest of the app (real icon imports, real `onClick`, real
`CSSProperties`).

Two other approaches were considered and rejected:

- **Eager mount on marker creation** — mount every marker's popup root
  immediately in `refreshMarkers()`, matching today's timing 1:1. Simpler,
  but pays full React-mount/unmount cost for every marker on every
  venues/language change, even for popups nobody opens. Rejected in favor
  of mounting lazily.
- **Switch to `react-leaflet`'s declarative `<Marker>`/`<Popup>`** — the
  most idiomatic long-term fit, but incompatible with
  `leaflet.markercluster` (an imperative-only plugin), which this app
  relies on for clustering. A bigger architectural change than this issue's
  scope. Not pursued.

## Scope boundary

Only the **popup** content changes. `pinHtml` (the colored pin dot) and
`clusterIcon` (the cluster-count bubble) in `markers.ts` stay exactly as
they are today — they're non-interactive `divIcon` HTML with no icons,
buttons, or event handlers to gain from React.

## Component: `MarkerPopup.tsx` (new file, `src/features/map/`)

A plain function component styled like `DetailModal.tsx`: module-level
`CSSProperties` consts built from `theme.ts` tokens, real `lucide-react`
icons (`Home`, `Mountain`, `ArrowRight`) instead of hand-embedded SVG path
data, and a real `onClick` prop instead of `data-detail`.

```ts
interface MarkerPopupProps {
  venue: Venue;
  t: T; // typeof STR.de
  onDetail: () => void;
}
```

Renders exactly what `popupHtml` renders today: photo strip (or "FOTO"
placeholder), canton Wappen + name, address, indoor/outdoor tags, and the
"Details" button. Visual output stays pixel-equivalent — this is a
refactor, not a redesign.

## Mounting & lifecycle (in `MapView.tsx`'s `refreshMarkers`)

Mounting is **lazy**: the React root is created only when a marker's popup
actually opens, and unmounted when it closes. This avoids mounting/
unmounting a React root for every marker on every venues/language change
when most popups are never viewed.

Per marker, in the same `forEach` that already wires `m.on('click', ...)`:

```ts
const container = document.createElement('div');
let root: Root | null = null;
m.bindPopup(container, { maxWidth: 240, minWidth: 222, closeButton: true });
m.on('popupopen', () => {
  root = createRoot(container);
  root.render(
    <MarkerPopup venue={v} t={tRef.current} onDetail={() => onOpenDetailRef.current(v.id)} />
  );
  m.getPopup()?.update(); // see note below
});
m.on('popupclose', () => {
  root?.unmount();
  root = null;
});
```

**Layout note:** Leaflet computes a popup's size/position *before* firing
`popupopen` (based on whatever content was already bound — here, the empty
container). Mounting React content inside the `popupopen` handler changes
the container's size after that computation, so `m.getPopup()?.update()` is
called right after `root.render()` to force Leaflet to recompute layout
against the real content. Without this, the popup would visibly render
undersized/clipped on first open.

**Cleanup:** Leaflet fires `popupopen`/`popupclose` on the marker itself
(not just the map), so no map-level event delegation is needed for mount/
unmount. `refreshMarkers()` already calls `group.clearLayers()` on every
venues/language change, which removes each marker; Leaflet's
marker-removal path closes any open popup first, so `popupclose` (and thus
`root.unmount()`) fires naturally — no root is ever leaked. The existing
map-unmount cleanup (`map.remove()` in `MapView.tsx`'s mount effect)
triggers the same removal path for any still-open popup.

This wiring lives inline in `MapView.tsx`'s `refreshMarkers`, next to the
existing per-marker event wiring, rather than as an extracted helper — it's
a single call site, consistent with how the rest of that function already
wires marker events directly.

It **replaces** the current `onPopupOpen` map handler
(`MapView.tsx`, the `[data-detail]` query + manual `.onclick` assignment)
entirely, since the click handler is now a plain React prop passed at
render time. `map.on('popupopen', onPopupOpen)` and the `onPopupOpen`
function are deleted.

## `markers.ts` changes

- `popupHtml`, `svgIcon`, `homeIcon`, `mountainIcon`, `arrowRightIcon` are
  deleted — superseded by `MarkerPopup.tsx`.
- `pinHtml` and `clusterIcon` are unchanged (see Scope boundary).

## Testing

`markers.test.ts` currently asserts against the `popupHtml` string
(`toContain('Emmental')`, `toContain('data-detail="1"')`). That function no
longer exists, so those two assertions move to a new
`MarkerPopup.test.tsx`, following the same React Testing Library pattern as
`DetailModal.test.tsx`:

- Renders `<MarkerPopup venue={venue} t={STR.de} onDetail={vi.fn()} />` and
  asserts the name, address, and indoor/outdoor tags appear.
- Fires a click on the "Details" button and asserts `onDetail` was called.

`markers.test.ts` keeps its `pinHtml` selected/unselected test unchanged.

No test is added for the mount/unmount wiring in `MapView.tsx`
(`createRoot`/`popupopen`/`popupclose`) — that's imperative Leaflet-DOM
integration glue, consistent with the rest of `MapView.tsx` (e.g.
`onClusterClick`, `focusVenue`), which has no unit test coverage today
either.

## Out of scope

- No i18n impact — no user-facing text changes (same strings, same `t`
  keys).
- No changes to `pinHtml` or `clusterIcon` (see Scope boundary).
- No new npm dependency — `createRoot` comes from `react-dom/client`,
  already a project dependency via `react-dom`.
