import { describe, it, expect } from 'vitest';
import { POSTER_SIZE, posterHeightFor } from './posterLayout';

describe('posterHeightFor', () => {
  it('returns POSTER_SIZE for square (1:1)', () => {
    expect(posterHeightFor('square')).toBe(POSTER_SIZE);
    expect(posterHeightFor('square')).toBe(1080);
  });

  it('returns 1.5x POSTER_SIZE for portrait (2:3)', () => {
    expect(posterHeightFor('portrait')).toBe(1620);
  });
});
