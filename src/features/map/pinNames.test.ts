import { describe, it, expect, vi, afterEach } from 'vitest';
import { STR } from '../../i18n/translations';
import { canHover, clusterTipHtml, measureName, placeNames, placeTip } from './pinNames';

// The text of each line of a cluster list, in order.
const textLines = (html: string): string[] =>
  [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.pin-tip-list > div')]
    .map((d) => d.textContent!.trim());

const measure = (s: string) => s.length * 7;

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('clusterTipHtml', () => {
  it('lists all names of a cluster of six, sorted, with no "more" line', () => {
    expect(textLines(clusterTipHtml(['F', 'B', 'E', 'A', 'D', 'C'], STR.de.moreVenues)))
      .toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('lists five names and "+ 2 weitere" for seven', () => {
    expect(textLines(clusterTipHtml(['G', 'F', 'E', 'D', 'C', 'B', 'A'], STR.de.moreVenues)))
      .toEqual(['A', 'B', 'C', 'D', 'E', '+ 2 weitere']);
  });

  it.each([['fr', '+ 2 autres'], ['it', '+ altri 2']] as const)('says the rest in %s', (lang, line) => {
    expect(textLines(clusterTipHtml(['A', 'B', 'C', 'D', 'E', 'F', 'G'], STR[lang].moreVenues)).at(-1)).toBe(line);
  });

  it('escapes names', () => {
    expect(clusterTipHtml(['<b>x</b>'], STR.de.moreVenues)).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('placeNames', () => {
  it('cuts a long name with an ellipsis at 160px of text', () => {
    const [placed] = placeNames([{ id: '1', x: 100, y: 100, name: 'X'.repeat(60) }], measure,
      { width: 800, height: 600, obstacles: [] });
    expect(placed.text.endsWith('…')).toBe(true);
    expect(placed.w).toBeLessThanOrEqual(160 + 2 * 8);
  });

  it('gives names first pick in name order, whatever order the pins come in', () => {
    const pins = [{ id: 'b', x: 100, y: 100, name: 'Beta' }, { id: 'a', x: 100, y: 100, name: 'Alpha' }];
    const placed = placeNames(pins, measure, { width: 800, height: 600, obstacles: [] });
    expect(placed.find((p) => p.id === 'a')!.slot).toBe('right');
  });
});

describe('measureName', () => {
  it('measures something for a name even without a canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(measureName('Halle Agy')).toBeGreaterThan(0);
    expect(measureName('Halle Agy und mehr')).toBeGreaterThan(measureName('Halle Agy'));
  });

  it('measures the name in capitals, as the map shows it, in the names font', () => {
    const ctx = { font: '', measureText: vi.fn((s: string) => ({ width: s.length * 6 })) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    expect(measureName('Halle Agy')).toBe(54);
    expect(ctx.measureText).toHaveBeenCalledWith('HALLE AGY');
    expect(ctx.font).toBe('600 11px Oswald, sans-serif');
  });
});

describe('canHover', () => {
  it('is false where the browser has no media queries', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(canHover()).toBe(false);
  });

  it('follows the (hover: hover) media query', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(hover: hover)' }));
    expect(canHover()).toBe(true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(canHover()).toBe(false);
  });
});

describe('placeTip', () => {
  // A 28px disc pin, its chip 1px clear on every side.
  const disc = { top: -15, bottom: 15, left: -15, right: 15, midY: 0 };
  const size = { w: 100, h: 20 };
  const map = { width: 800, height: 600, obstacles: [] };

  it('opens above the pin when there is room', () => {
    expect(placeTip({ x: 400, y: 300 }, disc, size, map)).toEqual({ direction: 'top', offset: [0, -15] });
  });

  it('opens below a pin at the top edge', () => {
    expect(placeTip({ x: 400, y: 10 }, disc, size, map)).toEqual({ direction: 'bottom', offset: [0, 15] });
  });

  it('opens to the right of a pin at the left edge', () => {
    expect(placeTip({ x: 10, y: 300 }, disc, size, map)).toEqual({ direction: 'right', offset: [15, 0] });
  });

  it('opens to the left of a pin at the right edge', () => {
    expect(placeTip({ x: 790, y: 300 }, disc, size, map)).toEqual({ direction: 'left', offset: [-15, 0] });
  });

  it('keeps clear of a map control above the pin', () => {
    const legend = { x: 300, y: 200, w: 200, h: 80 };
    expect(placeTip({ x: 400, y: 300 }, disc, size, { ...map, obstacles: [legend] }).direction).toBe('bottom');
  });

  it('stays above when no side has room', () => {
    expect(placeTip({ x: 400, y: 300 }, disc, { w: 900, h: 700 }, map).direction).toBe('top');
  });
});
