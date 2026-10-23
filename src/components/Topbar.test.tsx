import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// supabase.ts creates its client at import time and throws without env vars; an empty stub is enough.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { TestAuthProvider, type TestAccount } from '../features/auth/testing';
import { I18nContext } from '../i18n/useTranslation';
import { STR } from '../i18n/translations';
import { setFeature } from '../test/features';
import { theme } from '../theme';
import { Topbar } from './Topbar';

// Approved editors above Verband level get the account list entry, which asks for its count.
const renderTopbar = (as: TestAccount) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
          <Topbar onOpenLogin={() => {}} onOpenAccounts={() => {}} onAccountDeleted={() => {}} isMobile={false} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );

// jsdom's CSSOM may or may not preserve a color literally when read back via `.style.background` —
// rather than hardcode an assumed serialization, compare against the same value round-tripped
// through a throwaway element in the same jsdom instance, which is guaranteed self-consistent.
const cssColor = (value: string) => {
  const probe = document.createElement('div');
  probe.style.background = value;
  return probe.style.background;
};

describe('Topbar with the editors flag off', () => {
  beforeEach(() => setFeature('editors', false));

  it('shows the title and the login button when signed out', () => {
    renderTopbar('signed-out');
    expect(screen.getByText(/SCHWINGKELLER/)).toBeInTheDocument();
    expect(screen.getByText(STR.de.login)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.logout)).toBeNull();
  });

  it('keeps the default white header when signed out', () => {
    renderTopbar('signed-out');
    expect(screen.getByTestId('topbar').style.background).toBe(cssColor(theme.color.bg));
  });

  it('inverts the header to red for an approved editor', () => {
    renderTopbar('esv');
    expect(screen.getByTestId('topbar').style.background).toBe(cssColor(theme.color.accent));
    expect(screen.getByText(STR.de.logout)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.adminMode)).not.toBeInTheDocument();
  });

  it('keeps the visitor header but offers logout for a pending account', () => {
    renderTopbar('pending');
    expect(screen.getByTestId('topbar').style.background).toBe(cssColor(theme.color.bg));
    expect(screen.getByText(STR.de.logout)).toBeInTheDocument();
    expect(screen.queryByText(STR.de.login)).toBeNull();
  });
});

describe('Topbar with the editors flag on', () => {
  beforeEach(() => setFeature('editors', true));

  it('shows the account menu instead of logout', () => {
    renderTopbar('pending');
    expect(screen.getByRole('button', { name: STR.de.accountMenu })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: STR.de.logout })).toBeNull();
  });

  it('shows no account menu when signed out', () => {
    renderTopbar('signed-out');
    expect(screen.queryByRole('button', { name: STR.de.accountMenu })).toBeNull();
    expect(screen.getByRole('button', { name: STR.de.login })).toBeInTheDocument();
  });
});
