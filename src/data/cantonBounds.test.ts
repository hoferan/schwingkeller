import { describe, it, expect } from 'vitest';
import { boundsForCanton, CANTON_BOUNDS } from './cantonBounds';
import { CANTONS } from './cantons';

describe('boundsForCanton', () => {
  it('returns the precomputed bounds for a known code', () => {
    expect(boundsForCanton('FR')).toEqual([[46.43791, 6.74187], [47.00681, 7.38021]]);
  });

  it('returns null for an unknown code', () => {
    expect(boundsForCanton('XX')).toBeNull();
  });

  it('has a bounds entry for every canton in CANTONS', () => {
    const missing = CANTONS.filter((c) => !CANTON_BOUNDS[c.code]);
    expect(missing).toEqual([]);
  });
});
