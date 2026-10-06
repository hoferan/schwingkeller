import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR, type Lang } from '../../i18n/translations';
import { useAssociations } from './useAssociations';

const Probe = () => {
  const { nameOf, shortOf, regionalOf } = useAssociations();
  return (
    <ul>
      <li data-testid="name">{nameOf('swsv')}</li>
      <li data-testid="short">{shortOf('swsv')}</li>
      <li data-testid="cantonal-short">{String(shortOf('emmental'))}</li>
      <li data-testid="unknown">{nameOf('nowhere')}</li>
      <li data-testid="regional">{regionalOf('freiburg')?.id}</li>
    </ul>
  );
};

const renderIn = (lang: Lang) =>
  render(
    <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>
      <Probe />
    </I18nContext.Provider>,
  );

describe('useAssociations', () => {
  it('names associations in the current language', () => {
    renderIn('de');
    expect(screen.getByTestId('name')).toHaveTextContent('Südwestschweizer Schwingerverband');
    expect(screen.getByTestId('short')).toHaveTextContent('SWSV');
  });

  it('follows French', () => {
    renderIn('fr');
    expect(screen.getByTestId('name')).toHaveTextContent('Association romande de lutte suisse');
    expect(screen.getByTestId('short')).toHaveTextContent('ARLS');
  });

  it('has no short for a cantonal association, falls back to the id, and exposes the tree', () => {
    renderIn('de');
    expect(screen.getByTestId('cantonal-short')).toHaveTextContent('null');
    expect(screen.getByTestId('unknown')).toHaveTextContent('nowhere');
    expect(screen.getByTestId('regional')).toHaveTextContent('swsv');
  });

  it('returns the same value while the language stays, so effects and memos depending on it hold', () => {
    const seen: unknown[] = [];
    const Capture = () => {
      seen.push(useAssociations());
      return null;
    };
    const wrap = (lang: Lang, children: ReactNode) => (
      <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>{children}</I18nContext.Provider>
    );
    const { rerender } = render(wrap('de', <Capture />));
    rerender(wrap('de', <Capture />));
    rerender(wrap('fr', <Capture />));
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[1]);
  });
});
