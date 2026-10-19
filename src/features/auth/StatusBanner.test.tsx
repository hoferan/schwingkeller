import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { StatusBanner } from './StatusBanner';
import { TestAuthProvider, type TestAccount } from './testing';

const renderBanner = (as: TestAccount) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
          <StatusBanner />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );
  return { invalidate };
};

describe('StatusBanner', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
  });

  it('tells a pending account to wait, without a review button', () => {
    renderBanner('pending');
    expect(screen.getByRole('status')).toHaveTextContent(STR.de.statusPending);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['suspended', 'statusSuspended'],
    ['rejected', 'statusRejected'],
  ] as const)('shows the %s message with a review button', (as, key) => {
    renderBanner(as);
    expect(screen.getByRole('status')).toHaveTextContent(STR.de[key]);
    expect(screen.getByRole('button', { name: STR.de.requestReview })).toBeInTheDocument();
  });

  it.each(['esv', 'bksv', 'signed-out'] as const)('renders nothing for %s', (as) => {
    renderBanner(as);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders nothing while the profile loads', () => {
    renderBanner('loading');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('requests a review once and refreshes the profile', async () => {
    const { invalidate } = renderBanner('suspended');
    await userEvent.click(screen.getByRole('button', { name: STR.de.requestReview }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['profile'] }));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('request_review_again');
  });

  it('shows an error and keeps the banner when the request fails', async () => {
    rpc.mockResolvedValue({ error: { message: 'nope' } });
    renderBanner('rejected');
    await userEvent.click(screen.getByRole('button', { name: STR.de.requestReview }));
    expect(await screen.findByText(STR.de.requestReviewFailed)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(STR.de.statusRejected);
  });
});
