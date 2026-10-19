import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, deleteVenuesNamed, signInAsAdmin } from '../test-support/local-stack';
import { INT_PREFIX, insertVenue, seedVenue, signInAs } from './support';

let admin: SupabaseClient;
const anon = anonClient();
const photo = (venueId: string, position: number) => ({
  venue_id: venueId,
  url: `https://example.invalid/int-${position}.png`,
  position,
});

beforeAll(async () => {
  admin = await signInAsAdmin(ADMIN.email, ADMIN.password);
});

// Deleting the venue removes its photos (on delete cascade).
afterEach(async () => {
  await deleteVenuesNamed(admin, INT_PREFIX);
});

describe('venue photos', () => {
  it('can be read anonymously', async () => {
    const { error } = await anon.from('venue_photos').select('id').limit(1);
    expect(error).toBeNull();
  });

  it('cannot be added anonymously', async () => {
    const seed = await seedVenue(admin);
    const { error } = await anon.from('venue_photos').insert(photo(seed.id, 0));
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table venue_photos/);
  });

  it('stop at six per venue', async () => {
    const venue = await insertVenue(admin, 'photo limit');
    // One insert per photo: the trigger counts the rows that already exist.
    for (let position = 0; position < 6; position++) {
      const { error } = await admin.from('venue_photos').insert(photo(venue.id, position));
      expect(error, `photo ${position + 1}`).toBeNull();
    }
    const { error } = await admin.from('venue_photos').insert(photo(venue.id, 6));
    expect(error?.message ?? '(no error)').toMatch(/maximum of 6 photos/);
  });
});

describe('venue photos by scope', () => {
  const RLS = /row-level security policy for table "venue_photos"/;
  let bksv: SupabaseClient;
  let emmental: SupabaseClient;

  beforeAll(async () => {
    [bksv, emmental] = await Promise.all([signInAs('bksv'), signInAs('emmental')]);
  });

  it('lets a bksv editor add a photo to an emmental venue', async () => {
    const venue = await insertVenue(admin, 'photo emmental', { association_id: 'emmental' });
    const { error } = await bksv.from('venue_photos').insert(photo(venue.id, 0));
    expect(error).toBeNull();
  });

  it('refuses a bksv editor a photo on a luzern venue', async () => {
    const venue = await insertVenue(admin, 'photo luzern', { association_id: 'luzern' });
    const { error } = await bksv.from('venue_photos').insert(photo(venue.id, 0));
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });

  it("leaves an oberland venue's photo alone when an emmental editor reorders or deletes it", async () => {
    const venue = await insertVenue(admin, 'photo oberland', { association_id: 'oberland' });
    const added = await admin.from('venue_photos').insert(photo(venue.id, 0)).select('id').single();
    expect(added.error).toBeNull();
    const id = added.data?.id as string;

    const upd = await emmental.from('venue_photos').update({ position: 3 }).eq('id', id).select('id');
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);
    const del = await emmental.from('venue_photos').delete().eq('id', id).select('id');
    expect(del.error).toBeNull();
    expect(del.data).toEqual([]);

    const { data } = await admin.from('venue_photos').select('position').eq('id', id).single();
    expect(data?.position).toBe(0);
  });

  it('refuses a bksv editor moving a photo from an emmental venue to a luzern venue', async () => {
    const from = await insertVenue(admin, 'photo move from', { association_id: 'emmental' });
    const to = await insertVenue(admin, 'photo move to', { association_id: 'luzern' });
    const added = await admin.from('venue_photos').insert(photo(from.id, 0)).select('id').single();
    const id = added.data?.id as string;

    const { error } = await bksv.from('venue_photos').update({ venue_id: to.id }).eq('id', id);
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });
});
