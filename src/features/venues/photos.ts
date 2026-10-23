import type { Venue } from './types';

export const MAX_PHOTOS = 6;

// The types the venue-photos bucket takes (allowed_mime_types, migration 0014). Storage refuses
// any other upload.
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;

export const isPhotoType = (type: string): boolean => (PHOTO_TYPES as readonly string[]).includes(type);

export const coverPhotoUrl = (venue: Venue): string | null =>
  venue.photos.find((p) => p.position === 0)?.url ?? venue.photos[0]?.url ?? null;
