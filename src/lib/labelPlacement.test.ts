import { describe, it, expect } from 'vitest';
import { placeLabels, placeLabelsFor } from './labelPlacement';

// Sizes of the map's venue names, in screen pixels: a 28px pin and a 20px high name.
const m = { pinRadius: 14, gap: 4, labelH: 20, padX: 8 };

describe('placeLabels', () => {
  it('puts a lone label right of its pin, clear of the pin by the gap', () => {
    expect(placeLabels([{ x: 100, y: 100, text: 'A', width: 30 }], m, { width: 800, height: 600 }))
      .toEqual([{ x: 118, y: 90, w: 46, h: 20, text: 'A', slot: 'right' }]);
  });

  it('falls back to the left at the right edge', () => {
    expect(placeLabels([{ x: 790, y: 100, text: 'A', width: 30 }], m, { width: 800, height: 600 })[0].slot)
      .toBe('left');
  });

  it('says which pin each label belongs to, also when one is left out', () => {
    const a = { x: 100, y: 100, text: 'A', width: 30, id: 'a' };
    const b = { x: 400, y: 100, text: 'B', width: 30, id: 'b' };
    const obstacles = [{ x: 0, y: 0, w: 300, h: 600 }]; // everything around A
    expect(placeLabelsFor([a, b], m, { width: 800, height: 600, obstacles }).map((r) => r.pin.id)).toEqual(['b']);
  });

  it('leaves out a label with no free side', () => {
    const obstacles = [{ x: 0, y: 0, w: 800, h: 600 }];
    expect(placeLabels([{ x: 100, y: 100, text: 'A', width: 30 }], m, { width: 800, height: 600, obstacles }))
      .toEqual([]);
  });
});
