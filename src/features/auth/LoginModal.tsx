import { useState } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from '../../i18n/useTranslation';

interface LoginModalProps {
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0cfa6', borderRadius: '9px', padding: '11px 13px',
  fontSize: '14px', color: '#3a2a18', background: '#fff', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#9a7c45', marginBottom: '6px',
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
        position: 'fixed', inset: 0, background: 'rgba(30,20,10,.52)', zIndex: 1500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#f6edd9', borderRadius: '16px', width: '360px', maxWidth: '100%',
          boxShadow: '0 26px 64px rgba(30,20,10,.5)', animation: 'popIn .26s ease', overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(#352716,#2a1d10)', padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '11px',
          }}
        >
          <div
            style={{
              width: '30px', height: '30px', borderRadius: '7px', background: '#c0851d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bitter',serif", fontWeight: 800, color: '#2a1d10', fontSize: '17px',
            }}
          >
            S
          </div>
          <span style={{ fontFamily: "'Bitter',serif", fontSize: '16px', fontWeight: 800, color: '#f4ead4' }}>
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
            <div style={{ marginTop: '10px', color: '#a3402c', fontSize: '12.5px' }}>{err}</div>
          )}
          <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#a08a64', fontStyle: 'italic' }}>
            {t.loginHintReal}
          </div>
          <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, border: '1.5px solid #c9a85e', background: 'transparent', color: '#5a4527',
                fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={() => { void doLogin(); }}
              disabled={busy}
              style={{
                flex: 1, border: 'none', background: '#c0851d', color: '#2a1d10',
                fontWeight: 700, fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
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
