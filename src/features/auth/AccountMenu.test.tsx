import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// supabase.ts creates its client at import time and throws without env vars; an empty stub is enough.
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { theme } from '../../theme';
import { AccountMenu } from './AccountMenu';
import { TestAuthProvider, type TestAccount } from './testing';

const t = STR.de;

const renderMenu = (as: TestAccount) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <AccountMenu isMobile={false} inverted={false} onAccountDeleted={vi.fn()} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );

const openMenu = () => userEvent.click(screen.getByRole('button', { name: t.accountMenu }));

// See Topbar.test.tsx: compare against a colour round-tripped through jsdom.
const cssColor = (value: string) => {
  const probe = document.createElement('div');
  probe.style.color = value;
  return probe.style.color;
};

describe('AccountMenu', () => {
  it('shows the email and the Verband of an approved editor', async () => {
    renderMenu('emmental');
    await openMenu();
    expect(screen.getByText('editor@example.ch')).toBeInTheDocument();
    expect(screen.getByText('Verband Emmental')).toBeInTheDocument();
  });

  it('shows the requested Verband of a pending applicant', async () => {
    renderMenu('pending');
    await openMenu();
    expect(screen.getByText('Verband Emmental')).toBeInTheDocument();
  });

  it('offers sign-out and a red delete entry', async () => {
    renderMenu('esv');
    await openMenu();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((el) => el.textContent)).toEqual([t.logout, t.deleteOwnAccount]);
    expect(items[1].style.color).toBe(cssColor(theme.color.accent));
  });

  it('opens the confirmation dialog from the delete entry', async () => {
    renderMenu('pending');
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: t.deleteOwnAccount }));
    expect(screen.getByTestId('delete-own-account-dialog')).toHaveTextContent('editor@example.ch');
  });
});
