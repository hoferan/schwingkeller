import { describe, it, expect } from 'vitest';
import { venueBounds, POSTER_FIT_PADDING, POSTER_MAX_EXPORT_ZOOM } from './posterFraming';
import type { Venue } from './types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental', ...over,
});

describe('default framing constants', () => {
  it('caps the export at a town/neighbourhood-level zoom', () => {
    expect(POSTER_MAX_EXPORT_ZOOM).toBe(15);
  });

  it('pads the fit by 40 poster px', () => {
    expect(POSTER_FIT_PADDING).toBe(40);
  });
});

describe('venueBounds', () => {
  it('returns null when there are no venues', () => {
    expect(venueBounds([])).toBeNull();
  });

  it('returns bounds covering every venue it is given, whatever their canton', () => {
    const venues = [
      v({ id: '1', canton: 'BE', lat: 46.9, lng: 7.4 }),
      v({ id: '2', canton: 'LU', lat: 47.05, lng: 8.3 }),
    ];
    const bounds = venueBounds(venues);
    expect(bounds).not.toBeNull();
    expect(bounds!.getSouthWest()).toEqual(expect.objectContaining({ lat: 46.9, lng: 7.4 }));
    expect(bounds!.getNorthEast()).toEqual(expect.objectContaining({ lat: 47.05, lng: 8.3 }));
  });
});
