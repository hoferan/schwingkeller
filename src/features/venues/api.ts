import { supabase } from '../../lib/supabase';
import { compressImageIfNeeded, COMPRESS_THRESHOLD_BYTES, PhotoTooLargeError } from './imageCompression';
import type { Venue, VenueInput, VenuePhoto } from './types';

export { PhotoTooLargeError };

const toError = (e: { message: string; code?: string; hint?: string; details?: string }): Error => {
  const err = new Error(e.code ? `[${e.code}] ${e.message}` : e.message);
  err.cause = e;
  return err;
};

interface VenueRow {
  id: string;
  name: string;
  canton: string;
  address: string;
  lat: number;
  lng: number;
  indoor: boolean;
  outdoor: boolean;
  person: string;
  phone: string;
  website: string;
  venue_photos: VenuePhoto[];
}

const toVenue = (row: VenueRow): Venue => {
  const { venue_photos, ...rest } = row;
  return { ...rest, photos: [...venue_photos].sort((a, b) => a.position - b.position) };
};

export const listVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase
    .from('venues')
    .select('*, venue_photos(id,url,position)')
    .order('name');
  if (error) throw toError(error);
  return ((data ?? []) as unknown as VenueRow[]).map(toVenue);
};

export const createVenue = async (input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert(input).select().single();
  if (error) throw toError(error);
  return { ...(data as Omit<Venue, 'photos'>), photos: [] };
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  if (error) throw toError(error);
  return { ...(data as Omit<Venue, 'photos'>), photos: [] };
};

export const removeVenue = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw toError(error);
};

export const replaceAllVenues = async (venues: VenueInput[]): Promise<void> => {
  const { error } = await supabase.rpc('replace_venues', { rows: venues });
  if (error) throw toError(error);
};

export const insertVenuePhoto = async (venueId: string, url: string, position: number): Promise<VenuePhoto> => {
  const { data, error } = await supabase
    .from('venue_photos')
    .insert({ venue_id: venueId, url, position })
    .select()
    .single();
  if (error) throw toError(error);
  return data as VenuePhoto;
};

export const deleteVenuePhoto = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venue_photos').delete().eq('id', id);
  if (error) throw toError(error);
};

export const updateVenuePhotoPosition = async (id: string, position: number): Promise<void> => {
  const { error } = await supabase.from('venue_photos').update({ position }).eq('id', id);
  if (error) throw toError(error);
};

export const syncVenuePhotos = async (
  venueId: string,
  original: VenuePhoto[],
  draft: VenuePhoto[],
): Promise<void> => {
  const draftIds = new Set(draft.map((p) => p.id));
  const removed = original.filter((p) => !draftIds.has(p.id));
  for (const p of removed) await deleteVenuePhoto(p.id);

  const originalById = new Map(original.map((p) => [p.id, p]));
  for (let i = 0; i < draft.length; i++) {
    const p = draft[i];
    const existing = originalById.get(p.id);
    if (existing) {
      if (existing.position !== i) await updateVenuePhotoPosition(p.id, i);
    } else {
      await insertVenuePhoto(venueId, p.url, i);
    }
  }
};

export const uploadPhoto = async (file: File): Promise<string> => {
  const processed = await compressImageIfNeeded(file);
  if (processed.size > COMPRESS_THRESHOLD_BYTES) throw new PhotoTooLargeError();
  const ext = processed.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, processed, { upsert: false });
  if (error) throw toError(error);
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
};
