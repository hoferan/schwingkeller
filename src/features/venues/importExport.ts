import type { Venue } from './types';

const truthy = (v: unknown) =>
  v === true || /^(true|1|ja|yes|x)$/i.test(String(v ?? ''));

export const normalizeVenue = (v: Record<string, unknown>, i: number): Venue => ({
  id: (v.id != null && v.id !== '' ? String(v.id) : '') || `import_${i}`,
  name: String(v.name ?? ''),
  canton: String(v.canton ?? 'BE').toUpperCase(),
  address: String(v.address ?? ''),
  lat: parseFloat(String(v.lat)) || 46.8,
  lng: parseFloat(String(v.lng)) || 8.2,
  indoor: truthy(v.indoor),
  outdoor: truthy(v.outdoor),
  person: String(v.person ?? ''),
  phone: String(v.phone ?? ''),
  website: String(v.website ?? ''),
  photo_url: (v.photo_url as string) || (v.photo as string) || null,
});

const CSV_COLS: (keyof Venue)[] = [
  'id', 'name', 'canton', 'address', 'lat', 'lng',
  'indoor', 'outdoor', 'person', 'phone', 'website',
];

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCSV = (venues: Venue[]): string => {
  const rows = [CSV_COLS.join(',')].concat(
    venues.map((v) => CSV_COLS.map((c) => esc(v[c])).join(',')),
  );
  return '﻿' + rows.join('\n');
};

export const toJSON = (venues: Venue[]): string => JSON.stringify(venues, null, 2);

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
  const lines = txt.replace(/^﻿/, '').replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const head = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const o: Record<string, string> = {};
    head.forEach((h, i) => { o[h] = cells[i]; });
    return o;
  });
};
