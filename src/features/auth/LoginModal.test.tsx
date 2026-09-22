import { describe, it, expect, vi } from 'vitest';
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

import { AuthProvider } from './AuthProvider';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { LoginModal } from './LoginModal';

const t = STR.de;

const renderLogin = (onClose = vi.fn()) =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
        <LoginModal onClose={onClose} />
      </I18nContext.Provider>
    </AuthProvider>,
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
});
