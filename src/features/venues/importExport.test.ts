import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV, normalizeVenue, toJSON, validateImport, formatImportErrors } from './importExport';
import { STR } from '../../i18n/translations';

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

describe('the association_id column', () => {
  it('is the last CSV column, and export writes it', () => {
    const venue = { ...normalizeVenue({ name: 'A', canton: 'FR' }, 0), association_id: 'freiburg' };
    const [header, row] = toCSV([venue]).replace(/^\uFEFF/, '').split('\n');
    expect(header.endsWith(',association_id')).toBe(true);
    expect(row.endsWith(',freiburg')).toBe(true);
  });

  it('keeps a valid id and matches it after trimming and lower-casing', () => {
    expect(normalizeVenue({ name: 'A', canton: 'FR', association_id: 'freiburg' }, 0).association_id).toBe('freiburg');
    expect(normalizeVenue({ name: 'A', canton: 'LU', association_id: ' Emmental ' }, 0).association_id).toBe('emmental');
  });

  it('suggests from the canton when the column is missing, empty or null', () => {
    expect(normalizeVenue({ name: 'A', canton: 'zh' }, 0).association_id).toBe('zuerich');
    expect(normalizeVenue({ name: 'A', canton: 'ZH', association_id: '' }, 0).association_id).toBe('zuerich');
    expect(normalizeVenue({ name: 'A', canton: 'ZH', association_id: null }, 0).association_id).toBe('zuerich');
  });

  it('leaves a Bernese row without an association, since the file has no district', () => {
    expect(normalizeVenue({ name: 'A', canton: 'BE' }, 0).association_id).toBeNull();
  });
});

describe('validateImport', () => {
  const rows = [
    { name: 'A', canton: 'FR', association_id: 'freiburg' },
    { name: 'B', canton: 'BE', association_id: 'bksv' },
    { name: 'C', canton: 'ZH', association_id: 'emental' },
  ];

  it('numbers CSV errors by spreadsheet row, the header being row 1', () => {
    expect(validateImport(rows, 'csv').errors).toEqual([{ row: 3, id: 'bksv' }, { row: 4, id: 'emental' }]);
  });

  it('numbers JSON errors by entry', () => {
    expect(validateImport(rows, 'json').errors).toEqual([{ row: 2, id: 'bksv' }, { row: 3, id: 'emental' }]);
  });

  it('returns every venue and no errors for a clean file', () => {
    const { venues, errors } = validateImport([rows[0], { name: 'D', canton: 'ZH' }, { name: 'E', canton: 'BE' }], 'csv');
    expect(errors).toEqual([]);
    expect(venues.map((v) => v.association_id)).toEqual(['freiburg', 'zuerich', null]);
  });
});

describe('formatImportErrors', () => {
  it('lists five rows and counts the rest', () => {
    const errors = Array.from({ length: 7 }, (_, i) => ({ row: i + 2, id: `x${i + 2}` }));
    expect(formatImportErrors(errors, 'csv', STR.de)).toBe(
      [2, 3, 4, 5, 6].map((r) => `Zeile ${r}: unbekannter Verband «x${r}»`).join('\n') + '\n… und 2 weitere',
    );
  });

  it('names JSON entries', () => {
    expect(formatImportErrors([{ row: 1, id: 'x' }], 'json', STR.de)).toBe('Eintrag 1: unbekannter Verband «x»');
  });
});
