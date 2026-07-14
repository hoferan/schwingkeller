import { describe, it, expect } from 'vitest';
import { haversineKm, formatDistance, sortByDistance } from './distance';

describe('haversineKm', () => {
  it('computes ~95 km between Bern and Zürich', () => {
    const bern = { lat: 46.948, lng: 7.447 };
    const zurich = { lat: 47.377, lng: 8.540 };
    expect(haversineKm(bern, zurich)).toBeGreaterThan(90);
    expect(haversineKm(bern, zurich)).toBeLessThan(100);
  });
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 46, lng: 7 }, { lat: 46, lng: 7 })).toBe(0);
  });
});

describe('formatDistance', () => {
  it('shows metres below 1 km, rounded to the nearest 10', () => {
    expect(formatDistance(0.847, 'de')).toBe('850 m');
  });
  it('shows one decimal from 1 to 99 km', () => {
    expect(formatDistance(4.23, 'en')).toBe('4.2 km');
  });
  it('uses the locale decimal separator', () => {
    expect(formatDistance(4.23, 'fr')).toBe('4,2 km');
  });
  it('shows a whole number at or above 100 km', () => {
    expect(formatDistance(123.6, 'de')).toBe('124 km');
  });
});

describe('sortByDistance', () => {
  it('orders nearest first without mutating the input', () => {
    const origin = { lat: 46.95, lng: 7.45 };
    const input = [
      { id: 'far', lat: 47.38, lng: 8.54 },
      { id: 'near', lat: 46.96, lng: 7.46 },
    ];
    const out = sortByDistance(input, origin);
    expect(out.map((x) => x.id)).toEqual(['near', 'far']);
    expect(input[0].id).toBe('far'); // input untouched
  });
});
