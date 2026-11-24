import { describe, it, expect, vi } from 'vitest';
import {
  venueBounds, posterPinPoints, POSTER_FIT_PADDING, POSTER_MAX_EXPORT_ZOOM, type PosterProjector,
} from './posterFraming';
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

describe('posterPinPoints', () => {
  // A linear stand-in for Leaflet's projection: one degree is 2^zoom px.
  const project: PosterProjector = ([lat, lng], z) => ({ x: lng * 2 ** z, y: -lat * 2 ** z });

  it('puts the view centre in the middle of a square poster', () => {
    const venue = v({ lat: 10, lng: 20 });
    expect(posterPinPoints(project, [venue], { center: [10, 20], zoom: 3 }, 1080))
      .toEqual([{ x: 540, y: 540, text: venue.name }]);
  });

  it("centres the view vertically on the poster's own height", () => {
    const [pin] = posterPinPoints(project, [v({ lat: 10, lng: 20 })], { center: [10, 20], zoom: 3 }, 1350);
    expect(pin.y).toBe(675);
  });

  it('keeps sub-pixel offsets', () => {
    const [pin] = posterPinPoints(project, [v({ lat: 0.3, lng: 0.25 })], { center: [0, 0], zoom: 1 }, 1080);
    expect(pin.x).toBeCloseTo(540.5);
    expect(pin.y).toBeCloseTo(539.4);
  });

  it("projects at the view's zoom", () => {
    const spy = vi.fn(project);
    posterPinPoints(spy, [v({}), v({ id: '2' })], { center: [46.9, 7.4], zoom: 12.25 }, 1080);
    expect(spy).toHaveBeenCalled();
    spy.mock.calls.forEach(([, zoom]) => expect(zoom).toBe(12.25));
  });

  it("keeps the venues' order and names", () => {
    const pins = posterPinPoints(project, [v({ name: 'Thun' }), v({ id: '2', name: 'Bern Ost' })], { center: [46.9, 7.4], zoom: 10 }, 1080);
    expect(pins.map((p) => p.text)).toEqual(['Thun', 'Bern Ost']);
  });
});
