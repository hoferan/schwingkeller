import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

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
import { setFeature } from '../../test/features';

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

  // Accounts come from invitations only (#140), so the modal has no way into a sign-up form.
  it.each([true, false])('offers no way to register with the editors flag %s', (on) => {
    setFeature('editors', on);
    renderLogin();

    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual([t.cancel, t.login]);
    expect(screen.queryByLabelText(t.passwordConfirm)).toBeNull();
  });

  describe('errors', () => {
    const tryLogin = async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.type(screen.getByLabelText(t.email), 'a@example.com');
      await user.type(screen.getByLabelText(t.password), 'some-password');
      await user.click(screen.getByRole('button', { name: t.login }));
    };

    it('shows one message for a wrong password and an unknown address', async () => {
      signInWithPassword.mockResolvedValueOnce({
        error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      });
      await tryLogin();

      expect(await screen.findByText(t.loginErrCredentials)).toBeInTheDocument();
      expect(screen.queryByText('Invalid login credentials')).toBeNull();
    });

    it('tells a rate-limited user to wait', async () => {
      signInWithPassword.mockResolvedValueOnce({
        error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
      });
      await tryLogin();

      expect(await screen.findByText(t.authErrRateLimit)).toBeInTheDocument();
    });

    it('says the service is unreachable on a network error', async () => {
      signInWithPassword.mockResolvedValueOnce({ error: new AuthRetryableFetchError('Failed to fetch', 0) });
      await tryLogin();

      expect(await screen.findByText(t.authErrUnavailable)).toBeInTheDocument();
    });
  });
});
