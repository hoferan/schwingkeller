import L from 'leaflet';
import type { Venue } from './types';

// The poster editor's default framing, in poster terms so it comes out the same at either preview
// size. The editor converts both to its preview: the padding by previewSize / POSTER_SIZE, the
// zoom by the levels the export adds to the preview (1 at 540px, 2 at 270px).

// Town/neighbourhood-level zoom cap for the exported poster. Keeps a single venue or a tight
// cluster from zooming in so far that the surrounding context disappears.
export const POSTER_MAX_EXPORT_ZOOM = 15;

// Space kept free around the venues on each side, in poster px.
export const POSTER_FIT_PADDING = 40;

export const venueBounds = (venues: Venue[]): L.LatLngBounds | null => {
  if (venues.length === 0) return null;
  return L.latLngBounds(venues.map((v): [number, number] => [v.lat, v.lng]));
};
