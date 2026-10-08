import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { wappenUrl } from '../../data/cantons';
import type { Venue } from '../venues/types';
import { AssociationGroups } from './AssociationGroups';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'FR', address: 'Weg 1, 1700 Fribourg', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: null, ...over,
});

// Names that are not also association names, so a text query finds the row and not a header.
const venues = [
  v({ id: 'f1', name: 'Halle Düdingen', canton: 'FR', association_id: 'freiburg' }),
  v({ id: 'f2', name: 'Keller Plaffeien', canton: 'FR', association_id: 'freiburg' }),
  v({ id: 'l1', name: 'Keller Willisau', canton: 'LU', association_id: 'luzern' }),
  v({ id: 'e1', name: 'Schwingkeller Escholzmatt', canton: 'LU', association_id: 'emmental' }),
  v({ id: 'n1', name: 'Keller ohne Zuordnung', canton: 'BE', association_id: null }),
];

const ALL_OPEN = { bksv: true, isv: true, nosv: true, nwsv: true, swsv: true };

interface HarnessProps {
  list?: Venue[];
  filtering?: boolean;
  isAdmin?: boolean;
  expandedInit?: Record<string, boolean>;
}

const Harness = ({ list = venues, filtering = false, isAdmin = false, expandedInit = ALL_OPEN }: HarnessProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(expandedInit);
  return (
    <AssociationGroups
      list={list}
      filtering={filtering}
      isAdmin={isAdmin}
      expanded={expanded}
      onToggle={(key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
      selectedId={null}
      onSelect={() => {}}
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

  it('shows Ohne Verband to admins, after the Teilverbände', () => {
    renderGroups({ isAdmin: true });
    const group = screen.getByTestId('group-unassigned');
    expect(group).toHaveTextContent(STR.de.unassignedGroup);
    expect(group).toHaveTextContent('1');
    const ids = screen.getAllByRole('button').map((b) => b.dataset.testid);
    expect(ids.indexOf('group-unassigned')).toBe(ids.length - 1);
  });

  it('hides Ohne Verband from visitors', () => {
    renderGroups({ isAdmin: false });
    expect(screen.queryByTestId('group-unassigned')).toBeNull();
    expect(screen.queryByText('Keller ohne Zuordnung')).toBeNull();
  });

  it('hides Ohne Verband from admins when every venue has a Verband', () => {
    renderGroups({ isAdmin: true, list: venues.slice(0, 4) });
    expect(screen.queryByTestId('group-unassigned')).toBeNull();
  });

  it('treats a non-cantonal or unknown association id as unassigned', async () => {
    const user = userEvent.setup();
    const odd = [
      v({ id: 'x1', name: 'Keller Regional', association_id: 'bksv' }),
      v({ id: 'x2', name: 'Keller Veraltet', association_id: 'gone' }),
    ];
    renderGroups({ isAdmin: true, list: odd, expandedInit: { ...ALL_OPEN, unassigned: true } });
    expect(screen.getByTestId('group-bksv')).toHaveTextContent('0');
    const unassigned = screen.getByTestId('group-unassigned');
    expect(unassigned).toHaveTextContent('2');
    expect(screen.getAllByTestId('venue-row')).toHaveLength(2);
    await user.click(unassigned);
    expect(screen.queryByTestId('venue-row')).toBeNull();
  });

  it('renders no poster button', () => {
    renderGroups({ isAdmin: true });
    expect(screen.queryByRole('button', { name: STR.de.generatePoster })).toBeNull();
  });

  it('names each Teilverband with its badge and each Verband with its name', () => {
    renderGroups();
    const swsv = screen.getByTestId('group-swsv');
    expect(within(swsv).getByText('SWSV')).toBeInTheDocument();
    expect(swsv).toHaveTextContent('Südwestschweizer Schwingerverband');
    expect(screen.getByTestId('group-freiburg')).toHaveTextContent('Freiburg');
  });
});
