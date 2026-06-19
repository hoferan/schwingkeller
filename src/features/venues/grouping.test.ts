import { describe, it, expect } from 'vitest';
import { filterVenues, groupByCanton } from './grouping';
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
  it('groups in canton order with counts', () => {
    const g = groupByCanton(venues);
    expect(g.map((x) => x.code)).toEqual(['BE', 'LU']);
    expect(g[1].count).toBe(2);
  });
});
