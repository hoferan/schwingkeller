import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, deleteVenuesNamed, signInAsAdmin } from '../test-support/local-stack';
import { INT_PREFIX, insertVenue, newVenueRow, seedVenue, signInAs } from './support';

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
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table venues/);
  });

  it('cannot change a venue', async () => {
    const seed = await seedVenue(admin);
    const { error } = await anon.from('venues').update({ address: 'changed by anon' }).eq('id', seed.id);
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table venues/);
    const { data } = await admin.from('venues').select('address').eq('id', seed.id).single();
    expect(data?.address).toBe(seed.address);
  });

  it('cannot delete a venue', async () => {
    const seed = await seedVenue(admin);
    const { error } = await anon.from('venues').delete().eq('id', seed.id);
    expect(error?.message ?? '(no error)').toMatch(/permission denied for table venues/);
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

  // 0009 dropped replace_venues (ADR 0018). The broken lat matters only if the function comes
  // back: the call then fails on the cast and rolls back, instead of deleting every venue.
  it('cannot call replace_venues, because it no longer exists', async () => {
    const { error } = await admin.rpc('replace_venues', {
      rows: [{ name: `${INT_PREFIX} replace`, canton: 'GR', lat: 'not-a-number', lng: 9.53 }],
    });
    expect(error?.code ?? '(no error)', error?.message).toBe('PGRST202');
  });
});

describe('venues by scope', () => {
  const RLS = /row-level security policy for table "venues"/;
  let bksv: SupabaseClient;
  let emmental: SupabaseClient;
  let pending: SupabaseClient;

  beforeAll(async () => {
    [bksv, emmental, pending] = await Promise.all([
      signInAs('bksv'),
      signInAs('emmental'),
      signInAs('pending'),
    ]);
  });

  const insertAs = (client: SupabaseClient, label: string, association_id: string) =>
    client.from('venues').insert({ ...newVenueRow(label), association_id });

  const addressOf = async (id: string) => {
    const { data } = await admin.from('venues').select('address, association_id').eq('id', id).single();
    return data;
  };

  it('lets a bksv editor insert venues in emmental and oberland', async () => {
    expect((await insertAs(bksv, 'bksv emmental', 'emmental')).error).toBeNull();
    expect((await insertAs(bksv, 'bksv oberland', 'oberland')).error).toBeNull();
  });

  it('refuses a bksv editor a venue in luzern', async () => {
    const { error } = await insertAs(bksv, 'bksv luzern', 'luzern');
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });

  it('lets an emmental editor insert an emmental venue', async () => {
    expect((await insertAs(emmental, 'emmental own', 'emmental')).error).toBeNull();
  });

  // The edit form picks a new venue's id, so a repeated Save can't create it twice.
  it('lets an emmental editor insert a venue under an id it chose, and only once', async () => {
    const row = { id: crypto.randomUUID(), ...newVenueRow('own id'), association_id: 'emmental' };
    const first = await emmental.from('venues').insert(row).select('id').single();
    expect(first.error).toBeNull();
    expect(first.data?.id).toBe(row.id);

    const again = await emmental.from('venues').insert(row);
    expect(again.error?.code).toBe('23505');
  });

  it("doesn't let a bksv editor take over a luzern venue by inserting under its id", async () => {
    const venue = await insertVenue(admin, 'luzern id', { association_id: 'luzern' });
    const { error } = await bksv
      .from('venues')
      .insert({ id: venue.id, ...newVenueRow('takeover'), association_id: 'emmental' });
    expect(error?.code).toBe('23505');
    expect(await addressOf(venue.id)).toMatchObject({ association_id: 'luzern' });
  });

  it.each(['oberland', 'luzern'])('refuses an emmental editor a venue in %s', async (association) => {
    const { error } = await insertAs(emmental, `emmental ${association}`, association);
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });

  it('leaves a luzern venue alone when a bksv editor updates or deletes it', async () => {
    const venue = await insertVenue(admin, 'luzern target', { association_id: 'luzern' });
    const upd = await bksv.from('venues').update({ address: 'x' }).eq('id', venue.id).select('id');
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);
    const del = await bksv.from('venues').delete().eq('id', venue.id).select('id');
    expect(del.error).toBeNull();
    expect(del.data).toEqual([]);
    expect(await addressOf(venue.id)).toMatchObject({ address: '' });
  });

  it('refuses a bksv editor moving an emmental venue to luzern', async () => {
    const venue = await insertVenue(admin, 'emmental move', { association_id: 'emmental' });
    const { error } = await bksv.from('venues').update({ association_id: 'luzern' }).eq('id', venue.id);
    expect(error?.message ?? '(no error)').toMatch(RLS);
    expect(await addressOf(venue.id)).toMatchObject({ association_id: 'emmental' });
  });

  it('refuses an emmental editor moving an emmental venue to oberland', async () => {
    const venue = await insertVenue(admin, 'emmental sideways', { association_id: 'emmental' });
    const { error } = await emmental
      .from('venues')
      .update({ association_id: 'oberland' })
      .eq('id', venue.id);
    expect(error?.message ?? '(no error)').toMatch(RLS);
    expect(await addressOf(venue.id)).toMatchObject({ association_id: 'emmental' });
  });

  it('ignores a bksv editor pulling a luzern venue into emmental', async () => {
    const venue = await insertVenue(admin, 'luzern pulled', { association_id: 'luzern' });
    const { data, error } = await bksv
      .from('venues')
      .update({ association_id: 'emmental' })
      .eq('id', venue.id)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await addressOf(venue.id)).toMatchObject({ association_id: 'luzern' });
  });

  it('refuses the pending account a venue in its requested emmental', async () => {
    const { error } = await insertAs(pending, 'pending emmental', 'emmental');
    expect(error?.message ?? '(no error)').toMatch(RLS);
  });

  it('lets the super-admin insert anywhere', async () => {
    expect((await insertAs(admin, 'esv luzern', 'luzern')).error).toBeNull();
    expect((await insertAs(admin, 'esv emmental', 'emmental')).error).toBeNull();
  });
});
