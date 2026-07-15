import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV, normalizeVenue, toJSON } from './importExport';

describe('parseCSV', () => {
  it('parses header + rows with quoted commas', () => {
    const rows = parseCSV('name,address\n"A, B",3000 Bern');
    expect(rows[0]).toEqual({ name: 'A, B', address: '3000 Bern' });
  });
});

describe('toCSV', () => {
  it('emits header and escapes special chars', () => {
    const csv = toCSV([normalizeVenue({ name: 'A,B', canton: 'be', lat: '1', lng: '2' }, 0)]);
    const [header, row] = csv.split('\n');
    expect(header).toContain('name');
    expect(row).toContain('"A,B"');
  });
});

describe('CSV round-trip', () => {
  it('survives the BOM toCSV prepends (first column key not corrupted)', () => {
    const csv = toCSV([normalizeVenue({ id: 'v1', name: 'Emmental', canton: 'BE', lat: '46.9', lng: '7.8' }, 0)]);
    const rows = parseCSV(csv);
    expect(Object.keys(rows[0])).toContain('id');
    expect(rows[0].id).toBe('v1');
  });
});

describe('normalizeVenue', () => {
  it('coerces types and uppercases canton', () => {
    const n = normalizeVenue({ name: 'X', canton: 'be', lat: '46.9', lng: '7.8', indoor: 'ja' }, 0);
    expect(n.canton).toBe('BE');
    expect(n.lat).toBeCloseTo(46.9);
    expect(n.indoor).toBe(true);
  });
  it('defaults missing coords', () => {
    const n = normalizeVenue({ name: 'X' }, 1);
    expect(n.lat).toBe(46.8);
    expect(n.lng).toBe(8.2);
  });
});

describe('normalizeVenue photos', () => {
  it('parses a photos: string[] field into VenuePhoto[]', () => {
    const n = normalizeVenue({ name: 'X', photos: ['https://a', 'https://b'] }, 0);
    expect(n.photos).toEqual([
      { id: 'import_0_0', url: 'https://a', position: 0 },
      { id: 'import_0_1', url: 'https://b', position: 1 },
    ]);
  });

  it('falls back to a legacy single photo_url field', () => {
    const n = normalizeVenue({ name: 'X', photo_url: 'https://legacy' }, 2);
    expect(n.photos).toEqual([{ id: 'import_2_0', url: 'https://legacy', position: 0 }]);
  });

  it('defaults to an empty gallery when no photo field is present', () => {
    const n = normalizeVenue({ name: 'X' }, 0);
    expect(n.photos).toEqual([]);
  });
});

describe('toJSON', () => {
  it('serializes photos as a plain array of URLs', () => {
    const venue = normalizeVenue({ name: 'X', photos: ['https://a'] }, 0);
    const json = JSON.parse(toJSON([venue]));
    expect(json[0].photos).toEqual(['https://a']);
  });
});
