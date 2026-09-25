import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, deleteVenuesNamed, signInAsAdmin } from '../test-support/local-stack';
import { INT_PREFIX, insertVenue, newVenueRow, seedVenue } from './support';

let admin: SupabaseClient;
const anon = anonClient();

beforeAll(async () => {
  admin = await signInAsAdmin(ADMIN.email, ADMIN.password);
});

afterEach(async () => {
  await deleteVenuesNamed(admin, INT_PREFIX);
});

describe('venues as an anonymous visitor', () => {
  it('reads the venues', async () => {
    const { data, error } = await anon.from('venues').select('id, name').limit(5);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it('reads venues together with their photos', async () => {
    // The query that failed in production before 0006 granted SELECT on venue_photos.
    const { error } = await anon.from('venues').select('id, venue_photos(id, url, position)').limit(5);
    expect(error).toBeNull();
  });

  it('cannot insert a venue', async () => {
    const { error } = await anon.from('venues').insert(newVenueRow('anon insert'));
    expect(error?.message).toMatch(/permission denied for table venues/);
  });

  it('cannot change a venue', async () => {
    const seed = await seedVenue(admin);
    const { error } = await anon.from('venues').update({ address: 'changed by anon' }).eq('id', seed.id);
    expect(error?.message).toMatch(/permission denied for table venues/);
    const { data } = await admin.from('venues').select('address').eq('id', seed.id).single();
    expect(data?.address).toBe(seed.address);
  });

  it('cannot delete a venue', async () => {
    const seed = await seedVenue(admin);
    const { error } = await anon.from('venues').delete().eq('id', seed.id);
    expect(error?.message).toMatch(/permission denied for table venues/);
    const { data } = await admin.from('venues').select('id').eq('id', seed.id);
    expect(data).toHaveLength(1);
  });
});

describe('venues as the signed-in admin', () => {
  it('inserts, changes and deletes a venue', async () => {
    const venue = await insertVenue(admin, 'admin write');

    const { error: updateError } = await admin
      .from('venues')
      .update({ address: 'Hauptstrasse 1' })
      .eq('id', venue.id);
    expect(updateError).toBeNull();
    const { data: changed } = await admin.from('venues').select('address').eq('id', venue.id).single();
    expect(changed?.address).toBe('Hauptstrasse 1');

    const { error: deleteError } = await admin.from('venues').delete().eq('id', venue.id);
    expect(deleteError).toBeNull();
    const { data: gone } = await admin.from('venues').select('id').eq('id', venue.id);
    expect(gone).toHaveLength(0);
  });
});
