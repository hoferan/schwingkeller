import type { Venue, VenuePhoto } from './types';
import type { STR } from '../../i18n/translations';
import { isCantonalId } from '../../data/associations';
import { suggestAssociation } from '../associations/suggest';

const truthy = (v: unknown) =>
  v === true || /^(true|1|ja|yes|x)$/i.test(String(v ?? ''));

const parsePhotoUrls = (v: Record<string, unknown>): string[] => {
  if (Array.isArray(v.photos)) return v.photos.filter((u): u is string => typeof u === 'string');
  const legacy = (v.photo_url as string) || (v.photo as string) || '';
  return legacy ? [legacy] : [];
};

// The association a row carries, matched without regard to case or surrounding spaces. A missing,
// empty or null column falls back to the canton's suggestion; a Bernese row then has none, since a
// file carries no district. Anything else, a number from hand-edited JSON included, is kept as text
// so validateImport reports it. Whether the id is valid is validateImport's job.
const associationOf = (v: Record<string, unknown>, canton: string): string | null => {
  const value = v.association_id;
  if (value === null || value === undefined) return suggestAssociation({ canton });
  const raw = String(value).trim().toLowerCase();
  return raw || suggestAssociation({ canton });
};

export const normalizeVenue = (v: Record<string, unknown>, i: number): Venue => {
  const photos: VenuePhoto[] = parsePhotoUrls(v).map((url, idx) => (
    { id: `import_${i}_${idx}`, url, position: idx }
  ));
  const canton = String(v.canton ?? 'BE').toUpperCase();
  return {
    id: (v.id != null && v.id !== '' ? String(v.id) : '') || `import_${i}`,
    name: String(v.name ?? ''),
    canton,
    address: String(v.address ?? ''),
    lat: parseFloat(String(v.lat)) || 46.8,
    lng: parseFloat(String(v.lng)) || 8.2,
    indoor: truthy(v.indoor),
    outdoor: truthy(v.outdoor),
    person: String(v.person ?? ''),
    phone: String(v.phone ?? ''),
    website: String(v.website ?? ''),
    photos,
    association_id: associationOf(v, canton),
  };
};

const CSV_COLS: (keyof Omit<Venue, 'photos'>)[] = [
  'id', 'name', 'canton', 'address', 'lat', 'lng',
  'indoor', 'outdoor', 'person', 'phone', 'website', 'association_id',
];

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (venues: Venue[]): string => {
  const rows = [CSV_COLS.join(',')].concat(
    venues.map((v) => CSV_COLS.map((c) => esc(v[c])).join(',')),
  );
  return '\uFEFF' + rows.join('\n');
};

export const toJSON = (venues: Venue[]): string =>
  JSON.stringify(
    venues.map((v) => ({ ...v, photos: v.photos.map((p) => p.url) })),
    null,
    2,
  );

const splitLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === ',') { out.push(cur); cur = ''; }
    else if (ch === '"') q = true;
    else cur += ch;
  }
  out.push(cur);
  return out;
};

export const parseCSV = (txt: string): Record<string, string>[] => {
  // Strip a leading UTF-8 BOM (toCSV prepends one for Excel) so the first
  // header key isn't corrupted on an export -> re-import round-trip.
  const lines = txt.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const head = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const o: Record<string, string> = {};
    head.forEach((h, i) => { o[h] = cells[i]; });
    return o;
  });
};

export interface ImportError { row: number; id: string }
type ImportFormat = 'csv' | 'json';

// An import replaces every venue, so a row with an unknown association stops the whole file rather
// than being dropped or saved without one. Rows are numbered as the file shows them: a CSV by its
// spreadsheet row (the header is row 1), JSON by its entry.
export const validateImport = (
  rows: Record<string, unknown>[],
  format: ImportFormat,
): { venues: Venue[]; errors: ImportError[] } => {
  const venues = rows.map(normalizeVenue);
  const errors = venues.flatMap((v, i) =>
    v.association_id === null || isCantonalId(v.association_id)
      ? []
      : [{ row: i + (format === 'csv' ? 2 : 1), id: String(rows[i].association_id).trim() }],
  );
  return { venues, errors };
};

const SHOWN_ERRORS = 5;

export const formatImportErrors = (
  errors: ImportError[],
  format: ImportFormat,
  t: Pick<typeof STR.de, 'importBadAssociation' | 'importBadAssociationEntry' | 'importBadAssociationMore'>,
): string => {
  const line = format === 'csv' ? t.importBadAssociation : t.importBadAssociationEntry;
  const lines = errors.slice(0, SHOWN_ERRORS).map((e) => line.replace('{row}', String(e.row)).replace('{id}', e.id));
  const rest = errors.length - SHOWN_ERRORS;
  if (rest > 0) lines.push(t.importBadAssociationMore.replace('{n}', String(rest)));
  return lines.join('\n');
};
