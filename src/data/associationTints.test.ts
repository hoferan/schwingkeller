import { describe, it, expect } from 'vitest';
import { theme } from '../theme';
import { ASSOCIATIONS } from './associations';
import { REGIONAL_TINTS, tintOf } from './associationTints';

// WCAG 2.x relative luminance and contrast ratio.
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('REGIONAL_TINTS', () => {
  it('has one tint per regional association', () => {
    expect(REGIONAL_TINTS).toEqual({
      bksv: '#1A1A1A',
      isv: '#E30613',
      nosv: '#0B7A26',
      nwsv: '#1854B4',
      swsv: '#5D6B80',
    });
  });

  it('carries white text at 4.5 to 1 or more', () => {
    for (const tint of Object.values(REGIONAL_TINTS)) {
      expect(contrast(tint, theme.color.accentInk), tint).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('tintOf', () => {
  it('gives a cantonal association the tint of its regional association', () => {
    expect(tintOf('emmental')).toBe('#1A1A1A');
    expect(tintOf('freiburg')).toBe('#5D6B80');
  });

  it('has a tint for every cantonal association', () => {
    for (const a of ASSOCIATIONS) {
      if (a.level === 'cantonal') expect(tintOf(a.id), a.id).toBe(REGIONAL_TINTS[a.parentId]);
    }
  });
});
