import { describe, it, expect } from 'vitest';
import { CANTONS, cantonByCode, wappenUrl } from './cantons';

describe('cantons', () => {
  it('contains all 26 cantons', () => {
    expect(CANTONS).toHaveLength(26);
  });
  it('looks up a canton by code', () => {
    expect(cantonByCode('BE')?.name).toBe('Bern');
    expect(cantonByCode('XX')).toBeUndefined();
  });
  it('points the wappen URL at the bundled same-origin SVG for the canton code', () => {
    expect(wappenUrl('VD')).toBe('/wappen/VD.svg');
    expect(wappenUrl('XX')).toBe('');
  });
});
