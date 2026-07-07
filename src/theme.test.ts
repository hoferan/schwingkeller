import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme tokens', () => {
  it('defines the flat red/black/white palette', () => {
    expect(theme.color.bg).toBe('#ffffff');
    expect(theme.color.ink).toBe('#111111');
    expect(theme.color.accent).toBe('#e30613');
    expect(theme.color.accentInk).toBe('#ffffff');
    expect(theme.color.line).toBe('#111111');
  });

  it('uses Oswald for display text and keeps Work Sans for body text', () => {
    expect(theme.font.display).toBe("'Oswald', sans-serif");
    expect(theme.font.body).toBe("'Work Sans', sans-serif");
  });

  it('is fully flat: zero corner radius', () => {
    expect(theme.radius).toBe('0px');
  });
});
