import { describe, it, expect } from 'vitest';
import { STR, LANGS } from './translations';

describe('translations', () => {
  it('defines de, fr, it', () => { expect(LANGS).toEqual(['de', 'fr', 'it']); });
  it('all languages share the same keys', () => {
    const keys = Object.keys(STR.de).sort();
    expect(Object.keys(STR.fr).sort()).toEqual(keys);
    expect(Object.keys(STR.it).sort()).toEqual(keys);
  });
  it('resolves a known key', () => { expect(STR.de.search).toBe('Schwingkeller suchen …'); });
  it('defines the admin-section and sort-label keys in every language', () => {
    for (const lang of LANGS) {
      expect(STR[lang].adminSection).toBeTruthy();
      expect(STR[lang].byName).toBeTruthy();
      expect(STR[lang].byDistance).toBeTruthy();
    }
  });
  it('defines the Verband sidebar keys in every language', () => {
    for (const lang of LANGS) {
      for (const key of ['byAssociation', 'sortAssociation', 'associationEmpty'] as const) {
        expect(STR[lang][key]).toBeTruthy();
      }
    }
  });
  it('defines the map legend keys in every language', () => {
    for (const lang of LANGS) {
      for (const key of ['legendTitle', 'legendShow', 'legendHide'] as const) {
        expect(STR[lang][key]).toBeTruthy();
      }
    }
  });
  it('defines the canton-poster keys in every language', () => {
    for (const lang of LANGS) {
      expect(STR[lang].generatePoster).toBeTruthy();
      expect(STR[lang].posterGenerateFailed).toBeTruthy();
    }
  });
  it('defines the landscape-format and venue-label keys in every language', () => {
    for (const lang of LANGS) {
      expect(STR[lang].posterFormatLandscape).toBeTruthy();
      expect(STR[lang].posterToggleLabels).toBeTruthy();
    }
  });
});
