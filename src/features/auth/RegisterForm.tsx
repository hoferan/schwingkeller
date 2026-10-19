import { useState, type FormEvent } from 'react';
import { useAssociations } from '../associations/useAssociations';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import {
  inputStyle, labelStyle, linkButtonStyle, primaryButtonStyle, secondaryButtonStyle,
} from './formStyles';
import { useAuth } from './useAuth';
import { verbandOptions } from './verbandOptions';

// Matches the minimum length set for Supabase Auth, so most short passwords never leave the form.
const MIN_PASSWORD_LENGTH = 10;

interface RegisterFormProps {
  // Called when the applicant is done: signed in straight away, or closing the "check your email" note.
  onDone: () => void;
  onBack: () => void;
}

export const RegisterForm = ({ onDone, onBack }: RegisterFormProps) => {
  const { signUp } = useAuth();
  const { t } = useTranslation();
  const options = verbandOptions(useAssociations());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [association, setAssociation] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = (): string | null => {
    if (!email.trim() || !password) return t.loginErr;
    if (password.length < MIN_PASSWORD_LENGTH) return t.registerErrShort;
    if (password !== confirm) return t.registerErrMismatch;
    if (!association) return t.registerErrAssociation;
    return null;
  };

  const doRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = validate();
    if (invalid) {
      setErr(invalid);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const { error, confirmEmail } = await signUp(email.trim(), password, association);
      if (error) {
        setErr(error);
        return;
      }
      if (confirmEmail) setSent(true);
      else onDone();
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <p role="status" style={{ margin: 0, fontSize: '14px', color: theme.color.ink, lineHeight: 1.5 }}>
          {t.registerCheckEmail}
        </p>
        <div style={{ display: 'flex', marginTop: '18px' }}>
          <button type="button" onClick={onDone} style={primaryButtonStyle}>{t.close}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { void doRegister(e); }} noValidate>
      <label htmlFor="register-email" style={labelStyle}>{t.email}</label>
      <input
        id="register-email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        autoComplete="email"
        style={inputStyle}
      />
      <label htmlFor="register-password" style={{ ...labelStyle, margin: '13px 0 6px' }}>{t.password}</label>
      <input
        id="register-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        autoComplete="new-password"
        style={inputStyle}
      />
      <label htmlFor="register-password-confirm" style={{ ...labelStyle, margin: '13px 0 6px' }}>
        {t.passwordConfirm}
      </label>
      <input
        id="register-password-confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        type="password"
        autoComplete="new-password"
        style={inputStyle}
      />
      <label htmlFor="register-association" style={{ ...labelStyle, margin: '13px 0 6px' }}>{t.association}</label>
      <select
        id="register-association"
        value={association}
        onChange={(e) => setAssociation(e.target.value)}
        style={inputStyle}
      >
        <option value="">{t.associationPlaceholder}</option>
        <option value={options.top.id}>{options.top.name}</option>
        {options.groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </optgroup>
        ))}
      </select>
      {err && <div style={{ marginTop: '10px', color: theme.color.accent, fontSize: '12.5px' }}>{err}</div>}
      <div style={{ marginTop: '10px', fontSize: '11.5px', color: theme.color.muted, fontStyle: 'italic' }}>
        {t.registerHint}
      </div>
      <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
        <button type="button" onClick={onDone} style={secondaryButtonStyle}>{t.cancel}</button>
        <button type="submit" disabled={busy} style={primaryButtonStyle}>{t.register}</button>
      </div>
      <div style={{ marginTop: '14px', textAlign: 'center' }}>
        <button type="button" onClick={onBack} style={linkButtonStyle}>{t.backToLogin}</button>
      </div>
    </form>
  );
};
