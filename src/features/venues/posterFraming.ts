import L from 'leaflet';
import type { Venue } from './types';

// Town/neighborhood-level zoom cap for the poster editor's default venue-fit framing — keeps a
// single venue or a tight cluster from zooming in so far that surrounding context disappears.
export const CANTON_POSTER_MAX_DEFAULT_ZOOM = 14;

export const venueBoundsForCanton = (code: string, venues: Venue[]): L.LatLngBounds | null => {
  const cantonVenues = venues.filter((v) => v.canton === code);
  if (cantonVenues.length === 0) return null;
  return L.latLngBounds(cantonVenues.map((v): [number, number] => [v.lat, v.lng]));
};
