import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { getSession, onAuthStateChange, signInWithPassword } = vi.hoisted(() => ({
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange, signInWithPassword } },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthProvider';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { LoginModal } from './LoginModal';

const t = STR.de;

const renderLogin = (onClose = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
        <LoginModal onClose={onClose} />
      </I18nContext.Provider>
    </AuthProvider>
    </QueryClientProvider>,
  );

describe('LoginModal', () => {
  // Without an association the fields have no accessible name, so a screen reader announces two
  // unlabelled edit boxes and there is no way to tell which one wants the password.
  it('gives both fields an accessible name from their visible label', () => {
    renderLogin();

    expect(screen.getByLabelText(t.email)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(t.password)).toHaveAttribute('type', 'password');
  });

  it('focuses the field when its label is clicked', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByText(t.password));

    expect(screen.getByLabelText(t.password)).toHaveFocus();
  });

  describe('registration', () => {
    afterEach(() => { vi.unstubAllEnvs(); });

    // VITE_APP_ENV is unset here, which reads as development, where the editors flag is on.
    it('offers registration when the editors flag is on', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: t.registerLink }));

      expect(screen.getByText(t.registerTitle)).toBeInTheDocument();
      expect(screen.getByLabelText(t.passwordConfirm)).toBeInTheDocument();
    });

    it('offers no registration when the editors flag is off', () => {
      vi.stubEnv('VITE_APP_ENV', 'production');
      renderLogin();

      expect(screen.queryByRole('button', { name: t.registerLink })).toBeNull();
    });

    it('goes back to sign-in', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: t.registerLink }));
      await user.click(screen.getByRole('button', { name: t.backToLogin }));

      expect(screen.getByText(t.loginTitle)).toBeInTheDocument();
      expect(screen.queryByLabelText(t.passwordConfirm)).toBeNull();
    });
  });
});
