import { describe, it, expect } from 'vitest';
import { CANTON_BOUNDS } from './cantonBounds';
import { CANTONS } from './cantons';

describe('CANTON_BOUNDS', () => {
  it('holds the precomputed bounds for a known code', () => {
    expect(CANTON_BOUNDS.FR).toEqual([[46.43791, 6.74187], [47.00681, 7.38021]]);
  });

  it('has a bounds entry for every canton in CANTONS', () => {
    const missing = CANTONS.filter((c) => !CANTON_BOUNDS[c.code]);
    expect(missing).toEqual([]);
  });
});
