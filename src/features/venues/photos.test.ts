import { describe, it, expect } from 'vitest';
import { coverPhotoUrl, MAX_PHOTOS } from './photos';
import type { Venue } from './types';

const baseVenue: Venue = {
  id: 'v1', name: 'Test', canton: 'BE', address: '', lat: 46.8, lng: 8.2,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [],
};

describe('coverPhotoUrl', () => {
  it('returns null when there are no photos', () => {
    expect(coverPhotoUrl(baseVenue)).toBeNull();
  });

  it('returns the position-0 photo url when photos exist', () => {
    const venue: Venue = {
      ...baseVenue,
      photos: [
        { id: 'p1', url: 'https://example.com/1.jpg', position: 0 },
        { id: 'p2', url: 'https://example.com/2.jpg', position: 1 },
      ],
    };
    expect(coverPhotoUrl(venue)).toBe('https://example.com/1.jpg');
  });
});

describe('MAX_PHOTOS', () => {
  it('is 6', () => {
    expect(MAX_PHOTOS).toBe(6);
  });
});
