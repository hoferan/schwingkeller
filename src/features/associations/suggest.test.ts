import { describe, it, expect } from 'vitest';
import { suggestAssociation } from './suggest';

describe('suggestAssociation', () => {
  it('maps the two Appenzell and the two Unterwalden cantons to their shared association', () => {
    expect(['AR', 'AI'].map((canton) => suggestAssociation({ canton }))).toEqual(['appenzell', 'appenzell']);
    expect(['OW', 'NW'].map((canton) => suggestAssociation({ canton }))).toEqual(['ob-nidwalden', 'ob-nidwalden']);
  });

  it('maps a canton with its own association', () => {
    expect(suggestAssociation({ canton: 'ZH' })).toBe('zuerich');
    expect(suggestAssociation({ canton: 'TI' })).toBe('tessin');
  });

  it('accepts lower-case and padded canton codes', () => {
    expect(suggestAssociation({ canton: 'zh' })).toBe('zuerich');
    expect(suggestAssociation({ canton: ' fr ' })).toBe('freiburg');
  });

  it.each([
    ['Berner Jura', 'berner-jura'],
    ['Biel/Bienne', 'seeland'],
    ['Seeland', 'seeland'],
    ['Oberaargau', 'oberaargau'],
    ['Emmental', 'emmental'],
    ['Bern-Mittelland', 'mittelland'],
    ['Thun', 'oberland'],
    ['Frutigen-Niedersimmental', 'oberland'],
    ['Interlaken-Oberhasli', 'oberland'],
    ['Obersimmental-Saanen', 'oberland'],
  ])('maps the Bernese district %s to %s', (bernDistrict, expected) => {
    expect(suggestAssociation({ canton: 'BE', bernDistrict })).toBe(expected);
    expect(suggestAssociation({ canton: ' be', bernDistrict })).toBe(expected);
  });

  it('does not guess a Gau without a known district', () => {
    expect(suggestAssociation({ canton: 'BE', bernDistrict: 'Nowhere' })).toBeNull();
    expect(suggestAssociation({ canton: 'BE', bernDistrict: null })).toBeNull();
    expect(suggestAssociation({ canton: 'BE' })).toBeNull();
  });

  it('has no suggestion for an unknown or missing canton', () => {
    expect(suggestAssociation({ canton: 'XX' })).toBeNull();
    expect(suggestAssociation({ canton: 'FL' })).toBeNull();
    expect(suggestAssociation({ canton: null })).toBeNull();
  });
});
