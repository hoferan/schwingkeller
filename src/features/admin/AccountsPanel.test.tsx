import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Each from() call gets its own builder, so the list query and the approved-scopes query can be
// told apart. `lists` records the status filter of every list query, null for "all".
const { from, rpc, state } = vi.hoisted(() => {
  const state: { rows: unknown[]; lists: (string | null)[] } = { rows: [], lists: [] };
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
      return resolve({ data: state.rows, error: null });
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
import { TestAuthProvider } from '../auth/testing';
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

const renderPanel = (isMobile = false) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as="bksv">
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

  it('opens the approval for a pending account', async () => {
    renderPanel();
    await userEvent.click(within(await row('gau@example.ch')).getByRole('button', { name: t.approve }));
    expect(screen.getByText(t.approveTitle)).toBeInTheDocument();
  });
});
