import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, deleteVenuesNamed, signInAsAdmin } from '../test-support/local-stack';
import { INT_PREFIX, insertVenue, newVenueRow } from './support';

let admin: SupabaseClient;
const anon = anonClient();

beforeAll(async () => {
  admin = await signInAsAdmin(ADMIN.email, ADMIN.password);
});

// The 26 cantons as in venues.canton. Listed here rather than imported from src/data/cantons.ts,
// which reads import.meta.env and so doesn't typecheck in the Node-only test projects.
const CANTON_CODES = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL',
  'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU',
];

type Association = { id: string; parent_id: string | null; level: string };
type HomeArea = { canton: string; bern_district: string | null; association_id: string };

const associations = async (): Promise<Association[]> => {
  const { data, error } = await anon.from('associations').select('id, parent_id, level');
  if (error) throw new Error(`reading associations failed: ${error.message}`);
  return data;
};

const homeAreas = async (): Promise<HomeArea[]> => {
  const { data, error } = await anon.from('association_home_areas').select('canton, bern_district, association_id');
  if (error) throw new Error(`reading association_home_areas failed: ${error.message}`);
  return data;
};

describe('the association tree as an anonymous visitor', () => {
  it('has one federation, five regional and 29 cantonal associations', async () => {
    const rows = await associations();
    const count = (level: string) => rows.filter((r) => r.level === level).length;
    expect([count('federation'), count('regional'), count('cantonal')]).toEqual([1, 5, 29]);
    expect(rows.find((r) => r.level === 'federation')).toEqual({ id: 'esv', parent_id: null, level: 'federation' });
  });

  it('hangs every regional association under esv and every cantonal one under a regional one', async () => {
    const rows = await associations();
    const levelOf = new Map(rows.map((r) => [r.id, r.level]));
    rows.filter((r) => r.level === 'regional').forEach((r) => expect(r.parent_id, r.id).toBe('esv'));
    rows
      .filter((r) => r.level === 'cantonal')
      .forEach((r) => expect(levelOf.get(r.parent_id ?? ''), `parent of ${r.id}`).toBe('regional'));
  });

  it('has the three levels with depths 0, 1 and 2', async () => {
    const { data, error } = await anon.from('association_levels').select('id, depth').order('depth');
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: 'federation', depth: 0 },
      { id: 'regional', depth: 1 },
      { id: 'cantonal', depth: 2 },
    ]);
  });

  it('has a home area for every canton, and ten Bernese districts', async () => {
    const rows = await homeAreas();
    const cantonRows = rows.filter((r) => r.bern_district === null);
    CANTON_CODES.filter((code) => code !== 'BE').forEach((code) => {
      expect(cantonRows.filter((r) => r.canton === code), code).toHaveLength(1);
    });
    expect(cantonRows.filter((r) => r.canton === 'BE')).toHaveLength(0);
    expect(rows.filter((r) => r.canton === 'BE' && r.bern_district !== null)).toHaveLength(10);

    const home = (canton: string, district: string | null = null) =>
      rows.find((r) => r.canton === canton && r.bern_district === district)?.association_id;
    expect(home('BE', 'Thun')).toBe('oberland');
    expect([home('AR'), home('AI')]).toEqual(['appenzell', 'appenzell']);
    expect([home('OW'), home('NW')]).toEqual(['ob-nidwalden', 'ob-nidwalden']);
  });
});

// The structure changes only through migrations, so nobody gets a write grant on it.
const WRITES: Record<string, { insert: object; update: object; match: [string, string] }> = {
  association_levels: { insert: { id: 'club', depth: 3 }, update: { depth: 9 }, match: ['id', 'cantonal'] },
  associations: {
    insert: { id: 'nowhere', parent_id: 'esv', level: 'regional', name: 'Nowhere', short: 'NW', sort_order: 9 },
    update: { name: 'Renamed' },
    match: ['id', 'esv'],
  },
  association_home_areas: { insert: { canton: 'XX', association_id: 'zuerich' }, update: { association_id: 'uri' }, match: ['canton', 'ZH'] },
};

describe.each(Object.keys(WRITES))('%s', (table) => {
  it('refuses inserts, updates and deletes from anonymous visitors and from the admin', async () => {
    const { insert, update, match } = WRITES[table];
    const denied = new RegExp(`permission denied for table ${table}`);
    for (const client of [anon, admin]) {
      const inserted = await client.from(table).insert(insert);
      expect(inserted.error?.message ?? '(no error)').toMatch(denied);
      const updated = await client.from(table).update(update).eq(...match);
      expect(updated.error?.message ?? '(no error)').toMatch(denied);
      const deleted = await client.from(table).delete().eq(...match);
      expect(deleted.error?.message ?? '(no error)').toMatch(denied);
    }
  });
});

// RLS in the user-management milestone asks whether a venue's association lies within an editor's
// scope. Nothing calls this yet.
describe('association_is_within', () => {
  it.each([
    ['emmental', 'bksv', true],
    ['emmental', 'esv', true],
    ['emmental', 'emmental', true],
    ['emmental', 'isv', false],
    ['nowhere', 'esv', false],
    ['emmental', 'nowhere', false],
  ])('(%s, %s) is %s', async (node, scope, expected) => {
    const { data, error } = await anon.rpc('association_is_within', { node, scope });
    expect(error).toBeNull();
    expect(data).toBe(expected);
  });
});

describe('a venue association', () => {
  afterEach(async () => {
    await deleteVenuesNamed(admin, INT_PREFIX);
  });

  const associationOf = async (id: string) => {
    const { data, error } = await admin.from('venues').select('association_id').eq('id', id).single();
    if (error) throw new Error(`reading venue ${id} failed: ${error.message}`);
    return data.association_id as string | null;
  };

  it.each([
    ['bksv', 'regional'],
    ['esv', 'federation'],
  ])('cannot be the %s association, which is %s', async (id, level) => {
    const { error } = await admin.from('venues').insert({ ...newVenueRow('non-cantonal'), association_id: id });
    expect(error?.message ?? '(no error)').toBe(`association ${id} is ${level}; a venue needs a cantonal association`);
  });

  it('can be a cantonal association, and change to another one but not to a regional one', async () => {
    const venue = await insertVenue(admin, 'cantonal', { association_id: 'emmental' });
    expect(await associationOf(venue.id)).toBe('emmental');

    const moved = await admin.from('venues').update({ association_id: 'luzern' }).eq('id', venue.id);
    expect(moved.error).toBeNull();
    const raised = await admin.from('venues').update({ association_id: 'bksv' }).eq('id', venue.id);
    expect(raised.error?.message ?? '(no error)').toMatch(/association bksv is regional/);
    expect(await associationOf(venue.id)).toBe('luzern');
  });

  it('stays when an edit leaves it out', async () => {
    // Today's edit form sends no association_id.
    const venue = await insertVenue(admin, 'edit', { association_id: 'emmental' });
    const { error } = await admin.from('venues').update({ address: 'Hauptstrasse 1' }).eq('id', venue.id);
    expect(error).toBeNull();
    expect(await associationOf(venue.id)).toBe('emmental');
  });

  it('must exist', async () => {
    const { error } = await admin.from('venues').insert({ ...newVenueRow('unknown'), association_id: 'nowhere' });
    expect(error?.message ?? '(no error)').toMatch(/violates foreign key constraint "venues_association_id_fkey"/);
  });

  it('is readable for anonymous visitors', async () => {
    const { error } = await anon.from('venues').select('id, association_id').limit(1);
    expect(error).toBeNull();
  });
});
