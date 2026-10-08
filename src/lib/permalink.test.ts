import { describe, it, expect } from 'vitest';
import {
  parseCantonParam,
  parseVenueParam,
  parseAssociationParam,
  associationForCanton,
  withVenueParam,
  withCantonParam,
  withAssociationParam,
} from './permalink';

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

  it('strips an existing vb param', () => {
    expect(withVenueParam('/?vb=emmental', 'v1')).toBe('/?venue=v1');
    expect(withVenueParam('/?vb=emmental&venue=v1', null)).toBe('/');
  });
});

describe('withCantonParam', () => {
  it('sets ctn (uppercased) and drops any venue param', () => {
    expect(withCantonParam('https://x.app/', 'be')).toBe('https://x.app/?ctn=BE');
    expect(withCantonParam('https://x.app/?venue=v1', 'BE')).toBe('https://x.app/?ctn=BE');
  });

  it('drops any vb param', () => {
    expect(withCantonParam('https://x.app/?vb=emmental', 'BE')).toBe('https://x.app/?ctn=BE');
  });
});

describe('parseAssociationParam', () => {
  it('returns a Verband id', () => {
    expect(parseAssociationParam('?vb=emmental')).toBe('emmental');
  });

  it('returns a Teilverband id', () => {
    expect(parseAssociationParam('?vb=bksv')).toBe('bksv');
  });

  it('is case-insensitive', () => {
    expect(parseAssociationParam('?vb=Ob-Nidwalden')).toBe('ob-nidwalden');
  });

  it('ignores an unknown id', () => {
    expect(parseAssociationParam('?vb=nowhere')).toBeNull();
  });

  it('ignores the federation', () => {
    expect(parseAssociationParam('?vb=esv')).toBeNull();
  });

  it('returns null when the param is missing or empty', () => {
    expect(parseAssociationParam('?foo=bar')).toBeNull();
    expect(parseAssociationParam('?vb=')).toBeNull();
    expect(parseAssociationParam('')).toBeNull();
  });
});

describe('associationForCanton', () => {
  it('maps a canton with one home Verband to that Verband', () => {
    expect(associationForCanton('ZH')).toBe('zuerich');
    expect(associationForCanton('TI')).toBe('tessin');
  });

  it('maps both Appenzell cantons to appenzell', () => {
    expect(associationForCanton('AR')).toBe('appenzell');
    expect(associationForCanton('AI')).toBe('appenzell');
  });

  it('maps Obwalden and Nidwalden to ob-nidwalden', () => {
    expect(associationForCanton('OW')).toBe('ob-nidwalden');
    expect(associationForCanton('NW')).toBe('ob-nidwalden');
  });

  it('maps Bern to its Teilverband, since the canton alone does not name a Gau', () => {
    expect(associationForCanton('BE')).toBe('bksv');
  });

  it('returns null for an unknown canton', () => {
    expect(associationForCanton('XX')).toBeNull();
  });
});

describe('withAssociationParam', () => {
  it('sets vb (lowercased) and drops venue and ctn', () => {
    expect(withAssociationParam('https://x.app/', 'Emmental')).toBe('https://x.app/?vb=emmental');
    expect(withAssociationParam('https://x.app/?venue=v1&ctn=BE', 'bksv')).toBe('https://x.app/?vb=bksv');
  });

  it('keeps unrelated params', () => {
    expect(withAssociationParam('/?foo=bar', 'zuerich')).toBe('/?foo=bar&vb=zuerich');
  });
});
