import { useState } from 'react';
import { useAuth } from './useAuth';
import { theme } from '../../theme';
import { useTranslation } from '../../i18n/useTranslation';
import { isFeatureOn } from '../../lib/features';
import {
  inputStyle, labelStyle, linkButtonStyle, primaryButtonStyle, secondaryButtonStyle,
} from './formStyles';
import { RegisterForm } from './RegisterForm';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal = ({ onClose }: LoginModalProps) => {
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // A sign-in error belongs to the attempt that caused it, so it goes when the form does.
  const switchMode = (next: 'login' | 'register') => {
    setErr('');
    setMode(next);
  };

  const doLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErr(t.loginErr);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErr(error);
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
          boxShadow: theme.shadow, width: '360px', maxWidth: '100%', animation: 'popIn .26s ease', overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: theme.color.ink, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '11px',
          }}
        >
          <span style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '16px', fontWeight: 700, color: theme.color.bg }}>
            {mode === 'register' ? t.registerTitle : t.loginTitle}
          </span>
        </div>
        {/* The registration form is taller than a phone screen in landscape, so the body scrolls
            below the header instead of pushing the modal off the screen. */}
        <div style={{ padding: '18px 20px 20px', maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto' }}>
          {mode === 'register' ? (
            <RegisterForm onDone={onClose} onBack={() => switchMode('login')} />
          ) : (
          <>
          {/* htmlFor/id rather than bare labels: without the association the fields have no
              accessible name at all, and clicking a label does not focus its field. */}
          <label htmlFor="login-email" style={labelStyle}>{t.email}</label>
          <input
            id="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            style={inputStyle}
          />
          <label htmlFor="login-password" style={{ ...labelStyle, margin: '13px 0 6px' }}>{t.password}</label>
          <input
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void doLogin(); }}
            type="password"
            style={inputStyle}
          />
          {err && (
            <div style={{ marginTop: '10px', color: theme.color.accent, fontSize: '12.5px' }}>{err}</div>
          )}
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: theme.color.muted, fontStyle: 'italic' }}>
            {t.loginHintReal}
          </div>
          <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
            <button
              onClick={onClose}
              style={secondaryButtonStyle}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => { void doLogin(); }}
              disabled={busy}
              style={primaryButtonStyle}
            >
              {t.login}
            </button>
          </div>
          {isFeatureOn('editors') && (
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <button type="button" onClick={() => switchMode('register')} style={linkButtonStyle}>
                {t.registerLink}
              </button>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};
