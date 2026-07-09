import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { getSession, onAuthStateChange } = vi.hoisted(() => {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };
});
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));

import { AuthProvider } from '../features/auth/AuthProvider';
import { I18nContext } from '../i18n/useTranslation';
import { STR } from '../i18n/translations';
import { Topbar } from './Topbar';

const renderTopbar = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <Topbar onOpenLogin={() => {}} isMobile={false} />
      </I18nContext.Provider>
    </AuthProvider>,
  );

describe('Topbar', () => {
  it('renders the title and login button when not admin', async () => {
    renderTopbar();
    expect(screen.getByText(/SCHWINGKELLER/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(STR.de.login)).toBeInTheDocument());
  });
});
