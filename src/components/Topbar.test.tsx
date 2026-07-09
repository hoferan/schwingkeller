import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { theme } from '../theme';
import { Topbar } from './Topbar';

const renderTopbar = () =>
  render(
    <AuthProvider>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <Topbar onOpenLogin={() => {}} isMobile={false} />
      </I18nContext.Provider>
    </AuthProvider>,
  );

// jsdom's CSSOM may or may not preserve a color literally when read back via `.style.background` —
// rather than hardcode an assumed serialization, compare against the same value round-tripped
// through a throwaway element in the same jsdom instance, which is guaranteed self-consistent.
const cssColor = (value: string) => {
  const probe = document.createElement('div');
  probe.style.background = value;
  return probe.style.background;
};

describe('Topbar', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it('renders the title and login button when not admin', async () => {
    renderTopbar();
    expect(screen.getByText(/SCHWINGKELLER/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(STR.de.login)).toBeInTheDocument());
  });

  it('keeps the default white header when not admin', async () => {
    renderTopbar();
    await waitFor(() => expect(screen.getByText(STR.de.login)).toBeInTheDocument());
    const header = screen.getByTestId('topbar');
    expect(header.style.background).toBe(cssColor(theme.color.bg));
  });

  it('inverts the header to red and removes the pill when admin is logged in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'admin' } } } });
    renderTopbar();
    await screen.findByText(STR.de.logout);

    const header = screen.getByTestId('topbar');
    expect(header.style.background).toBe(cssColor(theme.color.accent));
    expect(screen.queryByText(STR.de.adminMode)).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});
