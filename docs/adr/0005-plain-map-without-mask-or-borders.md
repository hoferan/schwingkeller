---
status: accepted
date: 2026-07-08
decision-makers: André Hofer
---

# Show a plain map, without a mask outside Switzerland or canton borders

## Context and problem statement

The first version dimmed everything outside Switzerland and drew canton lines, both built from
`public/cantons.geojson`. The AFLS site the restyle took as reference shows a plain map. The mask had been
a deliberate feature ("keeps focus on the country"), and it was dropped on purpose to get a map
that looks the same everywhere, like the reference.

## Considered options

* Keep the mask and the canton lines
* CartoDB Positron tiles for a lighter look
* Colour-coded canton regions
* Plain OpenStreetMap tiles and Esri imagery, with no overlays

## Decision outcome

Chosen option: plain tiles and no overlays.

* The map layer is `tile.openstreetmap.org`.
* The satellite layer is Esri World Imagery without its road and label overlays.
* There's no mask and no canton boundary on the map. Canton grouping lives only in the sidebar.
* Positron didn't match the classic OpenStreetMap look, and colour-coded regions weren't brought
  back.

### Consequences

* Good, because the map is quieter and loads no geometry.
* Bad, because the app depends on the OpenStreetMap tile usage policy, with no fallback provider. If
  traffic grows, tile hosting needs another look. CI stubs the tiles (`e2e/fixtures.ts`) because the
  policy doesn't cover automated traffic.
* `public/cantons.geojson` is no longer loaded by anything. Issue
  [#72](https://github.com/hoferan/schwingkeller/issues/72) removes it.

## More information

`src/features/map/tileSources.ts`, `src/features/map/MapView.tsx`
