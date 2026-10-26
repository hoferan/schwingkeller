import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { from, rpc, state } = vi.hoisted(() => {
  const state: { rows: unknown[] } = { rows: [] };
  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.order = () => builder;
    builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: state.rows, error: null });
    return builder;
  });
  return { from, rpc: vi.fn(), state };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';
import { TestAuthProvider, type TestAccount } from '../auth/testing';
import { CreateInvitationDialog } from './CreateInvitationDialog';
import { inviteOptionIds, invitableScopes } from './scopeOptions';
import { scopeLabel } from './scopeLabel';

const t = STR.de;
const a = associationsFor('de');

const renderDialog = (as: TestAccount, props: Partial<Parameters<typeof CreateInvitationDialog>[0]> = {}) => {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TestAuthProvider as={as}>
        <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
          <CreateInvitationDialog onClose={onClose} {...props} />
        </I18nContext.Provider>
      </TestAuthProvider>
    </QueryClientProvider>,
  );
  return onClose;
};

const optionValues = () =>
  Array.from((screen.getByLabelText(t.accountsScope) as HTMLSelectElement).options).map((o) => o.value);

const stub = (key: 'share' | 'clipboard', value: unknown) =>
  Object.defineProperty(navigator, key, { configurable: true, value });
const unstub = (key: 'share' | 'clipboard') => {
  delete (navigator as unknown as Record<string, unknown>)[key];
};

const link = () => `${window.location.origin}/?invite=tok`;

const create = async (email = 'new@example.ch') => {
  await userEvent.type(screen.getByLabelText(t.email), email);
  await userEvent.click(screen.getByRole('button', { name: t.inviteCreate }));
};

beforeEach(() => {
  state.rows = [];
  rpc.mockReset().mockResolvedValue({ data: 'tok', error: null });
});

afterEach(() => {
  unstub('share');
  unstub('clipboard');
  vi.useRealTimers();
});

