import { createContext, useContext } from 'react';
import { STR, type Lang } from './translations';

interface I18nValue { lang: Lang; t: typeof STR.de; setLang: (l: Lang) => void }
export const I18nContext = createContext<I18nValue | null>(null);

export const useTranslation = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nContext');
  return ctx;
};

export const loadLang = (): Lang => {
  try { return (localStorage.getItem('schwing_lang') as Lang) || 'de'; } catch { return 'de'; }
};
export const saveLang = (l: Lang) => { try { localStorage.setItem('schwing_lang', l); } catch { /* ignore */ } };
