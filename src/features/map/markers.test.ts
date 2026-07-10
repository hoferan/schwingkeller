import { describe, it, expect } from 'vitest';
import { pinHtml } from './markers';

describe('markers html', () => {
  it('pinHtml renders same color for both selected and unselected states with flat theme', () => {
    // With the flat theme, selected and unselected states render identically since there's only one accent color
    expect(pinHtml(true)).toBe(pinHtml(false));
  });
});
