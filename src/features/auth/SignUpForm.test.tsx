import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import { SignUpForm } from './SignUpForm';

const t = STR.de;

const renderForm = (props: { busy?: boolean; error?: string } = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <I18nContext.Provider value={{ lang: 'de', t, setLang: vi.fn() }}>
      <SignUpForm
        email="a@b.ch"
        busy={props.busy ?? false}
        error={props.error ?? ''}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </I18nContext.Provider>,
  );
  return { onSubmit, onCancel };
};

const fill = async (user: ReturnType<typeof userEvent.setup>, password: string, confirm = password) => {
  if (password) await user.type(screen.getByLabelText(t.password), password);
  if (confirm) await user.type(screen.getByLabelText(t.passwordConfirm), confirm);
  await user.click(screen.getByRole('button', { name: t.inviteSubmit }));
};

describe('SignUpForm', () => {
  // The invitation is for one address, so there is nothing to type, and a password manager stores
  // the password under it.
  it('shows the invited address, locked', () => {
    renderForm();
    const email = screen.getByLabelText(t.email);
    expect(email).toHaveValue('a@b.ch');
    expect(email).toHaveAttribute('readonly');
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText(t.password)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(t.passwordConfirm)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('states the password rule next to the field', () => {
    renderForm();
    const rule = t.passwordRule.replace('{n}', '15');
    expect(screen.getByLabelText(t.password)).toHaveAccessibleDescription(rule);
  });

  it('refuses 14 characters', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fill(user, 'a'.repeat(14));
    expect(screen.getByRole('alert')).toHaveTextContent(t.registerErrShort.replace('{n}', '15'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts 15 characters', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fill(user, 'a'.repeat(15));
    expect(onSubmit).toHaveBeenCalledWith('a'.repeat(15));
  });

  it('accepts 64 characters', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fill(user, 'b'.repeat(64));
    expect(onSubmit).toHaveBeenCalledWith('b'.repeat(64));
  });

  it('refuses two different passwords', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fill(user, 'a'.repeat(15), 'c'.repeat(15));
    expect(screen.getByRole('alert')).toHaveTextContent(t.registerErrMismatch);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for a password when none is given', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await fill(user, '');
    expect(screen.getByRole('alert')).toHaveTextContent(t.loginErr);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the error it is given', () => {
    renderForm({ error: 'Etwas ging schief.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Etwas ging schief.');
  });

  it('cannot be sent twice while busy', () => {
    renderForm({ busy: true });
    expect(screen.getByRole('button', { name: t.inviteSubmit })).toBeDisabled();
  });

  it('ignores Enter while busy', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ busy: true });
    await user.type(screen.getByLabelText(t.password), 'a'.repeat(15));
    await user.type(screen.getByLabelText(t.passwordConfirm), 'a'.repeat(15) + '{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();
    await user.click(screen.getByRole('button', { name: t.cancel }));
    expect(onCancel).toHaveBeenCalled();
  });
});
