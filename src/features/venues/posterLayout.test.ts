import { describe, it, expect } from 'vitest';
import { POSTER_SIZE, POSTER_LAYOUT, posterHeightFor, chromeLayoutFor, COMPACT_SCALE } from './posterLayout';

describe('posterHeightFor', () => {
  it('returns POSTER_SIZE for square (1:1)', () => {
    expect(posterHeightFor('square')).toBe(POSTER_SIZE);
    expect(posterHeightFor('square')).toBe(1080);
  });

  it('returns 1.5x POSTER_SIZE for portrait (2:3)', () => {
    expect(posterHeightFor('portrait')).toBe(1620);
  });
});

describe('chromeLayoutFor', () => {
  it('returns unscaled ("normal") values matching POSTER_LAYOUT exactly', () => {
    const normal = chromeLayoutFor('normal');
    expect(normal.headerH).toBe(POSTER_LAYOUT.headerH);
    expect(normal.footerH).toBe(POSTER_LAYOUT.footerH);
    expect(normal.qrSize).toBe(POSTER_LAYOUT.qrSize);
    expect(normal.titleFont).toBe(POSTER_LAYOUT.titleFont);
    expect(normal.minAttribStripH).toBe(POSTER_LAYOUT.minAttribStripH);
  });

  it('scales every chrome constant by COMPACT_SCALE for "compact"', () => {
    const compact = chromeLayoutFor('compact');
    expect(compact.headerH).toBeCloseTo(POSTER_LAYOUT.headerH * COMPACT_SCALE);
    expect(compact.footerH).toBeCloseTo(POSTER_LAYOUT.footerH * COMPACT_SCALE);
    expect(compact.qrSize).toBeCloseTo(POSTER_LAYOUT.qrSize * COMPACT_SCALE);
    expect(compact.titleFont).toBeCloseTo(POSTER_LAYOUT.titleFont * COMPACT_SCALE);
  });

  it('does not expose venue-pin geometry — that stays outside the chrome-size axis entirely', () => {
    expect('pinRadius' in chromeLayoutFor('compact')).toBe(false);
    expect('pinRing' in chromeLayoutFor('normal')).toBe(false);
    expect('pinDotRatio' in chromeLayoutFor('normal')).toBe(false);
  });
});
