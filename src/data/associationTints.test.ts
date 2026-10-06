import { describe, it, expect } from 'vitest';
import { REGIONAL_TINTS, tintOf } from './associationTints';

describe('REGIONAL_TINTS', () => {
  it('has one tint per regional association', () => {
    expect(REGIONAL_TINTS).toEqual({
      bksv: '#9B2C1F',
      isv: '#1F5F8B',
      nosv: '#2E6B3F',
      nwsv: '#6A4A8C',
      swsv: '#8A5A12',
    });
  });
});

describe('tintOf', () => {
  it('gives a cantonal association the tint of its regional association', () => {
    expect(tintOf('emmental')).toBe('#9B2C1F');
    expect(tintOf('freiburg')).toBe('#8A5A12');
  });

  it('gives a regional association its own tint', () => {
    expect(tintOf('isv')).toBe('#1F5F8B');
  });

  it('has no tint for the federation, a missing or an unknown id', () => {
    expect([tintOf('esv'), tintOf(null), tintOf(undefined), tintOf('nowhere')]).toEqual([null, null, null, null]);
  });
});
