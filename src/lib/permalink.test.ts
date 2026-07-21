import { describe, it, expect } from 'vitest';
import { parseCantonParam, parseVenueParam, withVenueParam, withCantonParam } from './permalink';

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

describe('parseVenueParam', () => {
  it('returns the id verbatim', () => {
    expect(parseVenueParam('?venue=abc-123')).toBe('abc-123');
  });

  it('returns null when the param is missing', () => {
    expect(parseVenueParam('?foo=bar')).toBeNull();
  });

  it('returns null for an empty search string', () => {
    expect(parseVenueParam('')).toBeNull();
  });

  it('reads venue from among other query params', () => {
    expect(parseVenueParam('?foo=bar&venue=v1&baz=1')).toBe('v1');
  });

  it('returns null for an empty venue value', () => {
    expect(parseVenueParam('?venue=')).toBeNull();
  });
});

describe('withVenueParam', () => {
  it('sets venue on a bare path', () => {
    expect(withVenueParam('/', 'v1')).toBe('/?venue=v1');
  });

  it('sets venue alongside other existing params', () => {
    expect(withVenueParam('/?foo=bar', 'v1')).toBe('/?foo=bar&venue=v1');
  });

  it('clears venue when id is null', () => {
    expect(withVenueParam('/?venue=v1', null)).toBe('/');
  });

  it('clears venue but preserves other params', () => {
    expect(withVenueParam('/?foo=bar&venue=v1', null)).toBe('/?foo=bar');
  });

  it('strips an existing ctn param when setting venue', () => {
    expect(withVenueParam('/?ctn=FR', 'v1')).toBe('/?venue=v1');
  });

  it('strips an existing ctn param when clearing venue', () => {
    expect(withVenueParam('/?ctn=FR&venue=v1', null)).toBe('/');
  });
});

describe('withCantonParam', () => {
  it('sets ctn (uppercased) and drops any venue param', () => {
    expect(withCantonParam('https://x.app/', 'be')).toBe('https://x.app/?ctn=BE');
    expect(withCantonParam('https://x.app/?venue=v1', 'BE')).toBe('https://x.app/?ctn=BE');
  });
});
