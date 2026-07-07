import { useState } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { useTranslation } from '../i18n/useTranslation';
import { LANGS, type Lang } from '../i18n/translations';
import { theme } from '../theme';

interface TopbarProps {
  onToggleSidebar: () => void;
  showHamburger: boolean;
  onOpenLogin: () => void;
  isMobile: boolean;
}

const LANG_FLAGS: Record<Lang, string> = { de: '🇩🇪', fr: '🇫🇷', it: '🇮🇹' };

const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  lineHeight: '1',
  padding: '6px 8px',
  borderRadius: theme.radius,
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
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const adminPill = isAdmin && (
    <div
      title={t.adminMode}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 'none',
        background: theme.color.accent, color: theme.color.accentInk, fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 12px',
        borderRadius: theme.radius, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: theme.color.accentInk, flex: 'none' }}></span>
      {isMobile ? 'Admin' : t.adminMode}
    </div>
  );

  return (
    <div
      style={{
        height: '60px', flex: 'none', background: theme.color.ink,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '3px solid ' + theme.color.accent, position: 'relative', zIndex: 1100,
      }}
    >
      {showHamburger && (
        <button
          onClick={onToggleSidebar}
          aria-label="Menu"
          style={{
            border: 'none', background: 'rgba(255,255,255,.09)', color: theme.color.bg,
            width: '38px', height: '38px', borderRadius: theme.radius, cursor: 'pointer',
            fontSize: '17px', flex: 'none',
          }}
        >
          ☰
        </button>
      )}
      <div
        style={{
          width: '32px', height: '32px', borderRadius: theme.radius, background: theme.color.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk,
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
              fontFamily: theme.font.display, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: theme.color.bg, fontSize: '15px', lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}
          >
            SCHWINGKELLER <span style={{ color: theme.color.accent }}>SCHWEIZ</span>
          </div>
          <div
            style={{
              fontSize: '10.5px', color: theme.color.muted, lineHeight: 1.1, marginTop: '1px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {t.tagline}
          </div>
        </div>
      )}

      {/* Centered admin pill: flanked by two flex spacers so it sits mid-bar. */}
      <div style={{ flex: 1 }}></div>
      {isAdmin && (
        <>
          {adminPill}
          <div style={{ flex: 1 }}></div>
        </>
      )}

      {/* Language switcher: compact menu on mobile, inline flags on desktop. */}
      {isMobile ? (
        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            onClick={() => setLangMenuOpen((o) => !o)}
            aria-label="Sprache / langue / lingua"
            aria-expanded={langMenuOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,.07)',
              border: 'none', borderRadius: theme.radius, padding: '6px 8px', cursor: 'pointer',
              fontSize: '15px', lineHeight: 1, color: theme.color.bg,
            }}
          >
            {LANG_FLAGS[lang]}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {langMenuOpen && (
            <>
              <div
                onClick={() => setLangMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 1190 }}
              />
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 1200,
                  background: theme.color.ink, border: '1px solid ' + theme.color.bg, borderRadius: theme.radius,
                  padding: '4px', minWidth: '92px',
                }}
              >
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setLangMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      background: l === lang ? theme.color.accent : 'transparent', border: 'none',
                      color: theme.color.bg, fontSize: '13px', fontWeight: 600, padding: '8px 10px',
                      borderRadius: theme.radius, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '15px' }}>{LANG_FLAGS[l]}</span>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex', gap: '2px', background: 'rgba(255,255,255,.07)',
            padding: '4px', borderRadius: theme.radius, flex: 'none',
          }}
        >
          <button onClick={() => setLang('de')} aria-label="Deutsch" style={langStyle(lang === 'de')}>🇩🇪</button>
          <button onClick={() => setLang('fr')} aria-label="Français" style={langStyle(lang === 'fr')}>🇫🇷</button>
          <button onClick={() => setLang('it')} aria-label="Italiano" style={langStyle(lang === 'it')}>🇮🇹</button>
        </div>
      )}

      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.bg, background: 'transparent',
            border: '1.5px solid ' + theme.color.bg, borderRadius: theme.radius, cursor: 'pointer', flex: 'none',
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
            fontSize: '12.5px', fontWeight: 600, color: theme.color.accentInk, background: theme.color.accent,
            border: 'none', borderRadius: theme.radius, cursor: 'pointer', flex: 'none',
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
