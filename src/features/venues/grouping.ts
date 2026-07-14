import { CANTONS, cantonByCode } from '../../data/cantons';
import type { Venue } from './types';

export const filterVenues = (venues: Venue[], search: string): Venue[] => {
  const q = search.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    return `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''}`.toLowerCase().includes(q);
  });
};

export interface CantonGroup { code: string; name: string; count: number; venues: Venue[] }

export const groupByCanton = (venues: Venue[], includeEmpty = false): CantonGroup[] => {
  const by: Record<string, Venue[]> = {};
  venues.forEach((v) => { (by[v.canton] = by[v.canton] ?? []).push(v); });
  const source = includeEmpty ? CANTONS : CANTONS.filter((c) => by[c.code]);
  return source.map((c) => ({
    code: c.code, name: c.name, count: (by[c.code] ?? []).length, venues: by[c.code] ?? [],
  }));
};
