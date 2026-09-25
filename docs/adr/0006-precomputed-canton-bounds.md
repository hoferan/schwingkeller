---
status: accepted
date: 2026-07-10
decision-makers: André Hofer
---

# Precompute canton bounding boxes instead of shipping geometry

## Context and problem statement

Canton permalinks (`?ctn=`) need to fly the map to a canton, which needs its extent. `cantons.ts` had
codes and names but no coordinates.

## Considered options

* The `swiss-maps` npm package
* A live call to swisstopo or Nominatim when a link is opened
* Ship full polygons and compute the bounds at runtime
* Compute one bounding box per canton offline, once, and commit the numbers

## Decision outcome

Chosen option: offline bounding boxes in `src/data/cantonBounds.ts`.

* They're computed from swisstopo swissBOUNDARIES3D (January 2026, LV95 reprojected to WGS84, five
  decimal places).
* `swiss-maps` would have been a new dependency, and its data is licensed for non-commercial use
  only.
* A live call would add latency, a dependency on another service being up, and rate limits to every
  link.
* Full polygons carry precision nothing uses.

### Consequences

* Good, because opening a link costs no request and no parsing.
* Good, because the poster reuses the same boxes for its default framing.
* Bad, because regenerating them is a manual offline step. Cantonal borders almost never change, so
  it isn't part of the build.
* `cantonBounds.test.ts` checks that every canton has a box.

## More information

The [Verband hierarchy](https://github.com/hoferan/schwingkeller/milestone/1) milestone adds
similar precomputed boxes per Verband, used only for Verbände with no venues yet.
