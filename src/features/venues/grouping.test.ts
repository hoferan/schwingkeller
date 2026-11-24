import { describe, it, expect } from 'vitest';
import { filterVenues, flatSorted } from './grouping';
import type { Venue } from './types';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '3000 Bern', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental', ...over,
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
  // The person column may be null in the database (0001_init: `person text default ''`).
  it("doesn't match the word null for a venue without a contact person", () => {
    const noPerson = v({ id: '4', person: null as unknown as string });
    expect(filterVenues([noPerson], 'null')).toEqual([]);
  });
  it('finds a venue with an unknown canton code by its name', () => {
    const unknownCanton = v({ id: '5', name: 'Altkeller', canton: 'XX' });
    expect(filterVenues([unknownCanton], 'altkeller').map((x) => x.id)).toEqual(['5']);
  });
});

describe('flatSorted', () => {
  const mk = (id: string, name: string, lat: number, lng: number): Venue => ({
    id, name, canton: 'BE', address: '', lat, lng,
    indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental',
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

describe('filterVenues with extra text', () => {
  const extra = (x: Venue) => (x.id === '1' ? 'Emmental Bernisch-Kantonaler Schwingerverband BKSV' : '');
  it('matches the extra text', () => {
    expect(filterVenues(venues, 'bksv', extra).map((x) => x.id)).toEqual(['1']);
  });
  it('still matches the canton name with extra text given', () => {
    expect(filterVenues(venues, 'luzern', extra).map((x) => x.id)).toEqual(['2', '3']);
  });
});

describe('flatSorted in association mode', () => {
  it('keeps the input order', () => {
    expect(flatSorted(venues, 'association')).toBe(venues);
  });
});
