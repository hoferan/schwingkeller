import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { signInWithPassword, signOut, rpc } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword, signOut }, rpc } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { DeleteOwnAccountDialog } from './DeleteOwnAccountDialog';

const t = STR.de;

const renderDialog = (email = 'me@example.ch') => {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
        <DeleteOwnAccountDialog email={email} onClose={onClose} onDeleted={onDeleted} />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
  return { onClose, onDeleted };
};

const deleteButton = () => screen.getByRole('button', { name: t.delete });
const password = () => screen.getByLabelText(t.deleteOwnPassword);

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
});

describe('DeleteOwnAccountDialog', () => {
  it('names the account and keeps Delete disabled until a password is typed', async () => {
    renderDialog();
    expect(screen.getByTestId('delete-own-account-dialog')).toHaveTextContent('me@example.ch');
    expect(password()).toHaveFocus();
    expect(deleteButton()).toBeDisabled();
    await userEvent.type(password(), 'pw');
    expect(deleteButton()).toBeEnabled();
  });

  it('shows an address with a $ pattern as typed', () => {
    renderDialog('a$&b@example.ch');
    expect(screen.getByTestId('delete-own-account-dialog')).toHaveTextContent('a$&b@example.ch');
  });

  it('deletes and reports success with the right password', async () => {
    const { onDeleted } = renderDialog();
    await userEvent.type(password(), 'pw{Enter}');
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.ch', password: 'pw' });
    expect(rpc).toHaveBeenCalledWith('delete_account');
  });

  it('shows the wrong-password message and stays open', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
    });
    const { onClose, onDeleted } = renderDialog();
    await userEvent.type(password(), 'nope{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.deleteOwnErrPassword);
    expect(rpc).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('delete-own-account-dialog')).toBeInTheDocument();
  });

  it('shows the last-super-admin message', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot delete the last super-admin' } });
    renderDialog();
    await userEvent.type(password(), 'pw{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.deleteOwnErrLastSuperAdmin);
  });

  it('clears the old message on a new attempt', async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
    });
    rpc.mockReturnValue(new Promise(() => {}));
    renderDialog();
    await userEvent.type(password(), 'nope{Enter}');
    await screen.findByRole('alert');
    await userEvent.type(password(), 'x{Enter}');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('ignores dismiss and a second submit while deleting', async () => {
    rpc.mockReturnValue(new Promise(() => {}));
    const { onClose } = renderDialog();
    await userEvent.type(password(), 'pw{Enter}');
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await userEvent.type(password(), '{Enter}');
    await userEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  // Signing out unmounts the account menu and this dialog with it, possibly before the mutation
  // settles. Success must still be reported.
  it('reports success even when signing out has already removed the dialog', async () => {
    const onDeleted = vi.fn();
    let hide = () => {};
    const Host = () => {
      const [shown, setShown] = useState(true);
      hide = () => setShown(false);
      return shown ? <DeleteOwnAccountDialog email="me@example.ch" onClose={vi.fn()} onDeleted={onDeleted} /> : null;
    };
    signOut.mockImplementation(async () => {
      flushSync(() => hide());
      return { error: null };
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <Host />
        </I18nContext.Provider>
      </QueryClientProvider>,
    );
    await userEvent.type(password(), 'pw{Enter}');
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('is a dialog named by its title', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: t.deleteAccountTitle })).toBeInTheDocument();
  });

  it('closes on Escape when idle', async () => {
    const { onClose } = renderDialog();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Cancel when idle', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
