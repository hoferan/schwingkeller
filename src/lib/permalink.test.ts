import { describe, it, expect } from 'vitest';
import { parseCantonParam } from './permalink';

describe('parseCantonParam', () => {
  it('returns the uppercase code for a valid canton', () => {
    expect(parseCantonParam('?ctn=FR')).toBe('FR');
  });

  it('is case-insensitive', () => {
    expect(parseCantonParam('?ctn=fr')).toBe('FR');
  });

  it('returns null for an unrecognized code', () => {
    expect(parseCantonParam('?ctn=XX')).toBeNull();
  });

  it('returns null when the param is missing', () => {
    expect(parseCantonParam('?foo=bar')).toBeNull();
  });

  it('returns null for an empty search string', () => {
    expect(parseCantonParam('')).toBeNull();
  });

  it('reads ctn from among other query params', () => {
    expect(parseCantonParam('?foo=bar&ctn=be&baz=1')).toBe('BE');
  });
});
