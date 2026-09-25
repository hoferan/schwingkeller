---
status: accepted
date: 2026-07-10
decision-makers: André Hofer
---

# Drive Leaflet imperatively and render popups to static HTML

## Context and problem statement

Marker popups were built from hand-written HTML strings with SVG paths copied in. They were hard to
change and untested. The goal was to write them as a React component, without giving up
`leaflet.markercluster`.

## Considered options

* react-leaflet's declarative `<Marker>` and `<Popup>`
* Mount a React root for every marker up front
* Mount a React root lazily when a popup opens, with `createRoot`
* Write the popup as JSX and render it to a static HTML string

## Decision outcome

Chosen option: JSX rendered with `renderToStaticMarkup`.

* `MarkerPopup` is a normal component. `popupHtml` renders it to a string and passes it to Leaflet's
  `bindPopup`.
* The Details button carries a `data-detail` attribute. `MapView` handles clicks on it through event
  delegation on `popupopen`.
* The map, the clusters and the markers stay plain imperative Leaflet.
* react-leaflet's components don't work with `leaflet.markercluster`.
* Mounting a root for every marker pays the full React mount and unmount cost for every marker on
  every venue or language change.
* The lazy `createRoot` approach was the original plan and was built, then reverted in the same pull
  request ([#33](https://github.com/hoferan/schwingkeller/pull/33)). `render()` commits
  asynchronously, so Leaflet measured the popup before its content existed and sized it wrong. The
  fix, `flushSync`, was fragile.

### Consequences

* Good, because the popup is a tested component and still sizes correctly.
* Bad, because the popup can't hold React state or effects. Anything interactive in it has to be
  wired by delegation in `MapView`.
* The app doesn't use react-leaflet at all, so it isn't a dependency.

## More information

`src/features/map/MarkerPopup.tsx`, `src/features/map/markers.tsx`, `src/features/map/MapView.tsx`
