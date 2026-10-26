import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';
import { ScopeChips } from './ScopeChips';
import { grantableBoard, invitableBoard, scopeCounts, type ScopeBoard, type ScopeCount } from './scopeOptions';

const t = STR.de;
const a = associationsFor('de');

const renderChips = ({
  board = grantableBoard(a, 'esv'),
  counts = scopeCounts(a, []),
  value = '',
}: { board?: ScopeBoard; counts?: ((id: string) => ScopeCount) | null; value?: string } = {}) => {
  const onChange = vi.fn();
  render(
    <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
      <div id="scope-label">{t.accountsScope}</div>
      <ScopeChips board={board} counts={counts} value={value} onChange={onChange} labelledBy="scope-label" />
    </I18nContext.Provider>,
  );
  return { onChange };
};

describe('ScopeChips', () => {
  it('renders every node of the ESV board as a radio', () => {
    renderChips();
    expect(screen.getAllByRole('radio')).toHaveLength(a.byId.size);
    expect(screen.getByRole('radiogroup', { name: t.accountsScope })).toBeInTheDocument();
  });

  it('checks the value and reports a new pick', async () => {
    const { onChange } = renderChips({ value: 'emmental' });
    expect(screen.getByRole('radio', { name: /^Emmental/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /^Seeland/ }));
    expect(onChange).toHaveBeenCalledWith('seeland');
  });

  it('names each Teilverband block', () => {
    renderChips();
    const bksv = screen.getByRole('group', { name: /Bernisch-Kantonaler Schwingerverband/ });
    expect(within(bksv).getAllByRole('radio')).toHaveLength(7);
  });

  it("shows the own Teilverband as a heading when it can't be picked", () => {
    renderChips({ board: grantableBoard(a, 'bksv') });
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.queryByRole('radio', { name: new RegExp(t.scopeWholeRegional) })).toBeNull();
    expect(screen.getByRole('group', { name: /Bernisch-Kantonaler/ })).toBeInTheDocument();
  });

  it('offers the whole Teilverband when it can be picked', () => {
    renderChips({ board: invitableBoard(a, 'bksv') });
    expect(screen.getByRole('radio', { name: new RegExp(`^${t.scopeWholeRegional}`) })).toBeInTheDocument();
  });

  it('reads the counts out', () => {
    renderChips({ counts: scopeCounts(a, ['emmental', 'emmental']) });
    expect(screen.getByRole('radio', { name: /^Emmental.*Benutzer: 2/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^ESV.*Benutzer: 0.*2 darunter/ })).toBeInTheDocument();
  });

  it('shows no counts while they load', () => {
    renderChips({ counts: null });
    expect(screen.queryByText(/Benutzer/)).toBeNull();
    expect(screen.queryByText(/darunter/)).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('repeats the pick under the board', () => {
    renderChips({ value: 'emmental' });
    expect(screen.getByText(`${t.accountsScope}: Verband Emmental`)).toBeInTheDocument();
  });

  it('repeats nothing while nothing is picked', () => {
    renderChips();
    expect(screen.queryByText(new RegExp(`^${t.accountsScope}:`))).toBeNull();
  });
});
