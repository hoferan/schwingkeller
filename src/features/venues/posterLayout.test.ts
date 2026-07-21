import { describe, it, expect } from 'vitest';
import { POSTER_SIZE, POSTER_LAYOUT, posterHeightFor, chromeLayoutFor } from './posterLayout';

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

  it('reduces only the band heights for "compact" — content sizes stay untouched', () => {
    const compact = chromeLayoutFor('compact');
    // Bands shrink…
    expect(compact.headerH).toBeLessThan(POSTER_LAYOUT.headerH);
    expect(compact.footerH).toBeLessThan(POSTER_LAYOUT.footerH);
    // …but stay tall enough for the full-size Wappen plus its inset.
    expect(compact.headerH).toBeGreaterThanOrEqual(POSTER_LAYOUT.wappenH + 2 * compact.wappenY);
    // Fonts, pill, Wappen, and QR keep their normal size (smoke-test finding: scaling them down
    // made the chrome illegible — compact means less band, not smaller content).
    expect(compact.titleFont).toBe(POSTER_LAYOUT.titleFont);
    expect(compact.pillFont).toBe(POSTER_LAYOUT.pillFont);
    expect(compact.pillH).toBe(POSTER_LAYOUT.pillH);
    expect(compact.wappenW).toBe(POSTER_LAYOUT.wappenW);
    expect(compact.wappenH).toBe(POSTER_LAYOUT.wappenH);
    expect(compact.qrSize).toBe(POSTER_LAYOUT.qrSize);
    expect(compact.appNameFont).toBe(POSTER_LAYOUT.appNameFont);
    expect(compact.attribFont).toBe(POSTER_LAYOUT.attribFont);
  });

  it('does not expose venue-pin geometry — that stays outside the chrome-size axis entirely', () => {
    expect('pinRadius' in chromeLayoutFor('compact')).toBe(false);
    expect('pinRing' in chromeLayoutFor('normal')).toBe(false);
    expect('pinDotRatio' in chromeLayoutFor('normal')).toBe(false);
  });
});
