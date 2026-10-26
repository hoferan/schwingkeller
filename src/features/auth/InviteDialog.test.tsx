import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

const mocked = vi.hoisted(() => ({
  useInvitation: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('./useInvitation', () => ({ useInvitation: mocked.useInvitation }));
vi.mock('../../lib/sentry', () => ({ captureAndFormat: mocked.capture }));
// AuthProvider's module builds the real client on import; the dialog gets auth from the context below.
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { buildTree } from '../associations/tree';
import { associationsFor } from '../associations/useAssociations';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { AuthContext, buildAuthValue, type AuthValue } from './AuthProvider';
import { InviteDialog } from './InviteDialog';

const t = STR.de;
const tree = buildTree();
const emmental = associationsFor('de').nameOf('emmental');
const PASSWORD = 'a-long-enough-pw';
const invitation = { email: 'a@b.ch', associationId: 'emmental', expiresAt: '2026-11-02T00:00:00Z' };

const sessionFor = (email: string) => ({ user: { id: 'u1', email } }) as unknown as Session;

interface Auth {
  session?: Session | null;
  signUp?: AuthValue['signUp'];
  signOut?: AuthValue['signOut'];
}

const authValue = ({ session = null, signUp, signOut }: Auth): AuthValue => ({
  ...buildAuthValue(session, null, tree),
  signIn: async () => ({ error: null }),
  signUp: signUp ?? (async () => ({ error: null })),
  signOut: signOut ?? (async () => {}),
});

const wrap = (auth: Auth, children: ReactNode) => (
  <AuthContext.Provider value={authValue(auth)}>
    <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>{children}</I18nContext.Provider>
  </AuthContext.Provider>
);

const renderDialog = (auth: Auth = {}) => {
  const onClose = vi.fn();
  const view = render(wrap(auth, <InviteDialog token="tok" onClose={onClose} />));
  const rerender = (next: Auth) => view.rerender(wrap(next, <InviteDialog token="tok" onClose={onClose} />));
  return { onClose, rerender };
};

const lookup = (state: { isPending?: boolean; error?: Error | null; data?: typeof invitation | null }) =>
  mocked.useInvitation.mockReturnValue({ isPending: false, error: null, data: undefined, ...state });

const signUpWith = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(t.password), PASSWORD);
  await user.type(screen.getByLabelText(t.passwordConfirm), PASSWORD);
  await user.click(screen.getByRole('button', { name: t.inviteSubmit }));
};

beforeEach(() => {
  mocked.useInvitation.mockReset();
  mocked.capture.mockReset();
});

describe('InviteDialog', () => {
  it('shows a checking note while the token is looked up', () => {
    lookup({ isPending: true });
    renderDialog();
    expect(screen.getByRole('status')).toHaveTextContent(t.inviteChecking);
    expect(mocked.useInvitation).toHaveBeenCalledWith('tok');
  });

  it('shows the neutral message for an unknown token, without reporting it', () => {
    lookup({ data: null });
    renderDialog();
    expect(screen.getByText(t.inviteInvalid)).toBeInTheDocument();
    expect(mocked.capture).not.toHaveBeenCalled();
  });

  it('shows the same message when the lookup fails, and reports it', () => {
    lookup({ error: new Error('boom') });
    renderDialog();
    expect(screen.getByText(t.inviteInvalid)).toBeInTheDocument();
    expect(mocked.capture).toHaveBeenCalledTimes(1);
    expect(mocked.capture).toHaveBeenCalledWith(expect.any(Error), 'invitation lookup failed');
  });

  it('names the Verband and fills in the email', () => {
    lookup({ data: invitation });
    renderDialog();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(t.inviteTitle);
    expect(screen.getByText(t.inviteFor.replace('{node}', emmental))).toBeInTheDocument();
    expect(screen.getByLabelText(t.email)).toHaveValue('a@b.ch');
  });

  it('signs up with the token and ends on the welcome step', async () => {
    lookup({ data: invitation });
    const signUp = vi.fn().mockResolvedValue({ error: null });
    const user = userEvent.setup();
    const { onClose } = renderDialog({ signUp });

    await signUpWith(user);

    expect(signUp).toHaveBeenCalledWith('a@b.ch', PASSWORD, 'tok');
    expect(await screen.findByText(t.inviteWelcome.replace('{node}', emmental))).toBeInTheDocument();
    const close = screen.getByRole('button', { name: t.close });
    expect(close).toHaveFocus();
    await user.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  // onAuthStateChange can deliver the new session before signUp resolves.
  it('stays on the way to the welcome step when the session arrives during sign-up', async () => {
    lookup({ data: invitation });
    let finish: (value: { error: null }) => void = () => {};
    const signUp = vi.fn(() => new Promise<{ error: null }>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    const { rerender } = renderDialog({ signUp });

    await signUpWith(user);
    rerender({ signUp, session: sessionFor('a@b.ch') });
    expect(screen.queryByText(t.inviteSignedInAs.replace('{email}', 'a@b.ch'))).toBeNull();
    await act(async () => finish({ error: null }));

    expect(screen.getByText(t.inviteWelcome.replace('{node}', emmental))).toBeInTheDocument();
    expect(screen.queryByText(t.inviteSignedInAs.replace('{email}', 'a@b.ch'))).toBeNull();
  });

  it('offers to sign out when someone is already signed in, then shows the form', async () => {
    lookup({ data: invitation });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = renderDialog({ session: sessionFor('x@y.ch'), signOut });

    expect(screen.getByText(t.inviteSignedInAs.replace('{email}', 'x@y.ch'))).toBeInTheDocument();
    expect(screen.queryByLabelText(t.password)).toBeNull();
    await user.click(screen.getByRole('button', { name: t.inviteSignOut }));
    expect(signOut).toHaveBeenCalled();

    rerender({ signOut, session: null });
    expect(screen.getByLabelText(t.email)).toHaveValue('a@b.ch');
  });

  it.each([
    ['invitation', t.inviteInvalid],
    ['weakPassword', t.registerErrShort.replace('{n}', '15')],
    ['rateLimit', t.authErrRateLimit],
    ['unavailable', t.authErrUnavailable],
  ] as const)('shows the message for a %s failure and keeps the form', async (failure, message) => {
    lookup({ data: invitation });
    const signUp = vi.fn().mockResolvedValue({ error: failure });
    const user = userEvent.setup();
    renderDialog({ signUp });

    await signUpWith(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: t.inviteSubmit })).toBeEnabled();
  });

  it('keeps the welcome step when the used invitation no longer looks up', async () => {
    lookup({ data: invitation });
    const signUp = vi.fn().mockResolvedValue({ error: null });
    const user = userEvent.setup();
    const { rerender } = renderDialog({ signUp });

    await signUpWith(user);
    await screen.findByText(t.inviteWelcome.replace('{node}', emmental));
    lookup({ data: null });
    rerender({ signUp, session: sessionFor('a@b.ch') });

    expect(screen.getByText(t.inviteWelcome.replace('{node}', emmental))).toBeInTheDocument();
    expect(screen.queryByText(t.inviteInvalid)).toBeNull();
  });

  // Signing out would gain nothing: the link is dead either way.
  it('says a dead link is dead before offering to sign out', () => {
    lookup({ data: null });
    renderDialog({ session: sessionFor('x@y.ch') });

    expect(screen.getByText(t.inviteInvalid)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.inviteSignOut })).toBeNull();
  });

  // React reuses the paragraph from the form for the welcome text, so its style has to change cleanly.
  it('moves from the form to the welcome step without a React warning', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    lookup({ data: invitation });
    const user = userEvent.setup();
    renderDialog({ signUp: vi.fn().mockResolvedValue({ error: null }) });

    await signUpWith(user);
    await screen.findByText(t.inviteWelcome.replace('{node}', emmental));

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('closes on Escape', async () => {
    lookup({ data: invitation });
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  // Closing mid-sign-up would leave the person signed in without the welcome step.
  it('stays open on Escape while the sign-up is being sent', async () => {
    lookup({ data: invitation });
    const signUp = vi.fn(() => new Promise<{ error: null }>(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderDialog({ signUp });

    await signUpWith(user);
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Cancel without signing up', async () => {
    lookup({ data: invitation });
    const signUp = vi.fn();
    const user = userEvent.setup();
    const { onClose } = renderDialog({ signUp });

    await user.click(screen.getByRole('button', { name: t.cancel }));

    expect(onClose).toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });
});
