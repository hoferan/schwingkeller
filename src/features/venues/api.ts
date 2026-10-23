import { supabase } from '../../lib/supabase';
import { compressImageIfNeeded, COMPRESS_THRESHOLD_BYTES, PhotoTooLargeError } from './imageCompression';
import type { CantonalId } from '../../data/associations';
import type { Venue, VenueInput, VenuePhoto } from './types';

export { PhotoTooLargeError };

const toError = (e: { message: string; code?: string; hint?: string; details?: string }): Error => {
  const err = new Error(e.code ? `[${e.code}] ${e.message}` : e.message);
  err.cause = e;
  return err;
};

// RLS turns an update or delete outside the editor's scope into zero affected rows, not an error.
// The venue calls report that as this error, so the UI can tell it from a failure worth logging.
export class VenueChangeRefusedError extends Error {
  constructor() {
    super('The database refused the venue change');
    this.name = 'VenueChangeRefusedError';
  }
}

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
  association_id: CantonalId;
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

// The form picks the id, so a Save repeated after a lost answer can't create the venue twice. A
// 23505 means an earlier attempt created it already: the id is the table's only unique key.
export const createVenue = async (id: string, input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert({ id, ...input }).select().single();
  if (error?.code === '23505') return updateVenue(id, input);
  if (error) throw toError(error);
  return { ...(data as Omit<Venue, 'photos'>), photos: [] };
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  // .single() on zero rows answers PGRST116.
  if (error?.code === 'PGRST116') throw new VenueChangeRefusedError();
  if (error) throw toError(error);
  return { ...(data as Omit<Venue, 'photos'>), photos: [] };
};

export const removeVenue = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('venues').delete().eq('id', id).select('id');
  if (error) throw toError(error);
  if (!data?.length) throw new VenueChangeRefusedError();
};

// The row takes the id the editor gave the photo, so a retried save can tell which photos
// the earlier attempt already stored.
export const insertVenuePhoto = async (venueId: string, photo: VenuePhoto): Promise<VenuePhoto> => {
  const { data, error } = await supabase
    .from('venue_photos')
    .insert({ id: photo.id, venue_id: venueId, url: photo.url, position: photo.position })
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

// The photo ids an edit form knows about: those it opened with, and those it has sent in this or
// an earlier save attempt.
export interface KnownPhotos {
  opened: ReadonlySet<string>;
  sent: ReadonlySet<string>;
}

// Brings the stored photos in line with the draft. It reads what the database holds at the time
// of the call, so a save that failed partway can run again. It leaves alone photos the form
// never knew about, which someone else added, and doesn't bring back a photo the form opened
// with that someone else has deleted since.
export const syncVenuePhotos = async (venueId: string, draft: VenuePhoto[], known: KnownPhotos): Promise<void> => {
  const { data, error } = await supabase
    .from('venue_photos')
    .select('id,url,position')
    .eq('venue_id', venueId);
  if (error) throw toError(error);
  const stored = (data ?? []) as VenuePhoto[];

  const draftIds = new Set(draft.map((p) => p.id));
  const removed = stored.filter((p) => (known.opened.has(p.id) || known.sent.has(p.id)) && !draftIds.has(p.id));
  for (const p of removed) await deleteVenuePhoto(p.id);

  const storedById = new Map(stored.map((p) => [p.id, p]));
  for (let i = 0; i < draft.length; i++) {
    const p = draft[i];
    const existing = storedById.get(p.id);
    if (existing) {
      if (existing.position !== i) await updateVenuePhotoPosition(p.id, i);
    } else if (!known.opened.has(p.id)) {
      await insertVenuePhoto(venueId, { ...p, position: i });
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
