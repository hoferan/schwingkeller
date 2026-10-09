import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { wappenUrl } from '../../data/cantons';
import type { Venue } from '../venues/types';
import type { PosterTarget } from '../venues/posterSubject';
import { AssociationGroups } from './AssociationGroups';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'FR', address: 'Weg 1, 1700 Fribourg', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'freiburg', ...over,
});

// Names that are not also association names, so a text query finds the row and not a header.
const venues = [
  v({ id: 'f1', name: 'Halle Düdingen', canton: 'FR', association_id: 'freiburg' }),
  v({ id: 'f2', name: 'Keller Plaffeien', canton: 'FR', association_id: 'freiburg' }),
  v({ id: 'l1', name: 'Keller Willisau', canton: 'LU', association_id: 'luzern' }),
  v({ id: 'e1', name: 'Schwingkeller Escholzmatt', canton: 'LU', association_id: 'emmental' }),
];

const ALL_OPEN = { bksv: true, isv: true, nosv: true, nwsv: true, swsv: true };

interface HarnessProps {
  list?: Venue[];
  filtering?: boolean;
  expandedInit?: Record<string, boolean>;
  isAdmin?: boolean;
  onGeneratePoster?: (target: PosterTarget) => void;
}

const Harness = ({
  list = venues, filtering = false, expandedInit = ALL_OPEN, isAdmin = false, onGeneratePoster = () => {},
}: HarnessProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(expandedInit);
  return (
    <AssociationGroups
      list={list}
      filtering={filtering}
      expanded={expanded}
      onToggle={(key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
      selectedId={null}
      onSelect={() => {}}
      isAdmin={isAdmin}
      onGeneratePoster={onGeneratePoster}
    />
  );
};

const renderGroups = (props: HarnessProps = {}) =>
  render(
    <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
      <Harness {...props} />
    </I18nContext.Provider>,
  );

const REGIONAL = ['bksv', 'isv', 'nosv', 'nwsv', 'swsv'];

describe('AssociationGroups', () => {
  it('lists the five Teilverbände open, each total the sum of its Verbände', () => {
    renderGroups();
    for (const id of REGIONAL) {
      expect(screen.getByTestId(`group-${id}`)).toHaveAttribute('aria-expanded', 'true');
    }
    expect(screen.getByTestId('group-swsv')).toHaveTextContent('2');
    expect(screen.getByTestId('group-isv')).toHaveTextContent('1');
    expect(screen.getByTestId('group-bksv')).toHaveTextContent('1');
    expect(screen.getByTestId('group-nosv')).toHaveTextContent('0');
  });

  it('lists all 29 Verbände closed while not filtering', () => {
    renderGroups();
    const verbaende = screen
      .getAllByRole('button')
      .filter((b) => !REGIONAL.includes(b.dataset.testid!.replace('group-', '')));
    expect(verbaende).toHaveLength(29);
    verbaende.forEach((b) => expect(b).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.queryByTestId('venue-row')).toBeNull();
  });

  it('opens a Verband on click and shows its venues', async () => {
    const user = userEvent.setup();
    renderGroups();
    await user.click(screen.getByTestId('group-freiburg'));
    expect(screen.getByTestId('group-freiburg')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('venue-row').map((r) => r.textContent)).toEqual([
      expect.stringContaining('Halle Düdingen'),
      expect.stringContaining('Keller Plaffeien'),
    ]);
  });

  it('closes a Teilverband on click', async () => {
    const user = userEvent.setup();
    renderGroups();
    await user.click(screen.getByTestId('group-swsv'));
    expect(screen.getByTestId('group-swsv')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('group-freiburg')).toBeNull();
  });

  it('shows the empty message for an open Verband without venues', async () => {
    const user = userEvent.setup();
    renderGroups();
    expect(screen.queryByText(STR.de.associationEmpty)).toBeNull();
    await user.click(screen.getByTestId('group-zug'));
    expect(screen.getByText(STR.de.associationEmpty)).toBeInTheDocument();
  });

  it('lists a cross-border venue under its Verband with its own canton arms', async () => {
    const user = userEvent.setup();
    renderGroups();
    await user.click(screen.getByTestId('group-emmental'));
    const row = screen.getByTestId('venue-row');
    expect(row).toHaveTextContent('Schwingkeller Escholzmatt');
    expect(row.querySelector('img')).toHaveAttribute('src', wappenUrl('LU'));
  });

  it('forces every matching group open while filtering and hides the rest', () => {
    renderGroups({ list: venues.slice(0, 2), filtering: true, expandedInit: {} });
    expect(screen.getAllByRole('button').map((b) => b.dataset.testid)).toEqual(['group-swsv', 'group-freiburg']);
    expect(screen.getByTestId('group-swsv')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('group-freiburg')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('venue-row')).toHaveLength(2);
  });

  it('starts every Teilverband name at the same place', () => {
    renderGroups();
    const leads = REGIONAL.map(
      (id) => (screen.getByTestId(`group-${id}`).firstElementChild as HTMLElement).style.width,
    );
    expect(leads[0]).not.toBe('');
    expect(new Set(leads).size).toBe(1);
  });

  it('shows admins a poster button on every Verband row and none on Teilverband rows', () => {
    renderGroups({ isAdmin: true });
    expect(screen.getAllByRole('button', { name: STR.de.generatePoster })).toHaveLength(29);
    expect(screen.getByTestId('generate-poster-freiburg')).toHaveAccessibleName(STR.de.generatePoster);
    expect(screen.queryByTestId('generate-poster-swsv')).toBeNull();
  });

  it('shows non-admins no poster button', () => {
    renderGroups();
    expect(screen.queryAllByRole('button', { name: STR.de.generatePoster })).toHaveLength(0);
  });

  it('asks for the Verband poster without toggling the row', async () => {
    const user = userEvent.setup();
    const onGeneratePoster = vi.fn();
    renderGroups({ isAdmin: true, onGeneratePoster });
    await user.click(screen.getByTestId('generate-poster-freiburg'));
    expect(onGeneratePoster).toHaveBeenCalledTimes(1);
    expect(onGeneratePoster).toHaveBeenCalledWith({ kind: 'association', id: 'freiburg' });
    expect(screen.getByTestId('group-freiburg')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Halle Düdingen')).toBeNull();
  });

  it('opens the poster from the keyboard without toggling the row', async () => {
    const user = userEvent.setup();
    const onGeneratePoster = vi.fn();
    renderGroups({ isAdmin: true, onGeneratePoster });
    screen.getByTestId('generate-poster-freiburg').focus();
    await user.keyboard('{Enter}');
    expect(onGeneratePoster).toHaveBeenCalledWith({ kind: 'association', id: 'freiburg' });
    expect(screen.getByTestId('group-freiburg')).toHaveAttribute('aria-expanded', 'false');
  });

  it('asks for the poster while filtering, with the groups forced open', async () => {
    const user = userEvent.setup();
    const onGeneratePoster = vi.fn();
    renderGroups({ isAdmin: true, filtering: true, onGeneratePoster });
    await user.click(screen.getByTestId('generate-poster-freiburg'));
    expect(onGeneratePoster).toHaveBeenCalledWith({ kind: 'association', id: 'freiburg' });
    expect(screen.getByText('Halle Düdingen')).toBeInTheDocument();
  });

  it('nests no button inside another button', () => {
    const { container } = renderGroups({ isAdmin: true });
    expect(container.querySelectorAll('button button')).toHaveLength(0);
  });

  it('names each Teilverband with its badge and each Verband with its name', () => {
    renderGroups();
    const swsv = screen.getByTestId('group-swsv');
    expect(within(swsv).getByText('SWSV')).toBeInTheDocument();
    expect(swsv).toHaveTextContent('Südwestschweizer Schwingerverband');
    expect(screen.getByTestId('group-freiburg')).toHaveTextContent('Freiburg');
  });
});
