import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ASSOCIATIONS } from './associations';
import { ASSOCIATION_HOME_BOUNDS } from './associationBounds';
import { CANTON_BOUNDS, type CantonBounds } from './cantonBounds';

const union = (a: CantonBounds, b: CantonBounds): CantonBounds => [
  [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
  [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
];

// The Gau boxes come from swisstopo's current district layer, the canton boxes from the January 2026
// dataset (ADR 0006). Their edges differ by up to about 0.002° (roughly 200 m), which this allows.
const EDGE_TOLERANCE = 0.002;
const within = ([[s, w], [n, e]]: CantonBounds, [[S, W], [N, E]]: CantonBounds, tol: number) =>
  s >= S - tol && w >= W - tol && n <= N + tol && e <= E + tol;

// Same parsing as seedData.test.ts: name, lat and lng from the leading columns, the association from
// the last value of each tuple.
const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8');
const seedVenues = [
  ...seed.matchAll(/^\('([^']*)','[A-Z]{2}','[^']*',(-?\d+\.?\d*),(-?\d+\.?\d*),.*,'([a-z-]+)'\)[,;]?\s*$/gm),
].map(([, name, lat, lng, associationId]) => ({ name, lat: Number(lat), lng: Number(lng), associationId }));

describe('ASSOCIATION_HOME_BOUNDS', () => {
  it('has a box for each of the 29 cantonal associations', () => {
    const cantonal = ASSOCIATIONS.filter((a) => a.level === 'cantonal').map((a) => a.id).sort();
    expect(Object.keys(ASSOCIATION_HOME_BOUNDS).sort()).toEqual(cantonal);
  });

  it('unites the home cantons outside Bern', () => {
    expect(ASSOCIATION_HOME_BOUNDS.appenzell).toEqual(union(CANTON_BOUNDS.AR, CANTON_BOUNDS.AI));
    expect(ASSOCIATION_HOME_BOUNDS['ob-nidwalden']).toEqual(union(CANTON_BOUNDS.OW, CANTON_BOUNDS.NW));
    expect(ASSOCIATION_HOME_BOUNDS.zuerich).toEqual(CANTON_BOUNDS.ZH);
  });

  it('keeps each Bernese Gau inside the canton of Bern', () => {
    (['berner-jura', 'emmental', 'mittelland', 'oberaargau', 'oberland', 'seeland'] as const).forEach((id) => {
      expect(within(ASSOCIATION_HOME_BOUNDS[id], CANTON_BOUNDS.BE, EDGE_TOLERANCE), id).toBe(true);
    });
  });

  // Schwingkeller Escholzmatt (LU, Emmental association) is the cross-border seed venue, yet it lies
  // inside the Emmental box: the Verwaltungskreis reaches east to the Entlebuch border. So the list of
  // exceptions is empty, and a venue added outside its association's box fails here.
  it('contains every seed venue in the box of its association', () => {
    // Every venue tuple must parse, or a row in another format would skip this check unnoticed.
    const tuples = [...seed.matchAll(/^\('[^']*','[A-Z]{2}',/gm)].length;
    expect(seedVenues).toHaveLength(tuples);
    const outside = seedVenues
      .filter(({ lat, lng, associationId }) => {
        const box = ASSOCIATION_HOME_BOUNDS[associationId as keyof typeof ASSOCIATION_HOME_BOUNDS];
        return !box || !within([[lat, lng], [lat, lng]], box, 0);
      })
      .map((v) => v.name);
    expect(outside).toEqual([]);
  });
});
