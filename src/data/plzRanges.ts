import { cantonByCode } from './cantons';

type Range = [number, number, string];

export const PLZ_RANGES: Range[] = [
  [1200, 1299, 'GE'], [1900, 1999, 'VS'], [3900, 3999, 'VS'], [6060, 6078, 'OW'],
  [6390, 6390, 'OW'], [6370, 6388, 'NW'], [9050, 9059, 'AI'], [9100, 9199, 'AR'],
  [1000, 1199, 'VD'], [1300, 1499, 'VD'], [1800, 1899, 'VD'], [1500, 1799, 'FR'],
  [2000, 2399, 'NE'], [2400, 2499, 'NE'], [2500, 2699, 'BE'], [2700, 2999, 'JU'],
  [3000, 3899, 'BE'], [4000, 4099, 'BS'], [4100, 4299, 'BL'], [4300, 4499, 'AG'],
  [4500, 4699, 'SO'], [4700, 4999, 'SO'], [5000, 5999, 'AG'], [6000, 6299, 'LU'],
  [6300, 6349, 'ZG'], [6350, 6399, 'NW'], [6400, 6459, 'SZ'], [6460, 6499, 'UR'],
  [6500, 6999, 'TI'], [7000, 7999, 'GR'], [8000, 8199, 'ZH'], [8200, 8299, 'SH'],
  [8300, 8499, 'ZH'], [8500, 8599, 'TG'], [8600, 8799, 'ZH'], [8800, 8899, 'SZ'],
  [8900, 8999, 'ZH'], [9000, 9099, 'SG'], [9200, 9499, 'SG'], [9500, 9599, 'TG'],
  [9600, 9999, 'SG'],
];

export const plzToCanton = (addr: string): string | null => {
  const m = String(addr ?? '').match(/\b(\d{4})\b/);
  if (!m) return null;
  const p = parseInt(m[1], 10);
  for (const [lo, hi, code] of PLZ_RANGES) if (p >= lo && p <= hi) return code;
  return null;
};

export interface GeoAddress { 'ISO3166-2-lvl4'?: string; postcode?: string }

export const cantonFromGeo = (a: GeoAddress | null | undefined): string | null => {
  if (!a) return null;
  const iso = a['ISO3166-2-lvl4'] ?? '';
  const m = iso.match(/^CH-([A-Z]{2})$/);
  if (m && cantonByCode(m[1])) return m[1];
  if (a.postcode) return plzToCanton(a.postcode);
  return null;
};
