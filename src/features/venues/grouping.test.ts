import { describe, it, expect } from 'vitest';
import { filterVenues, groupByCanton, flatSorted } from './grouping';
import type { Venue } from './types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '3000 Bern', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null, ...over,
});

const venues = [
  v({ id: '1', name: 'Emmental', canton: 'BE' }),
  v({ id: '2', name: 'Willisau', canton: 'LU' }),
  v({ id: '3', name: 'Allmend', canton: 'LU' }),
];

describe('filterVenues', () => {
  it('returns all when query empty', () => { expect(filterVenues(venues, '')).toHaveLength(3); });
  it('matches name case-insensitively', () => {
    expect(filterVenues(venues, 'willi').map((x) => x.id)).toEqual(['2']);
  });
  it('matches canton name', () => {
    expect(filterVenues(venues, 'luzern').map((x) => x.id)).toEqual(['2', '3']);
  });
});

describe('groupByCanton', () => {
  it('groups alphabetically by name with counts', () => {
    const g = groupByCanton(venues);
    // Bern < Luzern alphabetically.
    expect(g.map((x) => x.code)).toEqual(['BE', 'LU']);
    expect(g[1].count).toBe(2);
  });

  it('includes all 26 cantons sorted alphabetically by name when includeEmpty is true', () => {
    const g = groupByCanton(venues, true);
    expect(g).toHaveLength(26);
    // Ordered by the German canton names (Aargau, Appenzell Ausserrhoden, …, Zürich).
    expect(g.map((x) => x.code)).toEqual([
      'AG', 'AR', 'AI', 'BL', 'BS', 'BE', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
      'NW', 'OW', 'SH', 'SZ', 'SO', 'SG', 'TG', 'TI', 'UR', 'VS', 'VD', 'ZG', 'ZH',
    ]);
    const zh = g.find((x) => x.code === 'ZH')!;
    expect(zh.count).toBe(0);
    expect(zh.venues).toEqual([]);
    const lu = g.find((x) => x.code === 'LU')!;
    expect(lu.count).toBe(2);
  });

  it('defaults to only cantons with venues when includeEmpty is omitted', () => {
    expect(groupByCanton(venues).map((x) => x.code)).toEqual(['BE', 'LU']);
  });
});

describe('flatSorted', () => {
  const mk = (id: string, name: string, lat: number, lng: number) => ({
    id, name, canton: 'BE', address: '', lat, lng,
    indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null,
  });
  const venues = [mk('1', 'Zug-Halle', 47.2, 8.5), mk('2', 'Aare-Keller', 46.9, 7.4)];

  it('sorts by name A→Z', () => {
    expect(flatSorted(venues, 'name').map((v) => v.name)).toEqual(['Aare-Keller', 'Zug-Halle']);
  });
  it('sorts by distance nearest-first when an origin is given', () => {
    const origin = { lat: 46.95, lng: 7.45 };
    expect(flatSorted(venues, 'distance', origin).map((v) => v.id)).toEqual(['2', '1']);
  });
  it('falls back to name order for distance mode with no origin', () => {
    expect(flatSorted(venues, 'distance', null).map((v) => v.name)).toEqual(['Aare-Keller', 'Zug-Halle']);
  });
});
