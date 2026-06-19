import { useAuth } from '../features/auth/useAuth';
import { useTranslation } from '../i18n/useTranslation';
import type { Lang } from '../i18n/translations';

interface TopbarProps {
  onToggleSidebar: () => void;
  showHamburger: boolean;
  onOpenLogin: () => void;
}

const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#e0b25f' : 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  lineHeight: '1',
  padding: '6px 8px',
  borderRadius: '7px',
  filter: active ? 'none' : 'grayscale(.45) opacity(.65)',
});

export const Topbar = ({ onToggleSidebar, showHamburger, onOpenLogin }: TopbarProps) => {
  const { isAdmin, signOut } = useAuth();
  const { lang, t, setLang } = useTranslation();

  return (
    <div
      style={{
        height: '60px', flex: 'none', background: 'linear-gradient(#352716,#2a1d10)',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '3px solid #c0851d', position: 'relative', zIndex: 1100,
      }}
    >
      {showHamburger && (
        <button
          onClick={onToggleSidebar}
          style={{
            border: 'none', background: 'rgba(255,255,255,.09)', color: '#f4ead4',
            width: '38px', height: '38px', borderRadius: '9px', cursor: 'pointer',
            fontSize: '17px', flex: 'none',
          }}
        >
          ☰
        </button>
      )}
      <div
        style={{
          width: '32px', height: '32px', borderRadius: '7px', background: '#c0851d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bitter',serif", fontWeight: 800, color: '#2a1d10',
          fontSize: '19px', flex: 'none',
        }}
      >
        S
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Bitter',serif", fontWeight: 800, letterSpacing: '0.04em',
            color: '#f4ead4', fontSize: '15px', lineHeight: 1.1, whiteSpace: 'nowrap',
          }}
        >
          SCHWINGKELLER <span style={{ color: '#e0b25f' }}>SCHWEIZ</span>
        </div>
        <div
          style={{
            fontSize: '10.5px', color: '#b69a6b', lineHeight: 1.1, marginTop: '1px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {t.tagline}
        </div>
      </div>
      <div style={{ flex: 1 }}></div>
      <div
        style={{
          display: 'flex', gap: '2px', background: 'rgba(255,255,255,.07)',
          padding: '4px', borderRadius: '9px', flex: 'none',
        }}
      >
        <button onClick={() => setLang('de' as Lang)} style={langStyle(lang === 'de')}>🇩🇪</button>
        <button onClick={() => setLang('fr' as Lang)} style={langStyle(lang === 'fr')}>🇫🇷</button>
        <button onClick={() => setLang('it' as Lang)} style={langStyle(lang === 'it')}>🇮🇹</button>
      </div>
      {isAdmin ? (
        <button
          onClick={signOut}
          title={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: '#e8d6ab', background: 'transparent',
            border: '1.5px solid #6b5634', padding: '7px 13px', borderRadius: '8px',
            cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap', display: 'flex',
            alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2"></rect>
              <path d="M8 11V7a4 4 0 0 1 7.5-1.4"></path>
            </svg>
          </span>
          {t.logout}
        </button>
      ) : (
        <button
          onClick={onOpenLogin}
          title={t.login}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: '#2a1d10', background: '#c0851d',
            border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
            flex: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2"></rect>
              <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
            </svg>
          </span>
          {t.login}
        </button>
      )}
    </div>
  );
};
