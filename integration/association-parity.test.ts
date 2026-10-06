import { describe, expect, it } from 'vitest';
import { ASSOCIATIONS, HOME_AREAS } from '../src/data/associations';
import { anonClient } from '../test-support/local-stack';

// The frontend carries the association tree as static data (src/data/associations.ts). The database
// is the authority, so a migration that changes the tree without the frontend, or the reverse, fails
// here.
const anon = anonClient();
const byKey = (a: string, b: string) => a.localeCompare(b);

describe('the association tree in the frontend', () => {
  it('matches the associations in the database', async () => {
    const { data, error } = await anon.from('associations').select('id, parent_id, level, sort_order');
    if (error) throw new Error(`reading associations failed: ${error.message}`);
    const db = data.map((r) => `${r.id}|${r.parent_id}|${r.level}|${r.sort_order}`).sort(byKey);
    const ours = ASSOCIATIONS.map((a) => `${a.id}|${a.parentId}|${a.level}|${a.sortOrder}`).sort(byKey);
    expect(ours).toEqual(db);
  });

  it('matches the home areas in the database', async () => {
    const { data, error } = await anon.from('association_home_areas').select('canton, bern_district, association_id');
    if (error) throw new Error(`reading association_home_areas failed: ${error.message}`);
    const db = data.map((r) => `${r.canton}|${r.bern_district}|${r.association_id}`).sort(byKey);
    const ours = HOME_AREAS.map((h) => `${h.canton}|${h.bernDistrict}|${h.associationId}`).sort(byKey);
    expect(ours).toEqual(db);
  });
});
