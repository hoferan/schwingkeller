import { describe, it, expect, vi, beforeEach } from 'vitest';

// An in-memory venue_photos table with the rules that matter here: the primary key and the
// six-photo trigger from 0004_venue_photos.sql. A test can make the next insert of a url fail
// before it writes, or after it writes with the response lost.
const { table, from } = vi.hoisted(() => {
  type Row = { id: string; venue_id: string; url: string; position: number };
  type Failure = { url: string; when: 'before' | 'after' };
  const table = { rows: [] as Row[], failures: [] as Failure[] };
  const lost = { data: null, error: { message: 'Failed to fetch', code: '' } };

  const insertRow = (row: Row) => {
    const failure = table.failures.find((f) => f.url === row.url);
    if (failure) table.failures.splice(table.failures.indexOf(failure), 1);
    if (failure?.when === 'before') return lost;
    if (table.rows.filter((r) => r.venue_id === row.venue_id).length >= 6) {
      return { data: null, error: { message: `venue ${row.venue_id} already has the maximum of 6 photos`, code: 'P0001' } };
    }
    if (table.rows.some((r) => r.id === row.id)) {
      return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
    }
    table.rows.push(row);
    return failure?.when === 'after' ? lost : { data: row, error: null };
  };

  const from = vi.fn(() => ({
    select: () => ({
      eq: async (_col: 'venue_id', venueId: string) => ({
        data: table.rows.filter((r) => r.venue_id === venueId).map(({ id, url, position }) => ({ id, url, position })),
        error: null,
      }),
    }),
    insert: (row: Row) => ({ select: () => ({ single: async () => insertRow(row) }) }),
    update: (patch: { position: number }) => ({
      eq: async (_col: 'id', id: string) => {
        const row = table.rows.find((r) => r.id === id);
        if (row) row.position = patch.position;
        return { error: null };
      },
    }),
    delete: () => ({
      eq: async (_col: 'id', id: string) => {
        table.rows = table.rows.filter((r) => r.id !== id);
        return { error: null };
      },
    }),
  }));
  return { table, from };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from } }));

import { syncVenuePhotos } from './api';
import type { VenuePhoto } from './types';

const photo = (id: string, position = 0): VenuePhoto => ({ id, url: 'url-' + id, position });
const stored = () =>
  table.rows
    .filter((r) => r.venue_id === 'v1')
    .sort((a, b) => a.position - b.position)
    .map((r) => r.id);

beforeEach(() => {
  table.rows = [];
  table.failures = [];
});

const seed = (...ids: string[]) => {
  table.rows = ids.map((id, i) => ({ ...photo(id, i), venue_id: 'v1' }));
};

// An edit form opened on the given photos. Each save sends the draft and remembers its ids,
// the way EditForm does across retries.
const openForm = (...openedIds: string[]) => {
  const opened = new Set(openedIds);
  const sent = new Set<string>();
  return (...draftIds: string[]) => {
    const draft = draftIds.map((id) => photo(id));
    for (const p of draft) sent.add(p.id);
    return syncVenuePhotos('v1', draft, { opened, sent });
  };
};

describe('syncVenuePhotos', () => {
  it('inserts a new photo under its own id at its place in the draft', async () => {
    seed('p1', 'p2');
    await openForm('p1', 'p2')('p1', 'new', 'p2');
    expect(stored()).toEqual(['p1', 'new', 'p2']);
  });

  it('deletes photos taken out of the draft', async () => {
    seed('p1', 'p2');
    await openForm('p1', 'p2')('p1');
    expect(stored()).toEqual(['p1']);
  });

  it('moves stored photos to their place in the draft', async () => {
    seed('p1', 'p2', 'p3');
    await openForm('p1', 'p2', 'p3')('p3', 'p1', 'p2');
    expect(stored()).toEqual(['p3', 'p1', 'p2']);
  });

  it('makes room before adding, so a full gallery can swap a photo', async () => {
    seed('p1', 'p2', 'p3', 'p4', 'p5', 'p6');
    await openForm('p1', 'p2', 'p3', 'p4', 'p5', 'p6')('p1', 'p2', 'p3', 'p4', 'p5', 'new');
    expect(stored()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'new']);
  });

  // Perch Scan: four stored photos, two added, the second insert fails. The retry inserted the
  // first one again, filling the gallery, and the second one then hit the six-photo limit.
  it('finishes a save that failed partway without storing a photo twice', async () => {
    seed('p1', 'p2', 'p3', 'p4');
    const save = openForm('p1', 'p2', 'p3', 'p4');
    table.failures = [{ url: 'url-b', when: 'before' }];

    await expect(save('p1', 'p2', 'p3', 'p4', 'a', 'b')).rejects.toThrow('Failed to fetch');
    await save('p1', 'p2', 'p3', 'p4', 'a', 'b');

    expect(stored()).toEqual(['p1', 'p2', 'p3', 'p4', 'a', 'b']);
  });

  it('does not store a photo twice when its insert went through but the answer was lost', async () => {
    seed('p1');
    const save = openForm('p1');
    table.failures = [{ url: 'url-a', when: 'after' }];

    await expect(save('p1', 'a')).rejects.toThrow('Failed to fetch');
    await save('p1', 'a');

    expect(stored()).toEqual(['p1', 'a']);
  });

  it('deletes a photo an earlier attempt stored once the editor has taken it out again', async () => {
    seed('p1');
    const save = openForm('p1');
    table.failures = [{ url: 'url-b', when: 'before' }];

    await expect(save('p1', 'a', 'b')).rejects.toThrow('Failed to fetch');
    await save('p1', 'b');

    expect(stored()).toEqual(['p1', 'b']);
  });

  describe('while someone else edits the same venue', () => {
    it('keeps photos they added after this form opened', async () => {
      seed('p1', 'p2', 'theirs');
      await openForm('p1', 'p2')('p2', 'p1');
      expect(stored()).toEqual(['p2', 'p1', 'theirs']);
    });

    it('does not bring back a photo they deleted after this form opened', async () => {
      seed('p1');
      await openForm('p1', 'p2')('p1', 'p2');
      expect(stored()).toEqual(['p1']);
    });

    it('refuses a new photo rather than make room by deleting theirs', async () => {
      seed('p1', 'p2', 'p3', 'p4', 'theirs1', 'theirs2');
      await expect(openForm('p1', 'p2', 'p3', 'p4')('p1', 'p2', 'p3', 'p4', 'new')).rejects.toThrow(
        'maximum of 6 photos',
      );
      expect(stored()).toEqual(['p1', 'p2', 'p3', 'p4', 'theirs1', 'theirs2']);
    });
  });
});