describe('CreateInvitationDialog', () => {
  it('offers the ESV, then every node below it, to a super-admin', () => {
    renderDialog('esv');
    expect(optionValues()).toEqual(inviteOptionIds(invitableScopes(a, 'esv')));
    expect(optionValues()[0]).toBe('esv');
  });

  it('offers a Teilverband and its Verbände, and nothing else', () => {
    renderDialog('bksv');
    const values = optionValues();
    expect(values).toEqual(inviteOptionIds(invitableScopes(a, 'bksv')));
    expect(values).toHaveLength(7);
    expect(values[0]).toBe('bksv');
  });

  it('shows the node as text when there is nothing to choose', () => {
    renderDialog('emmental');
    expect(screen.queryByLabelText(t.accountsScope)).toBeNull();
    expect(screen.getByText(`${t.accountsScope}: ${scopeLabel(a, t, 'emmental')}`)).toBeInTheDocument();
  });

  it('prefills the address and node from an earlier invitation', () => {
    renderDialog('bksv', { initial: { email: 'x@y.ch', scope: 'emmental' } });
    expect((screen.getByLabelText(t.email) as HTMLInputElement).value).toBe('x@y.ch');
    expect((screen.getByLabelText(t.accountsScope) as HTMLSelectElement).value).toBe('emmental');
  });

  it('falls back to the own node when the earlier one is not offered', () => {
    renderDialog('bksv', { initial: { email: 'x@y.ch', scope: 'esv' } });
    expect((screen.getByLabelText(t.accountsScope) as HTMLSelectElement).value).toBe('bksv');
  });

  describe('the warning about an open invitation', () => {
    const invitation = (expires_at: string) => ({
      id: 'i1', email: 'anna.muster@example.ch', association_id: 'emmental', invited_by: null,
      created_at: '2026-10-19T08:00:00Z', expires_at,
    });

    it('matches regardless of case and surrounding spaces', async () => {
      state.rows = [invitation('2999-01-01T00:00:00Z')];
      renderDialog('bksv');
      await userEvent.type(screen.getByLabelText(t.email), 'Anna.Muster@Example.ch ');
      expect(await screen.findByText(t.inviteReplacesOpen)).toBeInTheDocument();
    });

    it('stays away when that invitation has expired', async () => {
      state.rows = [invitation('2000-01-01T00:00:00Z')];
      renderDialog('bksv');
      await waitFor(() => expect(from).toHaveBeenCalled());
      await userEvent.type(screen.getByLabelText(t.email), 'anna.muster@example.ch');
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(t.inviteReplacesOpen)).toBeNull();
    });
  });

  it('creates one invitation on a double click, with the trimmed address', async () => {
    renderDialog('bksv');
    await userEvent.type(screen.getByLabelText(t.email), '  new@example.ch ');
    await userEvent.dblClick(screen.getByRole('button', { name: t.inviteCreate }));
    await screen.findByText(t.inviteCreatedTitle);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('create_invitation', { target_email: 'new@example.ch', scope: 'bksv' });
  });

  it('keeps the create button off while the address is empty', () => {
    renderDialog('bksv');
    expect(screen.getByRole('button', { name: t.inviteCreate })).toBeDisabled();
  });

  it('stays open while the request runs, then shows the link', async () => {
    let resolve: (v: unknown) => void = () => {};
    rpc.mockReturnValue(new Promise((r) => { resolve = r; }));
    const onClose = renderDialog('bksv');
    await create();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(onClose).not.toHaveBeenCalled();
    resolve({ data: 'tok', error: null });
    expect(await screen.findByText(t.inviteCreatedTitle)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Abbrechen when idle', async () => {
    const onClose = renderDialog('bksv');
    await userEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['invalid email', 'inviteErrInvalidEmail'],
    ['email already has an account', 'inviteErrHasAccount'],
    ['an invitation for this email is open at a higher level', 'inviteErrOpenHigher'],
  ] as const)('explains "%s" and stays on step 1', async (message, key) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    renderDialog('bksv');
    await create();
    expect(await screen.findByRole('alert')).toHaveTextContent(t[key]);
    expect(screen.queryByText(t.inviteCreatedTitle)).toBeNull();
    expect(screen.getByLabelText(t.email)).toBeInTheDocument();
  });

  it('explains a refusal by the database', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'nope', code: '42501' } });
    renderDialog('bksv');
    await create();
    expect(await screen.findByRole('alert')).toHaveTextContent(t.inviteErrNotAuthorized);
  });

  it('explains any other failure in general terms', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    renderDialog('bksv');
    await create();
    expect(await screen.findByRole('alert')).toHaveTextContent(t.adminErrGeneric);
  });

  describe('step 2', () => {
    it('shows the link, a mail link and the expiry seven days on', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
      renderDialog('bksv');
      await create();
      await screen.findByText(t.inviteCreatedTitle);
      expect((screen.getByLabelText(t.inviteLink) as HTMLInputElement).value).toBe(link());
      expect(screen.getByLabelText(t.inviteLink)).toHaveAttribute('readonly');
      expect(screen.getByRole('link', { name: t.inviteSendMail }).getAttribute('href')).toMatch(/^mailto:new%40example\.ch\?/);
      expect(screen.getByText(/gültig bis 02\.11\.2026/)).toHaveTextContent(
        `new@example.ch · ${scopeLabel(a, t, 'bksv')} · gültig bis 02.11.2026`,
      );
      expect(screen.getByText(t.inviteShownOnce)).toBeInTheDocument();
    });

    it('offers sharing only where the browser can', async () => {
      renderDialog('bksv');
      await create();
      await screen.findByText(t.inviteCreatedTitle);
      expect(screen.queryByRole('button', { name: t.inviteShare })).toBeNull();
    });

    it('shares the message with the link in it', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      stub('share', share);
      renderDialog('bksv');
      await create();
      await userEvent.click(await screen.findByRole('button', { name: t.inviteShare }));
      expect(share).toHaveBeenCalledWith({
        title: expect.any(String),
        text: expect.stringContaining(link()),
      });
    });

    it('ignores a cancelled share', async () => {
      stub('share', vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
      renderDialog('bksv');
      await create();
      await userEvent.click(await screen.findByRole('button', { name: t.inviteShare }));
      expect(screen.getByRole('button', { name: t.inviteShare })).toBeInTheDocument();
    });

    it('copies the link and says so', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      stub('clipboard', { writeText });
      renderDialog('bksv');
      await create();
      await userEvent.click(await screen.findByRole('button', { name: t.inviteCopy }));
      expect(writeText).toHaveBeenCalledWith(link());
      expect(await screen.findByRole('button', { name: t.inviteCopied })).toBeInTheDocument();
    });

    it('selects the link when there is no clipboard', async () => {
      renderDialog('bksv');
      await create();
      await userEvent.click(await screen.findByRole('button', { name: t.inviteCopy }));
      expect(screen.getByLabelText(t.inviteLink)).toHaveFocus();
    });

    it('selects the link when the clipboard refuses', async () => {
      stub('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
      renderDialog('bksv');
      await create();
      await userEvent.click(await screen.findByRole('button', { name: t.inviteCopy }));
      await waitFor(() => expect(screen.getByLabelText(t.inviteLink)).toHaveFocus());
    });

    it('closes on Fertig', async () => {
      const onClose = renderDialog('bksv');
      await create();
      await userEvent.click(await screen.findByRole('button', { name: t.inviteDone }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
