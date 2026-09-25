import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, deleteVenuesNamed, signInAsAdmin } from '../test-support/local-stack';
import { INT_PREFIX, insertVenue, seedVenue } from './support';

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
    expect(error?.message).toMatch(/permission denied for table venue_photos/);
  });

  it('stop at six per venue', async () => {
    const venue = await insertVenue(admin, 'photo limit');
    // One insert per photo: the trigger counts the rows that already exist.
    for (let position = 0; position < 6; position++) {
      const { error } = await admin.from('venue_photos').insert(photo(venue.id, position));
      expect(error, `photo ${position + 1}`).toBeNull();
    }
    const { error } = await admin.from('venue_photos').insert(photo(venue.id, 6));
    expect(error?.message).toMatch(/maximum of 6 photos/);
  });
});
