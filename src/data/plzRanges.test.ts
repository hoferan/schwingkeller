import { describe, it, expect } from 'vitest';
import { plzToCanton, cantonFromGeo } from './plzRanges';

describe('plzToCanton', () => {
  it('maps a Bern PLZ', () => { expect(plzToCanton('Schlossstrasse 3, 3550 Langnau')).toBe('BE'); });
  it('maps a Zürich PLZ', () => { expect(plzToCanton('8001 Zürich')).toBe('ZH'); });
  it('maps a Geneva PLZ', () => { expect(plzToCanton('1204 Genève')).toBe('GE'); });
  it('returns null when no 4-digit code present', () => { expect(plzToCanton('no postcode')).toBeNull(); });
});

describe('cantonFromGeo', () => {
  it('reads ISO3166-2 canton code', () => {
    expect(cantonFromGeo({ 'ISO3166-2-lvl4': 'CH-BE' })).toBe('BE');
  });
  it('falls back to postcode', () => {
    expect(cantonFromGeo({ postcode: '8001' })).toBe('ZH');
  });
  it('returns null for unknown input', () => { expect(cantonFromGeo({})).toBeNull(); });
});
