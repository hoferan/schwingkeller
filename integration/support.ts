import type { SupabaseClient } from '@supabase/supabase-js';

// Everything the integration tests create carries these, so a sweep can find what a crashed run
// left behind. Grisons, because the seed has no venue there.
export const INT_PREFIX = '[int]';
export const INT_STORAGE_DIR = 'int-test';
export const PHOTO_BUCKET = 'venue-photos';

export type VenueRow = {
  name: string;
  canton: string;
  lat: number;
  lng: number;
};

export const newVenueRow = (label: string): VenueRow => ({
  name: `${INT_PREFIX} ${label} ${crypto.randomUUID().slice(0, 8)}`,
  canton: 'GR',
  lat: 46.85,
  lng: 9.53,
});

export const insertVenue = async (
  client: SupabaseClient,
  label: string,
): Promise<{ id: string; name: string }> => {
  const { data, error } = await client.from('venues').insert(newVenueRow(label)).select('id, name').single();
  if (error) throw new Error(`inserting "${label}" failed: ${error.message}`);
  return data;
};

// A venue from supabase/seed.sql, never one a test created.
export const seedVenue = async (
  client: SupabaseClient,
): Promise<{ id: string; name: string; address: string | null }> => {
  const { data, error } = await client
    .from('venues')
    .select('id, name, address')
    .not('name', 'like', '[%')
    .order('name')
    .limit(1)
    .single();
  if (error) throw new Error(`reading a seed venue failed: ${error.message}`);
  return data;
};
