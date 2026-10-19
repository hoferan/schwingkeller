import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { CantonGroups } from './CantonGroups';

const v = (id: string, canton: string): Venue => ({
  id, name: `Keller ${id}`, canton, address: '', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental',
} as Venue);

const venues = [v('b1', 'BE'), v('l1', 'LU')];

const renderGroups = (canPrintPoster: (code: string) => boolean) =>
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <CantonGroups
        list={venues}
        filtering={false}
        canPrintPoster={canPrintPoster}
        expanded={{}}
        onToggle={() => {}}
        selectedId={null}
        onSelect={() => {}}
        onGeneratePoster={() => {}}
      />
    </I18nContext.Provider>,
  );

describe('CantonGroups', () => {
  it('shows the poster button only for cantons canPrintPoster accepts', () => {
    renderGroups((code) => code === 'BE');
    expect(screen.getByTestId('generate-poster-BE')).toBeInTheDocument();
    expect(screen.queryByTestId('generate-poster-LU')).toBeNull();
    expect(screen.getAllByRole('button', { name: STR.de.generatePoster })).toHaveLength(1);
  });

  it('shows no poster button when nothing is accepted', () => {
    renderGroups(() => false);
    expect(screen.queryAllByRole('button', { name: STR.de.generatePoster })).toHaveLength(0);
  });
});
