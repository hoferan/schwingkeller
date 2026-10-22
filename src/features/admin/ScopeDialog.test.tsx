import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { from, rpc, state } = vi.hoisted(() => {
  const state: { approved: { scope_association_id: string | null }[] } = { approved: [] };
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: state.approved, error: null });
  return { from: vi.fn(() => builder), rpc: vi.fn(), state };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { TestAuthProvider, type TestAccount } from '../auth/testing';
import type { Account } from './accounts';
import { ScopeDialog } from './ScopeDialog';

const t = STR.de;

const account = (over: Partial<Account> = {}): Account => ({
  id: 'u2',
  email: 'gau@example.ch',
  status: 'pending',
  requested_association_id: 'emmental',
  scope_association_id: null,
  created_at: '2026-10-19T08:00:00Z',
  ...over,
});

const renderDialog = (as: TestAccount, a: Account = account(), mode: 'approve' | 'change' = 'approve') => {
  const onClose = vi.fn();
  const onError = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <ScopeDialog account={a} mode={mode} onClose={onClose} onError={onError} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );
  return { onClose, onError };
};

const scopeSelect = () => screen.getByLabelText(t.accountsScope) as HTMLSelectElement;

beforeEach(() => {
  state.approved = [{ scope_association_id: 'emmental' }];
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe('ScopeDialog', () => {
  it('offers a Teilverband editor its Verbände, with the requested one preselected', async () => {
    renderDialog('bksv');
    expect(scopeSelect().value).toBe('emmental');
    const values = within(scopeSelect()).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values.filter(Boolean)).toEqual(['berner-jura', 'emmental', 'mittelland', 'oberaargau', 'oberland', 'seeland']);
    await waitFor(() => expect(within(scopeSelect()).getByRole('option', { name: /^Emmental · 1$/ })).toBeInTheDocument());
    // The select above shows the scope, so the button stays short enough for one line on a phone.
    expect(screen.getByRole('button', { name: t.approve })).toBeEnabled();
  });

  it('shows the counts below a Teilverband for a super-admin', async () => {
    renderDialog('esv');
    await waitFor(() =>
      expect(within(scopeSelect()).getByRole('option', { name: /^Bernisch-Kantonaler Schwingerverband · 0 · 1 darunter$/ }))
        .toBeInTheDocument(),
    );
  });

  it('lets a super-admin approve with another scope', async () => {
    const { onClose } = renderDialog('esv');
    await userEvent.selectOptions(scopeSelect(), 'bksv');
    await userEvent.click(screen.getByRole('button', { name: t.approve }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('approve_editor', { target_id: 'u2', scope: 'bksv' });
  });

  it('preselects nothing outside the caller’s scopes, and waits for a choice', async () => {
    renderDialog('bksv', account({ requested_association_id: 'luzern' }));
    expect(scopeSelect().value).toBe('');
    expect(screen.getByRole('button', { name: t.approve })).toBeDisabled();
    await userEvent.selectOptions(scopeSelect(), 'seeland');
    expect(screen.getByRole('button', { name: t.approve })).toBeEnabled();
  });

  it('can’t be sent twice while the approval runs', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    renderDialog('bksv');
    const confirm = screen.getByRole('button', { name: t.approve });
    await userEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('reports an account someone else changed first, and closes', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot approve an account that is approved' } });
    const { onClose, onError } = renderDialog('bksv');
    await userEvent.click(screen.getByRole('button', { name: t.approve }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('adminErrStale'));
    expect(onClose).toHaveBeenCalled();
  });

  describe('changing a scope', () => {
    const editor = account({ status: 'approved', scope_association_id: 'emmental' });

    it('preselects the current scope', () => {
      renderDialog('bksv', editor, 'change');
      expect(scopeSelect().value).toBe('emmental');
      expect(screen.getByText(t.changeScope)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: t.approve })).toBeNull();
    });

    it('preselects nothing when the current scope is not one the caller may grant', () => {
      renderDialog('bksv', account({ status: 'approved', scope_association_id: 'luzern' }), 'change');
      expect(scopeSelect().value).toBe('');
      expect(screen.getByRole('button', { name: t.save })).toBeDisabled();
    });

    it('keeps the button disabled until another scope is picked', async () => {
      renderDialog('bksv', editor, 'change');
      const confirm = screen.getByRole('button', { name: t.save });
      expect(confirm).toBeDisabled();
      await userEvent.selectOptions(scopeSelect(), 'seeland');
      expect(confirm).toBeEnabled();
    });

    it('changes the scope through set_editor_scope', async () => {
      const { onClose } = renderDialog('bksv', editor, 'change');
      await userEvent.selectOptions(scopeSelect(), 'seeland');
      await userEvent.click(screen.getByRole('button', { name: t.save }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(rpc).toHaveBeenCalledWith('set_editor_scope', { target_id: 'u2', scope: 'seeland' });
    });

    it('hands a refused change to the panel', async () => {
      rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot remove the last super-admin' } });
      const { onClose, onError } = renderDialog('esv', account({ status: 'approved', scope_association_id: 'esv' }), 'change');
      await userEvent.selectOptions(scopeSelect(), 'bksv');
      await userEvent.click(screen.getByRole('button', { name: t.save }));
      await waitFor(() => expect(onError).toHaveBeenCalledWith('adminErrLastSuperAdmin'));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
