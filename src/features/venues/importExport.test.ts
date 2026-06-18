import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV, normalizeVenue } from './importExport';

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
