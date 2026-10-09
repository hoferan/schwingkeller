import L from 'leaflet';
import type { Venue } from './types';

// Town/neighborhood-level zoom cap for the poster editor's default venue-fit framing — keeps a
// single venue or a tight cluster from zooming in so far that surrounding context disappears.
export const POSTER_MAX_DEFAULT_ZOOM = 14;

export const venueBounds = (venues: Venue[]): L.LatLngBounds | null => {
  if (venues.length === 0) return null;
  return L.latLngBounds(venues.map((v): [number, number] => [v.lat, v.lng]));
};
