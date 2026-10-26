import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { from, rpc, state, captureException } = vi.hoisted(() => {
  const state: { rows: unknown[]; error: unknown; fetches: number } = { rows: [], error: null, fetches: 0 };
  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.order = () => builder;
    builder.then = (resolve: (v: unknown) => unknown) => {
      state.fetches += 1;
      return resolve(state.error ? { data: null, error: state.error } : { data: state.rows, error: null });
    };
    return builder;
  });
  return { from, rpc: vi.fn(), state, captureException: vi.fn() };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));
vi.mock('@sentry/react', () => ({ captureException }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';
import { TestAuthProvider } from '../auth/testing';
import type { Invitation } from './invitations';
import { InvitationsView } from './InvitationsView';
import { scopeLabel } from './scopeLabel';

const t = STR.de;
const a = associationsFor('de');

const invitation = (over: Partial<Invitation>): Invitation => ({
  id: 'i1',
  email: 'anna@example.ch',
  association_id: 'emmental',
  invited_by: 'someone-else',
  created_at: '2026-10-19T08:00:00Z',
  expires_at: '2099-10-26T08:00:00Z',
  ...over,
});

const renderView = (isMobile = false) => {
  const onError = vi.fn();
  const onReinvite = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as="bksv">
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <InvitationsView isMobile={isMobile} onError={onError} onReinvite={onReinvite} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );
  return { onError, onReinvite };
};

const row = (email: string) => screen.findByTestId(`invitation-${email}`);

beforeEach(() => {
  state.rows = [invitation({})];
  state.error = null;
  state.fetches = 0;
  rpc.mockReset().mockResolvedValue({ error: null });
  captureException.mockReset();
});

describe('InvitationsView', () => {
  it('shows email, node and date in a table on desktop', async () => {
    renderView();
    const r = await row('anna@example.ch');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(r).toHaveTextContent('anna@example.ch');
    expect(r).toHaveTextContent(scopeLabel(a, t, 'emmental'));
    expect(r).toHaveTextContent('26.10.2099');
  });

  it('shows a list of cards on phones', async () => {
    renderView(true);
    const r = await row('anna@example.ch');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(r).toHaveTextContent(
      `${scopeLabel(a, t, 'emmental')} · ${t.invitationExpiresOn.replace('{date}', '26.10.2099')}`,
    );
  });

  it('marks only the caller’s own invitation', async () => {
    state.rows = [invitation({ invited_by: 'test-user' }), invitation({ id: 'i2', email: 'bruno@example.ch' })];
    renderView();
    expect(within(await row('anna@example.ch')).getByText(t.invitationMine)).toBeInTheDocument();
    expect(within(await row('bruno@example.ch')).queryByText(t.invitationMine)).not.toBeInTheDocument();
  });

  it('offers a new invitation for an expired row', async () => {
    state.rows = [invitation({ expires_at: '2020-01-01T00:00:00Z' })];
    const { onReinvite } = renderView();
    const r = await row('anna@example.ch');
    expect(r).toHaveTextContent(t.invitationExpired);
    expect(r).not.toHaveTextContent('01.01.2020');
    await userEvent.click(within(r).getByRole('button', { name: t.invitationReinvite }));
    expect(onReinvite).toHaveBeenCalledWith({ email: 'anna@example.ch', scope: 'emmental' });
  });

  it('does not offer a new invitation for a live row', async () => {
    renderView();
    expect(within(await row('anna@example.ch')).queryByRole('button', { name: t.invitationReinvite })).toBeNull();
  });

  it('revokes its own invitation at once and clears the error line', async () => {
    state.rows = [invitation({ invited_by: 'test-user' })];
    const { onError } = renderView();
    await userEvent.click(within(await row('anna@example.ch')).getByRole('button', { name: t.invitationRevoke }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('revoke_invitation', { invitation_id: 'i1' }));
    expect(onError).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId('revoke-invitation-dialog')).not.toBeInTheDocument();
  });

  it('asks before revoking someone else’s invitation', async () => {
    renderView();
    await userEvent.click(within(await row('anna@example.ch')).getByRole('button', { name: t.invitationRevoke }));
    const dialog = screen.getByTestId('revoke-invitation-dialog');
    expect(dialog).toHaveTextContent(t.revokeInvitationTitle);
    expect(dialog).toHaveTextContent('anna@example.ch');
    expect(dialog).toHaveTextContent(scopeLabel(a, t, 'emmental'));
    expect(dialog).toHaveTextContent(t.revokeInvitationBody);
    await userEvent.click(within(dialog).getByRole('button', { name: t.cancel }));
    expect(screen.queryByTestId('revoke-invitation-dialog')).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('revokes once after the confirmation', async () => {
    renderView();
    await userEvent.click(within(await row('anna@example.ch')).getByRole('button', { name: t.invitationRevoke }));
    await userEvent.click(
      within(screen.getByTestId('revoke-invitation-dialog')).getByRole('button', { name: t.invitationRevoke }),
    );
    await waitFor(() => expect(screen.queryByTestId('revoke-invitation-dialog')).not.toBeInTheDocument());
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('revoke_invitation', { invitation_id: 'i1' });
  });

  it('clears the error line when the confirmed revoke starts', async () => {
    const { onError } = renderView();
    await userEvent.click(within(await row('anna@example.ch')).getByRole('button', { name: t.invitationRevoke }));
    await userEvent.click(
      within(screen.getByTestId('revoke-invitation-dialog')).getByRole('button', { name: t.invitationRevoke }),
    );
    expect(onError).toHaveBeenCalledWith(null);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('revoke_invitation', { invitation_id: 'i1' }));
  });

  it('reports a stale invitation and refetches the list', async () => {
    state.rows = [invitation({ invited_by: 'test-user' })];
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot revoke an invitation that is used' } });
    const { onError } = renderView();
    await userEvent.click(within(await row('anna@example.ch')).getByRole('button', { name: t.invitationRevoke }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('inviteErrStale'));
    await waitFor(() => expect(state.fetches).toBe(2));
  });

  it('keeps the buttons of a row with a revoke pending disabled, and only that row’s', async () => {
    state.rows = [
      invitation({ invited_by: 'test-user' }),
      invitation({ id: 'i2', email: 'bruno@example.ch', invited_by: 'test-user' }),
    ];
    rpc.mockReturnValue(new Promise(() => {}));
    renderView();
    const first = await row('anna@example.ch');
    const second = await row('bruno@example.ch');
    await userEvent.click(within(first).getByRole('button', { name: t.invitationRevoke }));
    await waitFor(() => expect(within(first).getByRole('button', { name: t.invitationRevoke })).toBeDisabled());
    expect(within(second).getByRole('button', { name: t.invitationRevoke })).toBeEnabled();
  });

  it('says so when there are no open invitations', async () => {
    state.rows = [];
    renderView();
    expect(await screen.findByText(t.invitationsEmpty)).toBeInTheDocument();
  });

  it('says so when the list fails, and reports it once', async () => {
    state.error = { code: 'XX000', message: 'boom' };
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent(t.invitationsLoadFailed);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
