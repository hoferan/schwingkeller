import { Lock, Unlock } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { useTranslation } from '../i18n/useTranslation';
import { LANGS, type Lang } from '../i18n/translations';
import { theme } from '../theme';

interface TopbarProps {
  onOpenLogin: () => void;
  isMobile: boolean;
}

const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', fr: 'Français', it: 'Italiano' };

const langStyle = (active: boolean): React.CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: '1',
  padding: '6px 10px',
  borderRadius: theme.radius.pill,
});

export const Topbar = ({ onOpenLogin, isMobile }: TopbarProps) => {
  const { isAdmin, signOut } = useAuth();
  const { lang, t, setLang } = useTranslation();

  const adminPill = isAdmin && (
    <div
      title={t.adminMode}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 'none',
        background: theme.color.accent, color: theme.color.accentInk, fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 12px',
        borderRadius: theme.radius.pill, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: theme.color.accentInk, flex: 'none' }}></span>
      {isMobile ? 'Admin' : t.adminMode}
    </div>
  );

  return (
    <div
      style={{
        height: '60px', flex: 'none', background: theme.color.bg,
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: '9px',
        borderBottom: '2px solid ' + theme.color.accent, position: 'relative', zIndex: 1100,
      }}
    >
      {/* Wordmark: always visible, matching the AFLS reference. Tagline stays mobile-hidden to save vertical space. */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.font.display, fontWeight: 700, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: theme.color.accent, fontSize: '15px', lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          SCHWINGKELLER
        </div>
        {!isMobile && (
          <div
            style={{
              fontSize: '10.5px', color: theme.color.muted, lineHeight: 1.1, marginTop: '1px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {t.tagline}
          </div>
        )}
      </div>

      {/* Centered admin pill: flanked by two flex spacers so it sits mid-bar. */}
      <div style={{ flex: 1 }}></div>
      {isAdmin && (
        <>
          {adminPill}
          <div style={{ flex: 1 }}></div>
        </>
      )}

      {/* Language switcher: one text-pill row at every width, matching the AFLS reference. */}
      <div
        style={{
          display: 'flex', gap: '2px', background: theme.color.paper,
          padding: '4px', borderRadius: theme.radius.pill, flex: 'none',
        }}
      >
        {LANGS.map((l) => (
          <button key={l} onClick={() => setLang(l)} aria-label={LANG_NAMES[l]} style={langStyle(lang === l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {isAdmin ? (
        <button
          onClick={signOut}
          type="button"
          title={t.logout}
          aria-label={t.logout}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.ink, background: 'transparent',
            border: '1.5px solid ' + theme.color.line, borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '7px 13px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}><Unlock size={13} /></span>
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
            border: 'none', borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: isMobile ? '0' : '8px 14px', width: isMobile ? '38px' : 'auto',
            height: isMobile ? '38px' : 'auto',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}><Lock size={13} /></span>
          {!isMobile && t.login}
        </button>
      )}
    </div>
  );
};
