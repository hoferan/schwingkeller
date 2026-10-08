import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR, type Lang } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { MapLegend } from './MapLegend';

const venue = (associationId: string | null): Venue => ({
  id: String(associationId), name: 'Keller', canton: 'BE', address: '', lat: 46.9, lng: 7.7,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: associationId,
});

const renderLegend = (venues: Venue[], isMobile = false, lang: Lang = 'de') =>
  render(
    <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang: vi.fn() }}>
      <MapLegend venues={venues} isMobile={isMobile} />
    </I18nContext.Provider>,
  );

describe('MapLegend', () => {
  it('names the five Teilverbände, with the full name as the title', () => {
    renderLegend([venue('emmental')]);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['BKSV', 'ISV', 'NOSV', 'NWSV', 'SWSV']);
    expect(screen.getByText('NOSV').closest('li')?.getAttribute('title')).toBe('Nordostschweizer Schwingerverband');
  });

  it('uses the current language', () => {
    renderLegend([venue('emmental')], false, 'fr');
    expect(screen.getByText('ARLS')).toBeTruthy();
    expect(screen.getByRole('button', { name: STR.fr.legendHide })).toBeTruthy();
  });

  it('adds a row for venues without an association only when there is one', () => {
    renderLegend([venue('emmental'), venue(null)]);
    expect(screen.getByText('Ohne Verband')).toBeTruthy();
  });

  it('has no unassigned row for an empty map', () => {
    renderLegend([]);
    expect(screen.queryByText('Ohne Verband')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('starts open on a larger screen and can be closed', () => {
    renderLegend([]);
    const toggle = screen.getByRole('button', { name: STR.de.legendHide });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('button', { name: STR.de.legendShow }).getAttribute('aria-expanded')).toBe('false');
  });

  it('starts collapsed on a phone and opens on a tap', () => {
    renderLegend([], true);
    expect(screen.queryByRole('list')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: STR.de.legendShow }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
