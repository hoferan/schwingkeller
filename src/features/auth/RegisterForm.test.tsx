import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The form gets signUp from the context below; the real client must not be built.
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { buildTree } from '../associations/tree';
import { associationsFor } from '../associations/useAssociations';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { AuthContext, buildAuthValue, type AuthValue } from './AuthProvider';
import { RegisterForm } from './RegisterForm';
import { verbandOptions } from './verbandOptions';

const t = STR.de;

const renderForm = (signUp: AuthValue['signUp'] = vi.fn().mockResolvedValue({ error: null, confirmEmail: true })) => {
  const onDone = vi.fn();
  const onBack = vi.fn();
  const value: AuthValue = {
    ...buildAuthValue(null, null, buildTree()),
    signIn: async () => ({ error: null }),
    signUp,
    signOut: async () => {},
  };
  render(
    <AuthContext.Provider value={value}>
      <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
        <RegisterForm onDone={onDone} onBack={onBack} />
      </I18nContext.Provider>
    </AuthContext.Provider>,
  );
  return { signUp, onDone, onBack };
};

interface Entry {
  email?: string;
  password?: string;
  confirm?: string;
  association?: string;
}

const fill = async (user: ReturnType<typeof userEvent.setup>, entry: Entry = {}) => {
  const { email = 'a@b.ch', password = 'longenough1', confirm = password, association = 'emmental' } = entry;
  if (email) await user.type(screen.getByLabelText(t.email), email);
  if (password) await user.type(screen.getByLabelText(t.password), password);
  if (confirm) await user.type(screen.getByLabelText(t.passwordConfirm), confirm);
  if (association) await user.selectOptions(screen.getByLabelText(t.association), association);
};

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: t.register }));

describe('RegisterForm', () => {
  it('shows an inline error for mismatched passwords and sends nothing', async () => {
    const user = userEvent.setup();
    const { signUp } = renderForm();
    await fill(user, { confirm: 'somethingelse' });
    await submit(user);
    expect(screen.getByText(t.registerErrMismatch)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('refuses a password under 10 characters', async () => {
    const user = userEvent.setup();
    const { signUp } = renderForm();
    await fill(user, { password: 'short12' });
    await submit(user);
    expect(screen.getByText(t.registerErrShort.replace('{n}', '10'))).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('asks for a Verband', async () => {
    const user = userEvent.setup();
    const { signUp } = renderForm();
    await fill(user, { association: '' });
    await submit(user);
    expect(screen.getByText(t.registerErrAssociation)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('refuses an empty email', async () => {
    const user = userEvent.setup();
    const { signUp } = renderForm();
    await fill(user, { email: '' });
    await submit(user);
    expect(screen.getByText(t.loginErr)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs up with the trimmed email, the password and the Verband', async () => {
    const user = userEvent.setup();
    const { signUp } = renderForm();
    await fill(user, { email: '  a@b.ch ' });
    await submit(user);
    expect(signUp).toHaveBeenCalledWith('a@b.ch', 'longenough1', 'emmental');
  });

  it('sends only once while the request is pending', async () => {
    const user = userEvent.setup();
    const { signUp } = renderForm(vi.fn().mockReturnValue(new Promise(() => {})));
    await fill(user);
    await submit(user);
    expect(screen.getByRole('button', { name: t.register })).toBeDisabled();
    await submit(user);
    expect(signUp).toHaveBeenCalledTimes(1);
  });

  it('asks the applicant to confirm their email', async () => {
    const user = userEvent.setup();
    const { onDone } = renderForm();
    await fill(user);
    await submit(user);
    expect(await screen.findByText(t.registerCheckEmail)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t.close }));
    expect(onDone).toHaveBeenCalled();
  });

  it('closes when the sign-up signed the applicant in', async () => {
    const user = userEvent.setup();
    const { onDone } = renderForm(vi.fn().mockResolvedValue({ error: null, confirmEmail: false }));
    await fill(user);
    await submit(user);
    expect(onDone).toHaveBeenCalled();
  });

  it('shows the Supabase error and keeps what was entered', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockResolvedValue({ error: 'User already registered', confirmEmail: false }));
    await fill(user);
    await submit(user);
    expect(await screen.findByText('User already registered')).toBeInTheDocument();
    expect(screen.getByLabelText(t.email)).toHaveValue('a@b.ch');
  });

  it('offers the ESV first and groups the rest by Teilverband', () => {
    renderForm();
    const select = screen.getByLabelText(t.association);
    const expected = verbandOptions(associationsFor('de'));
    const options = within(select).getAllByRole('option');
    expect(options[0]).toHaveValue('');
    expect(options[1]).toHaveValue('esv');
    const groups = within(select).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('label'))).toEqual(expected.groups.map((g) => g.label));
    expect(within(groups[0]).getAllByRole('option')[0]).toHaveValue(expected.groups[0].options[0].id);
  });

  it('goes back to sign-in', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm();
    await user.click(screen.getByRole('button', { name: t.backToLogin }));
    expect(onBack).toHaveBeenCalled();
  });

  // Without an alert role a screen-reader user who submits hears nothing at all.
  it('announces validation errors', async () => {
    const user = userEvent.setup();
    renderForm();
    await fill(user, { confirm: 'somethingelse' });
    await submit(user);
    expect(screen.getByRole('alert')).toHaveTextContent(t.registerErrMismatch);
  });

  // The submit button unmounts with the form, so focus would fall back to the page behind the modal.
  it('moves focus to the close button once the email is sent', async () => {
    const user = userEvent.setup();
    renderForm();
    await fill(user);
    await submit(user);
    expect(await screen.findByRole('button', { name: t.close })).toHaveFocus();
  });
});
