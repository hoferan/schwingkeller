import { supabase } from '../../lib/supabase';
import type { Venue, VenueInput } from './types';

const toError = (e: { message: string; code?: string }): Error =>
  new Error(e.code ? `[${e.code}] ${e.message}` : e.message);

export const listVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase.from('venues').select('*').order('name');
  if (error) throw toError(error);
  return (data ?? []) as Venue[];
};

export const createVenue = async (input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert(input).select().single();
  if (error) throw toError(error);
  return data as Venue;
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  if (error) throw toError(error);
  return data as Venue;
};

export const removeVenue = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw toError(error);
};

export const replaceAllVenues = async (venues: VenueInput[]): Promise<void> => {
  const { error } = await supabase.rpc('replace_venues', { rows: venues });
  if (error) throw toError(error);
};

export const uploadPhoto = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, file, { upsert: false });
  if (error) throw toError(error);
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
};
