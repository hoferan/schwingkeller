import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANTON_BOUNDS } from './cantonBounds';
import { cantonByCode } from './cantons';

// supabase/seed.sql is the fixture behind `docker compose up` and any manual or end-to-end run
// against the local stack. Its coordinates are hand-picked, so nothing but a check like this stops
// a venue filed under one canton from sitting in another — which would quietly misframe the canton
// poster and make a label collision impossible to reproduce.
const SEED_PATH = resolve(process.cwd(), 'supabase/seed.sql');

interface SeedRow { name: string; canton: string; lat: number; lng: number }

// Matches the leading columns of each VALUES tuple: name, canton, address, lat, lng.
const ROW_RE = /\('([^']*)','([A-Z]{2})','[^']*',(-?\d+\.?\d*),(-?\d+\.?\d*)/g;

const seedRows = (): SeedRow[] => {
  const sql = readFileSync(SEED_PATH, 'utf8');
  return [...sql.matchAll(ROW_RE)].map(([, name, canton, lat, lng]) => ({
    name, canton, lat: Number(lat), lng: Number(lng),
  }));
};

describe('supabase/seed.sql', () => {
  const rows = seedRows();

  it('parses into rows', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it('files every venue under a real canton', () => {
    rows.forEach((row) => {
      expect(cantonByCode(row.canton), `${row.name} has canton "${row.canton}"`).toBeDefined();
    });
  });

  it('puts every venue inside the bounds of the canton it claims', () => {
    rows.forEach(({ name, canton, lat, lng }) => {
      const [[south, west], [north, east]] = CANTON_BOUNDS[canton];
      expect(lat, `${name} (${canton}) latitude`).toBeGreaterThanOrEqual(south);
      expect(lat, `${name} (${canton}) latitude`).toBeLessThanOrEqual(north);
      expect(lng, `${name} (${canton}) longitude`).toBeGreaterThanOrEqual(west);
      expect(lng, `${name} (${canton}) longitude`).toBeLessThanOrEqual(east);
    });
  });
});
