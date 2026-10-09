import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR, type Lang } from '../../i18n/translations';
import { theme } from '../../theme';
import { MapLegend } from './MapLegend';

const renderLegend = (isMobile = false, lang: Lang = 'de') =>
  render(
    <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>
      <MapLegend isMobile={isMobile} />
    </I18nContext.Provider>,
  );

describe('MapLegend', () => {
  it('names the five Teilverbände, with the full name as the title', () => {
    renderLegend();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['BKSV', 'ISV', 'NOSV', 'NWSV', 'SWSV']);
    expect(screen.getByText('NOSV').closest('li')?.getAttribute('title')).toBe('Nordostschweizer Schwingerverband');
  });

  it('uses the current language', () => {
    renderLegend(false, 'fr');
    expect(screen.getByText('ARLS')).toBeTruthy();
    expect(screen.getByRole('button', { name: STR.fr.legendHide })).toBeTruthy();
  });

  it('draws each row with the colour of its pins', () => {
    renderLegend();
    const dotOf = (label: string) => screen.getByText(label).closest('li')?.querySelector('span');
    expect(dotOf('ISV')).toHaveStyle({ backgroundColor: 'rgb(227, 6, 19)' });
    expect(dotOf('SWSV')).toHaveStyle({ backgroundColor: 'rgb(93, 107, 128)' });
  });

  it('starts open on a larger screen and can be closed', () => {
    renderLegend();
    const toggle = screen.getByRole('button', { name: STR.de.legendHide });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('button', { name: STR.de.legendShow }).getAttribute('aria-expanded')).toBe('false');
  });

  it('starts collapsed on a phone and opens on a tap', () => {
    renderLegend(true);
    expect(screen.queryByRole('list')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: STR.de.legendShow }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('looks like the map/satellite switch: grey and flat', () => {
    renderLegend();
    const card = screen.getByRole('button', { name: STR.de.legendHide }).parentElement as HTMLElement;
    // jsdom reports colours as rgb(), so compare against the paper colour as jsdom writes it.
    const paper = document.createElement('div');
    paper.style.background = theme.color.paper;
    expect(card.style.background).toBe(paper.style.background);
    expect(card.style.boxShadow).toBe('');
  });
});
