import { useState } from 'react';
import { useAuth } from './useAuth';
import { theme } from '../../theme';
import { useTranslation } from '../../i18n/useTranslation';

interface LoginModalProps {
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};

export const LoginModal = ({ onClose }: LoginModalProps) => {
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
            {t.loginTitle}
          </span>
        </div>
        <div style={{ padding: '18px 20px 20px' }}>
          <label style={labelStyle}>{t.email}</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            style={inputStyle}
          />
          <label style={{ ...labelStyle, margin: '13px 0 6px' }}>{t.password}</label>
          <input
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
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => { void doLogin(); }}
              disabled={busy}
              style={{
                flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                fontWeight: 700, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
              }}
            >
              {t.login}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
