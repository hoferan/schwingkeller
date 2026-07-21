import { describe, it, expect } from 'vitest';
import { venueBoundsForCanton, CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';
import type { Venue } from './types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], ...over,
});

describe('CANTON_POSTER_MAX_DEFAULT_ZOOM', () => {
  it('is a town/neighborhood-level zoom', () => {
    expect(CANTON_POSTER_MAX_DEFAULT_ZOOM).toBe(14);
  });
});

describe('venueBoundsForCanton', () => {
  it('returns null when no venues match the canton', () => {
    const venues = [v({ id: '1', canton: 'LU' })];
    expect(venueBoundsForCanton('BE', venues)).toBeNull();
  });

  it("returns bounds covering only the matching canton's venues", () => {
    const venues = [
      v({ id: '1', canton: 'BE', lat: 46.9, lng: 7.4 }),
      v({ id: '2', canton: 'BE', lat: 46.95, lng: 7.45 }),
      v({ id: '3', canton: 'LU', lat: 47.05, lng: 8.3 }),
    ];
    const bounds = venueBoundsForCanton('BE', venues);
    expect(bounds).not.toBeNull();
    expect(bounds!.getSouthWest()).toEqual(expect.objectContaining({ lat: 46.9, lng: 7.4 }));
    expect(bounds!.getNorthEast()).toEqual(expect.objectContaining({ lat: 46.95, lng: 7.45 }));
  });
});
