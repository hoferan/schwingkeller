import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Each from() call gets its own builder, so the list query and the approved-scopes query can be
// told apart. `lists` records the status filter of every list query, null for "all".
const { from, rpc, state } = vi.hoisted(() => {
  const state: { rows: unknown[]; lists: (string | null)[]; listError: unknown } = { rows: [], lists: [], listError: null };
  const from = vi.fn(() => {
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
      if (columns === 'scope_association_id') return resolve({ data: [], error: null });
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

const t = STR.de;

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
    expect((within(dialog).getByLabelText(t.accountsScope) as HTMLSelectElement).value).toBe('emmental');
  });

  it('asks before deleting an account', async () => {
    state.rows = [account({ status: 'approved', scope_association_id: 'emmental' })];
    renderPanel(false, 'esv');
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.delete }));
    expect(screen.getByTestId('delete-account-dialog')).toHaveTextContent('gau@example.ch');
    expect(rpc).not.toHaveBeenCalled();
  });
});
