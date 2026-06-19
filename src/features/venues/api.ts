import { supabase } from '../../lib/supabase';
import type { Venue, VenueInput } from './types';

export const listVenues = async (): Promise<Venue[]> => {
  const { data, error } = await supabase.from('venues').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Venue[];
};

export const createVenue = async (input: VenueInput): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as Venue;
};

export const updateVenue = async (id: string, input: Partial<VenueInput>): Promise<Venue> => {
  const { data, error } = await supabase.from('venues').update(input).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as Venue;
};

export const removeVenue = async (id: string): Promise<void> => {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const replaceAllVenues = async (venues: VenueInput[]): Promise<void> => {
  const del = await supabase.from('venues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (del.error) throw new Error(del.error.message);
  if (venues.length) {
    const ins = await supabase.from('venues').insert(venues);
    if (ins.error) throw new Error(ins.error.message);
  }
};

export const uploadPhoto = async (file: File): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
};
