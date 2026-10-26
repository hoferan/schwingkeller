import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Each from() call gets its own builder, so the list query can be told apart from the
// approved-scopes query, the pending count and the invitations. `lists` records the status filter
// of every list query, null for "all".
const { from, rpc, state } = vi.hoisted(() => {
  const state: {
    rows: unknown[]; lists: (string | null)[]; listError: unknown; invitations: unknown[]; pendingCount: number;
  } = { rows: [], lists: [], listError: null, invitations: [], pendingCount: 0 };
  const from = vi.fn((table: string) => {
    let columns = '';
    let status: string | null = null;
    const builder: Record<string, unknown> = {};
    builder.select = (c: string) => {
      columns = c;
      return builder;
    };
    builder.eq = (_col: string, value: string) => {
      status = value;
      return builder;
    };
    builder.order = () => builder;
    builder.then = (resolve: (v: unknown) => unknown) => {
      if (table === 'invitations') return resolve({ data: state.invitations, error: null });
      if (columns === 'scope_association_id') return resolve({ data: [], error: null });
      if (columns === 'id') return resolve({ data: null, count: state.pendingCount, error: null });
      state.lists.push(status);
      return resolve(state.listError ? { data: null, error: state.listError } : { data: state.rows, error: null });
    };
    return builder;
  });
  return { from, rpc: vi.fn(), state };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { TestAuthProvider, type TestAccount } from '../auth/testing';
import type { Account } from './accounts';
import { AccountsPanel } from './AccountsPanel';
import type { Invitation } from './invitations';

const t = STR.de;

const invitation = (over: Partial<Invitation>): Invitation => ({
  id: 'i1',
  email: 'anna@example.ch',
  association_id: 'emmental',
  invited_by: 'someone-else',
  created_at: '2026-10-19T08:00:00Z',
  expires_at: '2099-10-26T08:00:00Z',
  ...over,
});

const account = (over: Partial<Account>): Account => ({
  id: 'u2',
  email: 'gau@example.ch',
  status: 'pending',
  requested_association_id: 'emmental',
  scope_association_id: null,
  created_at: '2026-10-19T08:00:00Z',
  ...over,
});

const renderPanel = (isMobile = false, as: TestAccount = 'bksv') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <AccountsPanel onClose={vi.fn()} isMobile={isMobile} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );
};

const row = (email: string) => screen.findByTestId(`account-${email}`);

