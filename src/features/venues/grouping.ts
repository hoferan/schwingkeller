import { cantonByCode } from '../../data/cantons';
import type { Venue } from './types';
import type { LatLng } from './distance';
import { sortByDistance } from './distance';

// `extraText` adds text a query may also match, such as a venue's association names.
export const filterVenues = (
  venues: Venue[],
  search: string,
  extraText?: (v: Venue) => string,
): Venue[] => {
  const q = search.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => {
    const c = cantonByCode(v.canton);
    return `${v.name} ${v.address} ${c ? c.name : ''} ${v.person ?? ''} ${extraText?.(v) ?? ''}`
      .toLowerCase()
      .includes(q);
  });
};

export type SortMode = 'association' | 'name' | 'distance';

export const flatSorted = (
  venues: Venue[],
  mode: SortMode,
  origin?: LatLng | null,
): Venue[] => {
  if (mode === 'distance' && origin) return sortByDistance(venues, origin);
  if (mode === 'name' || mode === 'distance') {
    return [...venues].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  return venues;
};
