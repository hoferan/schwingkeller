import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { from, state } = vi.hoisted(() => {
  const state = { count: 0 };
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, count: state.count, error: null });
  return { from: vi.fn(() => builder), state };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from } }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { TestAuthProvider, type TestAccount } from '../auth/testing';
import { AccountsEntry } from './AccountsEntry';

const t = STR.de;

const renderEntry = (as: TestAccount) => {
  const onOpen = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <AccountsEntry onOpen={onOpen} isMobile={false} inverted={false} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );
  return { onOpen };
};

beforeEach(() => {
  state.count = 0;
  from.mockClear();
});

describe('AccountsEntry', () => {
  it.each(['esv', 'bksv'] as const)('shows for a %s editor', (as) => {
    renderEntry(as);
    expect(screen.getByRole('button', { name: t.accountsTitle })).toBeInTheDocument();
  });

  it.each(['pending', 'signed-out'] as const)('stays away for %s, without asking the database', (as) => {
    renderEntry(as);
    expect(screen.queryByRole('button')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  // A Verband has no accounts below it, so its editors only get the invitations.
  it('shows a Verband editor the invitations, without a count', () => {
    state.count = 3;
    renderEntry('emmental');
    const button = screen.getByRole('button', { name: t.invitationsTitle });
    expect(button).toHaveAttribute('title', t.invitationsTitle);
    expect(button).not.toHaveAccessibleDescription(/Anfragen/);
    expect(button).not.toHaveTextContent('3');
    expect(from).not.toHaveBeenCalled();
  });

  it('shows how many requests wait', async () => {
    state.count = 3;
    renderEntry('bksv');
    expect(
      await screen.findByRole('button', { name: t.accountsTitle, description: '3 offene Anfragen' }),
    ).toHaveTextContent('3');
  });

  it('shows no badge when nothing waits', async () => {
    renderEntry('bksv');
    await vi.waitFor(() => expect(from).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: t.accountsTitle })).not.toHaveAccessibleDescription(/Anfragen/);
  });

  it('opens the list', async () => {
    const { onOpen } = renderEntry('esv');
    await userEvent.click(screen.getByRole('button', { name: t.accountsTitle }));
    expect(onOpen).toHaveBeenCalled();
  });
});
