import { useState, type FormEvent } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle } from './formStyles';

// Matches GoTrue's minimum_password_length, so a short password never leaves the form. There are no
// rules on the mix of characters, and no maximum below bcrypt's 72 bytes.
export const MIN_PASSWORD_LENGTH = 15;

interface SignUpFormProps {
  // The invited address. The invitation is valid for this one only, so it can't be changed.
  email: string;
  busy: boolean;
  // A translated message from the dialog, about the last attempt.
  error: string;
  // Called with a password that passed the checks here.
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export const SignUpForm = ({ email, busy, error, onSubmit, onCancel }: SignUpFormProps) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invalid, setInvalid] = useState('');

  const validate = (): string | null => {
    if (!password) return t.loginErr;
    if (password.length < MIN_PASSWORD_LENGTH) return t.registerErrShort.replace('{n}', String(MIN_PASSWORD_LENGTH));
    if (password !== confirm) return t.registerErrMismatch;
    return null;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = validate();
    setInvalid(problem ?? '');
    if (!problem) onSubmit(password);
  };

  const message = invalid || error;

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="signup-email" style={labelStyle}>{t.email}</label>
      <input
        id="signup-email"
        value={email}
        readOnly
        type="email"
        autoComplete="username"
        style={{ ...inputStyle, background: theme.color.paper }}
      />
      <label htmlFor="signup-password" style={{ ...labelStyle, margin: '13px 0 6px' }}>{t.password}</label>
      <input
        id="signup-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        autoComplete="new-password"
        aria-describedby="signup-password-rule"
        style={inputStyle}
      />
      <div id="signup-password-rule" style={{ marginTop: '6px', fontSize: '11.5px', color: theme.color.muted }}>
        {t.passwordRule.replace('{n}', String(MIN_PASSWORD_LENGTH))}
      </div>
      <label htmlFor="signup-password-confirm" style={{ ...labelStyle, margin: '13px 0 6px' }}>
        {t.passwordConfirm}
      </label>
      <input
        id="signup-password-confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        type="password"
        autoComplete="new-password"
        style={inputStyle}
      />
      {message && (
        <div role="alert" style={{ marginTop: '10px', color: theme.color.accent, fontSize: '12.5px' }}>{message}</div>
      )}
      <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
        <button type="button" onClick={onCancel} style={secondaryButtonStyle}>{t.cancel}</button>
        <button type="submit" disabled={busy} style={primaryButtonStyle}>{t.inviteSubmit}</button>
      </div>
    </form>
  );
};
