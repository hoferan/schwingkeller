import { describe, it, expect } from 'vitest';
import { plzToCanton, cantonFromGeo, bernDistrictFromGeo } from './plzRanges';

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

describe('bernDistrictFromGeo', () => {
  const be = (county?: string) => ({ 'ISO3166-2-lvl4': 'CH-BE', county });
  it('strips the Verwaltungskreis prefix Nominatim sends in German', () => {
    expect(bernDistrictFromGeo(be('Verwaltungskreis Thun'))).toBe('Thun');
    expect(bernDistrictFromGeo(be('Verwaltungskreis Biel/Bienne'))).toBe('Biel/Bienne');
    expect(bernDistrictFromGeo(be('Verwaltungskreis Berner Jura'))).toBe('Berner Jura');
  });
  it('maps the French form of the Bernese Jura to the German name', () => {
    expect(bernDistrictFromGeo(be('Arrondissement administratif du Jura bernois'))).toBe('Berner Jura');
    expect(bernDistrictFromGeo(be('Jura bernois'))).toBe('Berner Jura');
  });
  it('is null outside Bern, without a county, and for no address', () => {
    expect(bernDistrictFromGeo({ 'ISO3166-2-lvl4': 'CH-FR', county: 'Saanebezirk' })).toBeNull();
    expect(bernDistrictFromGeo(be())).toBeNull();
    expect(bernDistrictFromGeo(be('   '))).toBeNull();
    expect(bernDistrictFromGeo(null)).toBeNull();
  });
});
