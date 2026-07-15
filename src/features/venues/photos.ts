import type { Venue } from './types';

export const MAX_PHOTOS = 6;

export const coverPhotoUrl = (venue: Venue): string | null =>
  venue.photos.find((p) => p.position === 0)?.url ?? venue.photos[0]?.url ?? null;
