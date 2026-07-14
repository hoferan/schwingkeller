import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectLang } from './useTranslation';

const mockLanguages = (langs: readonly string[] | undefined) => {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(
    langs as unknown as readonly string[],
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectLang', () => {
  it('maps a regioned French tag to fr', () => {
    mockLanguages(['fr-CH']);
    expect(detectLang()).toBe('fr');
  });

  it('maps a bare Italian tag to it', () => {
    mockLanguages(['it']);
    expect(detectLang()).toBe('it');
  });

  it('maps a German tag to de', () => {
    mockLanguages(['de-DE']);
    expect(detectLang()).toBe('de');
  });

  it('picks the first supported language in an ordered list', () => {
    mockLanguages(['en-US', 'fr-CH', 'de-CH']);
    expect(detectLang()).toBe('fr');
  });

  it('falls back to de when the only language is unsupported', () => {
    mockLanguages(['en-US']);
    expect(detectLang()).toBe('de');
  });

  it('falls back to de for Romansh', () => {
    mockLanguages(['rm-CH']);
    expect(detectLang()).toBe('de');
  });

  it('falls back to de for an empty list', () => {
    mockLanguages([]);
    expect(detectLang()).toBe('de');
  });

  it('falls back to navigator.language when languages is undefined', () => {
    mockLanguages(undefined);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('it-IT');
    expect(detectLang()).toBe('it');
  });
});

import { loadLang } from './useTranslation';

describe('loadLang', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns a valid stored value without detecting', () => {
    localStorage.setItem('schwing_lang', 'fr');
    const langsGet = vi.spyOn(window.navigator, 'languages', 'get');
    expect(loadLang()).toBe('fr');
    expect(langsGet).not.toHaveBeenCalled();
  });

  it('detects and persists when nothing is stored', () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-CH']);
    expect(loadLang()).toBe('fr');
    expect(localStorage.getItem('schwing_lang')).toBe('fr');
  });

  it('ignores an invalid stored value and falls through to detection', () => {
    localStorage.setItem('schwing_lang', 'en');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['it-IT']);
    expect(loadLang()).toBe('it');
    expect(localStorage.getItem('schwing_lang')).toBe('it');
  });

  it('returns de when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadLang()).toBe('de');
  });
});
