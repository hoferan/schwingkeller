import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Account } from './accounts';
import { DeleteAccountDialog } from './DeleteAccountDialog';

const t = STR.de;

const account: Account = {
  id: 'u2',
  email: 'gau@example.ch',
  status: 'approved',
  requested_association_id: 'emmental',
  scope_association_id: 'emmental',
  created_at: '2026-10-19T08:00:00Z',
};

const renderDialog = () => {
  const onClose = vi.fn();
  const onError = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
        <DeleteAccountDialog account={account} onClose={onClose} onError={onError} />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
  return { onClose, onError };
};

const deleteButton = () => screen.getByRole('button', { name: t.delete });

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe('DeleteAccountDialog', () => {
  it('names the account and asks first', () => {
    renderDialog();
    expect(screen.getByText(t.deleteAccountTitle)).toBeInTheDocument();
    expect(screen.getByTestId('delete-account-dialog')).toHaveTextContent(
      t.deleteAccountBody.replace('{email}', 'gau@example.ch'),
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('deletes through delete_account and closes', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(deleteButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('delete_account', { target_id: 'u2' });
  });

  it('disables the delete button while it runs', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    renderDialog();
    await userEvent.click(deleteButton());
    expect(deleteButton()).toBeDisabled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('hands a refusal to the panel', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0002', message: 'account not found' } });
    const { onClose, onError } = renderDialog();
    await userEvent.click(deleteButton());
    await waitFor(() => expect(onError).toHaveBeenCalledWith('adminErrStale'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels without deleting', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(onClose).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
