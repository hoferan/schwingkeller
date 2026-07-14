import { createContext, useContext } from 'react';
import { STR, LANGS, type Lang } from './translations';

interface I18nValue { lang: Lang; t: typeof STR.de; setLang: (l: Lang) => void }
export const I18nContext = createContext<I18nValue | null>(null);

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nContext');
  return ctx;
};

export const detectLang = (): Lang => {
  const prefs =
    (typeof navigator !== 'undefined' && (navigator.languages ?? [navigator.language])) || [];
  for (const tag of prefs) {
    const primary = (tag ?? '').toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(primary)) return primary as Lang;
  }
  return 'de';
};

export const loadLang = (): Lang => {
  try { return (localStorage.getItem('schwing_lang') as Lang) || 'de'; } catch { return 'de'; }
};
export const saveLang = (l: Lang) => { try { localStorage.setItem('schwing_lang', l); } catch { /* ignore */ } };
