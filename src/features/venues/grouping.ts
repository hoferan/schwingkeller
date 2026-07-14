import { CANTONS, cantonByCode } from '../../data/cantons';
import type { Venue } from './types';

export interface Facets {
  indoor: boolean;
  outdoor: boolean;
}

export const filterVenues = (venues: Venue[], search: string, facets?: Facets): Venue[] => {
  const q = search.trim().toLowerCase();
  const anyFacet = !!facets && (facets.indoor || facets.outdoor);
  if (!q && !anyFacet) return venues;
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    const textOk =
      !q ||
      `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''}`.toLowerCase().includes(q);
    const facetOk =
      !anyFacet || (facets!.indoor && v.indoor) || (facets!.outdoor && v.outdoor);
    return textOk && facetOk;
  });
};

export interface CantonGroup { code: string; name: string; count: number; venues: Venue[] }

export const groupByCanton = (venues: Venue[], includeEmpty = false): CantonGroup[] => {
  const by: Record<string, Venue[]> = {};
  venues.forEach((v) => { (by[v.canton] = by[v.canton] ?? []).push(v); });
  const source = includeEmpty ? CANTONS : CANTONS.filter((c) => by[c.code]);
  return source
    .map((c) => ({
      code: c.code, name: c.name, count: (by[c.code] ?? []).length, venues: by[c.code] ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
};
