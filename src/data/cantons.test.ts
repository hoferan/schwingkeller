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
  it('builds a wappen URL using the German Wikimedia name', () => {
    expect(wappenUrl('VD')).toContain('Wappen_Waadt_matt.svg');
    expect(wappenUrl('XX')).toBe('');
  });
});
