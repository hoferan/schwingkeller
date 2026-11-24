import L from 'leaflet';
import type { Venue } from './types';
import { POSTER_SIZE } from './posterLayout';

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

// The view the export draws: `center` is the preview map's centre and `zoom` is the preview zoom
// plus the levels the export adds (1 at 540px, 2 at 270px).
export interface PosterView { center: [number, number]; zoom: number }

// Projects a point to pixels at a zoom level. The editor and the export pass Leaflet's
// map.project, which both maps compute the same way because they share the CRS.
export type PosterProjector = (latlng: [number, number], zoom: number) => { x: number; y: number };

export interface PosterPin { x: number; y: number; text: string }

// Where each venue's pin lands on the poster, in unrounded poster px. The preview and the export
// both place their names from these points, so they place the same ones (#155). A map's
// latLngToContainerPoint rounds to that map's own pixels, which on the 540 and 270px previews are
// 2 and 4 poster px wide.
export const posterPinPoints = (
  project: PosterProjector,
  venues: Venue[],
  view: PosterView,
  posterHeight: number,
): PosterPin[] => {
  const c = project(view.center, view.zoom);
  return venues.map((venue) => {
    const p = project([venue.lat, venue.lng], view.zoom);
    return { x: p.x - c.x + POSTER_SIZE / 2, y: p.y - c.y + posterHeight / 2, text: venue.name };
  });
};