beforeEach(() => {
  state.rows = [account({})];
  state.lists = [];
  state.listError = null;
  state.invitations = [];
  state.pendingCount = 0;
  from.mockClear();
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe('AccountsPanel', () => {
  it('starts with the pending accounts', async () => {
    renderPanel();
    await row('gau@example.ch');
    expect(state.lists).toEqual(['pending']);
    expect((screen.getByLabelText(t.accountsFilter) as HTMLSelectElement).value).toBe('pending');
  });

  it('reads every account for "all"', async () => {
    renderPanel();
    await row('gau@example.ch');
    await userEvent.selectOptions(screen.getByLabelText(t.accountsFilter), 'all');
    await waitFor(() => expect(state.lists).toContain(null));
  });

  it('shows a table on wide screens and cards on phones', async () => {
    renderPanel(false);
    expect(within(await screen.findByRole('table')).getByText('gau@example.ch')).toBeInTheDocument();
  });

  it('shows cards on phones', async () => {
    renderPanel(true);
    expect(within(await screen.findByRole('list')).getByText('gau@example.ch')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('takes the whole screen on phones', async () => {
    renderPanel(true);
    const card = (await row('gau@example.ch')).closest('.sk-scroll')?.parentElement;
    expect(card).toHaveStyle({ width: '100%', borderRadius: '0px' });
  });

  // The select's value says what it filters, so phones skip the visible label. Screen readers keep it.
  it('hides the filter label on phones, but not from screen readers', async () => {
    renderPanel(true);
    await row('gau@example.ch');
    expect(screen.getByLabelText(t.accountsFilter)).toBeInTheDocument();
    expect(screen.getByText(t.accountsFilter)).toHaveStyle({ position: 'absolute', width: '1px', height: '1px' });
  });

  it('shows the filter label on wider screens', async () => {
    renderPanel(false);
    await row('gau@example.ch');
    expect(screen.getByText(t.accountsFilter, { selector: 'label' })).not.toHaveStyle({ position: 'absolute' });
  });

  it('stays a floating box on wider screens', async () => {
    renderPanel(false);
    const card = (await row('gau@example.ch')).closest('.sk-scroll')?.parentElement;
    expect(card).toHaveStyle({ width: '960px' });
  });

  // "Gewünschter Verband: Verband Emmental" would name the level twice.
  it('labels the requested Verband briefly on a card', async () => {
    renderPanel(true);
    const r = await row('gau@example.ch');
    expect(r).toHaveTextContent(`${t.accountsRequestedShort}: Verband Emmental`);
    expect(r).not.toHaveTextContent(t.accountsRequested);
  });

  it('describes a pending account', async () => {
    renderPanel();
    const r = await row('gau@example.ch');
    expect(r).toHaveTextContent('Verband Emmental');
    expect(r).toHaveTextContent(t.accountStatusPending);
    expect(r).toHaveTextContent('19.10.2026');
  });

  it('marks the caller’s own row and offers no actions on it', async () => {
    state.rows = [account({ id: 'test-user', email: 'me@example.ch', status: 'approved', scope_association_id: 'bksv' })];
    renderPanel();
    const r = await row('me@example.ch');
    expect(r).toHaveTextContent(t.accountsYou);
    expect(within(r).queryAllByRole('button')).toEqual([]);
  });

  it('shows the old scope of an account back for review', async () => {
    state.rows = [account({ scope_association_id: 'mittelland' })];
    renderPanel();
    expect(await row('gau@example.ch')).toHaveTextContent('vorher Verband Mittelland');
  });

  it('shows a dash when the applicant named no Verband', async () => {
    state.rows = [account({ requested_association_id: null })];
    renderPanel();
    expect(await row('gau@example.ch')).toHaveTextContent('–');
  });

  it('rejects an account, once', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    renderPanel();
    const reject = within(await row('gau@example.ch')).getByRole('button', { name: t.reject });
    await userEvent.click(reject);
    expect(rpc).toHaveBeenCalledWith('reject_editor', { target_id: 'u2' });
    expect(reject).toBeDisabled();
  });

  it('explains a rejection someone else overtook, and reloads the list', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot reject an account that is approved' } });
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.reject }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.adminErrStale);
    await waitFor(() => expect(state.lists.length).toBeGreaterThan(1));
  });

  it('says so when no account has the status', async () => {
    state.rows = [];
    renderPanel();
    expect(await screen.findByText(t.accountsEmpty)).toBeInTheDocument();
  });

  // A blank panel would look like one still loading.
  it('says so when the list can’t be loaded', async () => {
    state.listError = { message: 'JWT expired' };
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(t.accountsLoadFailed);
  });

  // Reject runs without confirmation because it can be undone here.
  it('offers to approve a rejected account, but not to reject it again', async () => {
    state.rows = [account({ status: 'rejected' })];
    renderPanel();
    const r = await row('gau@example.ch');
    expect(within(r).getByRole('button', { name: t.approve })).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: t.reject })).toBeNull();
  });

  it('opens the approval for a pending account', async () => {
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.approve }));
    expect(screen.getByText(t.approveTitle)).toBeInTheDocument();
  });

  const buttons = async (email = 'gau@example.ch') =>
    within(await row(email)).getAllByRole('button').map((b) => b.textContent);

  const BY_STATUS = [
    ['pending', [t.approve, t.reject]],
    ['rejected', [t.approve]],
    ['approved', [t.changeScope, t.suspend]],
    ['suspended', [t.reactivate]],
  ] as const;

  it.each(BY_STATUS)('offers a Teilverband editor no delete on a %s account', async (status, expected) => {
    state.rows = [account({ status, scope_association_id: status === 'pending' ? null : 'emmental' })];
    renderPanel();
    expect(await buttons()).toEqual(expected);
  });

  it.each(BY_STATUS)('offers a super-admin delete on a %s account too', async (status, expected) => {
    state.rows = [account({ status, scope_association_id: status === 'pending' ? null : 'emmental' })];
    renderPanel(false, 'esv');
    expect(await buttons()).toEqual([...expected, t.delete]);
  });

  it('suspends an approved account, and blocks the row meanwhile', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    state.rows = [account({ status: 'approved', scope_association_id: 'emmental' })];
    renderPanel();
    const r = await row('gau@example.ch');
    await userEvent.click(within(r).getByRole('button', { name: t.suspend }));
    expect(rpc).toHaveBeenCalledWith('suspend_editor', { target_id: 'u2' });
    for (const b of within(r).getAllByRole('button')) expect(b).toBeDisabled();
  });

  it('leaves other rows usable while one is busy', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    state.rows = [
      account({ status: 'approved', scope_association_id: 'emmental' }),
      account({ id: 'u3', email: 'other@example.ch', status: 'approved', scope_association_id: 'seeland' }),
    ];
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.suspend }));
    expect(within(await row('other@example.ch')).getByRole('button', { name: t.suspend })).toBeEnabled();
  });

  it('reactivates a suspended account', async () => {
    state.rows = [account({ status: 'suspended', scope_association_id: 'emmental' })];
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.reactivate }));
    expect(rpc).toHaveBeenCalledWith('reactivate_editor', { target_id: 'u2' });
  });

  it('explains a refused suspension of the last super-admin', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot remove the last super-admin' } });
    state.rows = [account({ status: 'approved', scope_association_id: 'esv' })];
    renderPanel(false, 'esv');
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.suspend }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.adminErrLastSuperAdmin);
  });

  it('opens the scope change for an approved account', async () => {
    state.rows = [account({ status: 'approved', scope_association_id: 'emmental' })];
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.changeScope }));
    const dialog = screen.getByTestId('scope-dialog');
    expect((within(dialog).getByRole('radio', { checked: true }) as HTMLInputElement).value).toBe('emmental');
  });

  it('asks before deleting an account', async () => {
    state.rows = [account({ status: 'approved', scope_association_id: 'emmental' })];
    renderPanel(false, 'esv');
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.delete }));
    expect(screen.getByTestId('delete-account-dialog')).toHaveTextContent('gau@example.ch');
    expect(rpc).not.toHaveBeenCalled();
  });

  // One mutation serves every row, and TanStack Query only calls back the latest mutate() call.
  describe('acting on two rows at once', () => {
    const twoEditors = () => [
      account({ status: 'approved', scope_association_id: 'emmental' }),
      account({ id: 'u3', email: 'other@example.ch', status: 'approved', scope_association_id: 'seeland' }),
    ];

    it('keeps both rows busy while their actions run', async () => {
      rpc.mockReturnValue(new Promise(() => {}));
      state.rows = twoEditors();
      renderPanel();
      await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.suspend }));
      await userEvent.click(within(await row('other@example.ch')).getByRole('button', { name: t.suspend }));
      expect(within(await row('gau@example.ch')).getByRole('button', { name: t.suspend })).toBeDisabled();
      expect(within(await row('other@example.ch')).getByRole('button', { name: t.suspend })).toBeDisabled();
    });

    it('still explains a refusal of the first one', async () => {
      let refuseFirst: (v: unknown) => void = () => {};
      rpc
        .mockReturnValueOnce(new Promise((resolve) => { refuseFirst = resolve; }))
        .mockReturnValueOnce(new Promise(() => {}));
      state.rows = twoEditors();
      renderPanel(false, 'esv');
      await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.suspend }));
      await userEvent.click(within(await row('other@example.ch')).getByRole('button', { name: t.suspend }));
      refuseFirst({ error: { code: 'P0001', message: 'cannot remove the last super-admin' } });
      expect(await screen.findByRole('alert')).toHaveTextContent(t.adminErrLastSuperAdmin);
    });
  });

  // A refusal for a row far down a long list would otherwise show above the visible part.
  it('shows a refusal outside the scrolling list', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot reject an account that is approved' } });
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.reject }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.adminErrStale);
    expect(alert.closest('.sk-scroll')).toBeNull();
  });

  it('closes the scope change on cancel', async () => {
    state.rows = [account({ status: 'approved', scope_association_id: 'emmental' })];
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.changeScope }));
    await userEvent.click(within(screen.getByTestId('scope-dialog')).getByRole('button', { name: t.cancel }));
    expect(screen.queryByTestId('scope-dialog')).toBeNull();
  });

  it('closes the delete confirmation on cancel', async () => {
    state.rows = [account({ status: 'approved', scope_association_id: 'emmental' })];
    renderPanel(false, 'esv');
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.delete }));
    await userEvent.click(within(screen.getByTestId('delete-account-dialog')).getByRole('button', { name: t.cancel }));
    expect(screen.queryByTestId('delete-account-dialog')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('AccountsPanel header', () => {
  const tabs = () => within(screen.getByRole('tablist')).getAllByRole('tab');

  it('opens on the accounts tab, and the invitations tab swaps the list and drops the filter', async () => {
    state.invitations = [invitation({})];
    renderPanel();
    await row('gau@example.ch');
    const [accounts, invitations] = tabs();
    expect(tabs()).toHaveLength(2);
    expect(accounts).toHaveAttribute('aria-selected', 'true');
    expect(invitations).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', accounts.id);
    expect(screen.getByLabelText(t.accountsFilter)).toBeInTheDocument();

    await userEvent.click(invitations);
    expect(invitations).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText(t.accountsFilter)).toBeNull();
    expect(await screen.findByTestId('invitation-anna@example.ch')).toBeInTheDocument();
    expect(screen.queryByTestId('account-gau@example.ch')).toBeNull();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', invitations.id);
    expect(invitations).toHaveAttribute('aria-controls', panel.id);
  });

  it('clears a shown error when the tab changes', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot reject an account that is approved' } });
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.reject }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.adminErrStale);
    await userEvent.click(tabs()[1]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('an accounts refusal that arrives late', () => {
    const refuseLater = async () => {
      let refuse: (v: unknown) => void = () => {};
      rpc.mockReturnValue(new Promise((r) => { refuse = r; }));
      renderPanel();
      await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.reject }));
      await userEvent.click(tabs()[1]);
      await act(async () => {
        refuse({ error: { code: 'P0001', message: 'cannot reject an account that is approved' } });
      });
    };

    it('does not show on the invitations tab', async () => {
      await refuseLater();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('is not back when the accounts tab comes up again', async () => {
      await refuseLater();
      await userEvent.click(tabs()[0]);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('moves between the tabs with the arrow keys, Home and End', async () => {
    renderPanel();
    await row('gau@example.ch');
    const [accounts, invitations] = tabs();
    expect(accounts).toHaveAttribute('tabindex', '0');
    expect(invitations).toHaveAttribute('tabindex', '-1');
    accounts.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(invitations).toHaveFocus();
    expect(invitations).toHaveAttribute('aria-selected', 'true');
    expect(invitations).toHaveAttribute('tabindex', '0');
    expect(accounts).toHaveAttribute('tabindex', '-1');

    await userEvent.keyboard('{ArrowRight}');
    expect(accounts).toHaveFocus();
    expect(accounts).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowLeft}');
    expect(invitations).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(accounts).toHaveFocus();
    expect(accounts).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');
    expect(invitations).toHaveFocus();
    expect(invitations).toHaveAttribute('aria-selected', 'true');
  });

  it('names the tablist after the panel title', async () => {
    renderPanel();
    await row('gau@example.ch');
    expect(screen.getByRole('tablist', { name: t.accountsTitle })).toBeInTheDocument();
  });

  it('keeps the filter out of the tablist', async () => {
    renderPanel();
    await row('gau@example.ch');
    expect(screen.getByRole('tablist')).not.toContainElement(screen.getByLabelText(t.accountsFilter));
  });

  it('keeps the tab row 44px tall at least', async () => {
    renderPanel(true);
    await row('gau@example.ch');
    expect(screen.getByRole('tablist').parentElement).toHaveStyle({ minHeight: '44px', flexWrap: 'wrap' });
  });

  it('names the counts on the tabs for screen readers, without the dot', async () => {
    state.pendingCount = 3;
    state.invitations = [invitation({}), invitation({ id: 'i2', email: 'bruno@example.ch' })];
    renderPanel();
    const invitations = await screen.findByRole('tab', { name: `${t.invitationsTitle} 2` });
    expect(invitations).toHaveTextContent('·');
    expect(invitations).not.toHaveAccessibleName(/·/);
    expect(
      await screen.findByRole('tab', { name: `${t.accountsTitle} ${t.accountsPendingCount.replace('{n}', '3')}` }),
    ).toHaveTextContent('3');
  });

  it('shows a Verband editor the invitations only, without tabs or filter', async () => {
    state.invitations = [invitation({})];
    renderPanel(false, 'emmental');
    expect(await screen.findByTestId('invitation-anna@example.ch')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.invitationsTitle })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.queryByLabelText(t.accountsFilter)).toBeNull();
    expect(state.lists).toEqual([]);
    expect(from).not.toHaveBeenCalledWith('profiles');
  });

  it('titles the panel for a Teilverband editor after the accounts', async () => {
    renderPanel();
    await row('gau@example.ch');
    expect(screen.getByRole('dialog', { name: t.accountsTitle })).toBeInTheDocument();
  });

  it.each([false, true])('opens the create dialog from "+ Einladen" (phone: %s)', async (isMobile) => {
    renderPanel(isMobile);
    await row('gau@example.ch');
    const invite = screen.getByRole('button', { name: t.invite });
    expect(invite).toHaveTextContent(t.invite);
    await userEvent.click(invite);
    expect(screen.getByTestId('create-invitation-dialog')).toBeInTheDocument();
  });

  it('opens the create dialog filled in for an expired invitation', async () => {
    state.invitations = [invitation({ expires_at: '2020-01-01T00:00:00Z' })];
    renderPanel();
    await userEvent.click(tabs()[1]);
    await userEvent.click(
      within(await screen.findByTestId('invitation-anna@example.ch')).getByRole('button', { name: t.invitationReinvite }),
    );
    const dialog = screen.getByTestId('create-invitation-dialog');
    expect((within(dialog).getByLabelText(t.email) as HTMLInputElement).value).toBe('anna@example.ch');
    expect((within(dialog).getByRole('radio', { checked: true }) as HTMLInputElement).value).toBe('emmental');
  });

  it('gives the close button a 44px target', async () => {
    renderPanel(true);
    await row('gau@example.ch');
    expect(screen.getByRole('button', { name: t.close })).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
  });
});
