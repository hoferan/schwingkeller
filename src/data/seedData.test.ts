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
// The association tree lives in this migration. Until #65 adds it to the frontend, the test reads
// the allowed ids and each canton's home association from there, so there is no second list.
const ASSOCIATIONS_PATH = resolve(process.cwd(), 'supabase/migrations/0008_associations.sql');

interface SeedRow { name: string; canton: string; lat: number; lng: number; associationId?: string }

// Matches the leading columns of each VALUES tuple: name, canton, address, lat, lng.
const ROW_RE = /\('([^']*)','([A-Z]{2})','[^']*',(-?\d+\.?\d*),(-?\d+\.?\d*)/g;

// Matches a whole VALUES tuple whose last value is a slug: name and association_id.
const ASSOCIATION_RE = /^\('([^']*)','[A-Z]{2}',.*,'([a-z-]+)'\)[,;]?\s*$/gm;

const seedRows = (): SeedRow[] => {
  const sql = readFileSync(SEED_PATH, 'utf8');
  const associationOf = new Map([...sql.matchAll(ASSOCIATION_RE)].map(([, name, id]) => [name, id]));
  return [...sql.matchAll(ROW_RE)].map(([, name, canton, lat, lng]) => ({
    name, canton, lat: Number(lat), lng: Number(lng), associationId: associationOf.get(name),
  }));
};

const migration = readFileSync(ASSOCIATIONS_PATH, 'utf8');
const CANTONAL_IDS = [...migration.matchAll(/\('([a-z-]+)', '[a-z]+', 'cantonal'/g)].map(([, id]) => id);
const HOME: Record<string, string> = Object.fromEntries(
  [...migration.matchAll(/\('([A-Z]{2})', null, '([a-z-]+)'\)/g)].map(([, canton, id]) => [canton, id]),
);

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

  it('reads the 29 cantonal associations from the migration', () => {
    expect(CANTONAL_IDS).toHaveLength(29);
  });

  it('gives every venue a cantonal association', () => {
    rows.forEach((row) => {
      expect(CANTONAL_IDS, `${row.name} has association "${row.associationId}"`).toContain(row.associationId);
    });
  });

  // The cross-border case: a club can belong to the association of a neighbouring canton.
  it('has a venue whose association lies outside its canton', () => {
    expect(rows.some((r) => r.associationId && r.canton !== 'BE' && HOME[r.canton] !== r.associationId)).toBe(true);
  });
});
