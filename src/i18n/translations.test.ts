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
  // The account list fills these placeholders in; a translation that drops one shows a gap.
  it('keeps the account list placeholders in every language', () => {
    for (const lang of LANGS) {
      expect(STR[lang].accountsPendingCount).toContain('{n}');
      expect(STR[lang].scopeBelow).toContain('{n}');
      expect(STR[lang].accountsPrevious).toContain('{scope}');
      expect(STR[lang].deleteAccountBody).toContain('{email}');
    }
  });
  it('defines the account menu and self-deletion keys in every language', () => {
    for (const lang of LANGS) {
      for (const key of [
        'accountMenu',
        'deleteOwnAccount',
        'deleteOwnPassword',
        'deleteOwnErrPassword',
        'deleteOwnErrLastSuperAdmin',
        'deleteOwnErrTooMany',
        'accountDeleted',
      ] as const) {
        expect(STR[lang][key]).toBeTruthy();
      }
      expect(STR[lang].deleteOwnBody).toContain('{email}');
    }
  });
  // The form fills in the minimum from MIN_PASSWORD_LENGTH, so the number lives in one place.
  it('leaves the minimum password length to the form', () => {
    for (const lang of LANGS) {
      for (const key of ['registerErrShort', 'passwordRule'] as const) {
        expect(STR[lang][key]).toContain('{n}');
        expect(STR[lang][key]).not.toMatch(/\d/);
      }
    }
  });
});
