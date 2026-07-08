import { describe, it, expect } from 'vitest';
import { theme } from './theme';

describe('theme tokens', () => {
  it('defines the red/black/white palette with a light hairline border', () => {
    expect(theme.color.bg).toBe('#ffffff');
    expect(theme.color.ink).toBe('#111111');
    expect(theme.color.accent).toBe('#e30613');
    expect(theme.color.accentInk).toBe('#ffffff');
    expect(theme.color.line).toBe('#e2e2e2');
  });

  it('uses Oswald for display text and keeps Work Sans for body text', () => {
    expect(theme.font.display).toBe("'Oswald', sans-serif");
    expect(theme.font.body).toBe("'Work Sans', sans-serif");
  });

  it('defines soft rounded-card radii and a floating-element shadow', () => {
    expect(theme.radius.sm).toBe('10px');
    expect(theme.radius.pill).toBe('999px');
    expect(theme.shadow).toBe('0 4px 16px rgba(0,0,0,.12)');
  });
});
