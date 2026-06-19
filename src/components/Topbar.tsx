import { useAuth } from '../features/auth/useAuth';
import { useTranslation } from '../i18n/useTranslation';
import type { Lang } from '../i18n/translations';

interface TopbarProps {
  onToggleSidebar: () => void;
  showHamburger: boolean;
  onOpenLogin: () => void;
  isMobile: boolean;
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

const lockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
  </svg>
);

const unlockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2"></rect>
    <path d="M8 11V7a4 4 0 0 1 7.5-1.4"></path>
  </svg>
);

export const Topbar = ({ onToggleSidebar, showHamburger, onOpenLogin, isMobile }: TopbarProps) => {
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
          aria-label="Menu"
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
      {/* Wordmark + tagline — hidden on mobile to keep the bar from overflowing. */}
      {!isMobile && (
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
      )}
      <div style={{ flex: 1 }}></div>
      {/* Admin-mode indicator — visible cue that editing is unlocked. */}
      {isAdmin && (
        <div
          title={t.adminMode}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', flex: 'none',
            background: 'rgba(125,223,134,.12)', border: '1px solid rgba(125,223,134,.4)',
            color: '#cfe9bf', fontSize: '11px', fontWeight: 600, padding: '5px 9px',
            borderRadius: '999px', whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7ddf86', flex: 'none' }}></span>
          {t.adminMode}
        </div>
      )}
      <div
        style={{
          display: 'flex', gap: '2px', background: 'rgba(255,255,255,.07)',
          padding: '4px', borderRadius: '9px', flex: 'none',
        }}
      >
        <button onClick={() => setLang('de' as Lang)} aria-label="Deutsch" style={langStyle(lang === 'de')}>🇩🇪</button>
        <button onClick={() => setLang('fr' as Lang)} aria-label="Français" style={langStyle(lang === 'fr')}>🇫🇷</button>
        <button onClick={() => setLang('it' as Lang)} aria-label="Italiano" style={langStyle(lang === 'it')}>🇮🇹</button>
      </div>
      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: '#e8d6ab', background: 'transparent',
            border: '1.5px solid #6b5634', borderRadius: '8px', cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '7px 13px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{unlockIcon}</span>
          {!isMobile && t.logout}
        </button>
      ) : (
        <button
          onClick={onOpenLogin}
          type="button"
          title={t.login}
          aria-label={t.login}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: '#2a1d10', background: '#c0851d',
            border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '8px 14px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{lockIcon}</span>
          {!isMobile && t.login}
        </button>
      )}
    </div>
  );
};
