import { HOME_AREAS, type CantonalId } from './associations';
import { CANTON_BOUNDS, type CantonBounds } from './cantonBounds';

// A box per cantonal association, used only to frame an association that has no venues yet. One
// with venues is always framed to its venues.
//
// The six Bernese Gaue are the union of their Verwaltungskreise, queried once from swisstopo's
// swissBOUNDARIES3D district layer on 2026-10-06 (geo.admin.ch MapServer/find on
// ch.swisstopo.swissboundaries3d-bezirk-flaeche.fill, sr=4326), rounded outward to 5 decimals.
// swisstopo names the districts Jura bernois, Biel/Bienne, Seeland, Oberaargau, Emmental,
// Bern-Mittelland, Thun, Frutigen-Niedersimmental, Interlaken-Oberhasli and Obersimmental-Saanen.
// Re-run that query to refresh them, as ADR 0006 describes for the canton boxes.
const BERNESE_GAUE = {
  'berner-jura': [[47.05885, 6.86264], [47.3453, 7.5722]],
  emmental: [[46.7864, 7.50415], [47.16726, 7.9578]],
  mittelland: [[46.6704, 7.11468], [47.12233, 7.73362]],
  oberaargau: [[47.04736, 7.57951], [47.29337, 7.89191]],
  oberland: [[46.32639, 7.19303], [46.83613, 8.45693]],
  seeland: [[46.96943, 7.02539], [47.20726, 7.49707]],
} satisfies Partial<Record<CantonalId, CantonBounds>>;

const union = (a: CantonBounds, b: CantonBounds): CantonBounds => [
  [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
  [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
];

// Outside Bern, the union of the home cantons' boxes, computed here so it can't drift from
// CANTON_BOUNDS.
const outsideBern = HOME_AREAS.filter((h) => h.bernDistrict === null).reduce<Partial<Record<CantonalId, CantonBounds>>>(
  (acc, { canton, associationId }) => {
    const box = CANTON_BOUNDS[canton];
    const seen = acc[associationId];
    acc[associationId] = seen ? union(seen, box) : box;
    return acc;
  },
  {},
);

export const ASSOCIATION_HOME_BOUNDS = { ...outsideBern, ...BERNESE_GAUE } as Record<CantonalId, CantonBounds>;
