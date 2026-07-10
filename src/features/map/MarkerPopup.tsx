import type { CSSProperties } from 'react';
import { Home, Mountain, ArrowRight } from 'lucide-react';
import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { theme } from '../../theme';

type T = typeof STR.de;

interface MarkerPopupProps {
  venue: Venue;
  t: T;
}

// Matches svgIcon's inline style from the old popupHtml string builder, preserved for
// pixel-equivalent alignment inside the badge/button text.
const iconStyle: CSSProperties = { flex: 'none', verticalAlign: '-2px' };

const wrapStyle: CSSProperties = { width: '222px', fontFamily: 'Work Sans, sans-serif' };
const photoStyle = (url: string): CSSProperties => ({
  height: '104px', background: `url(${url}) center/cover`,
});
const photoPlaceholderStyle: CSSProperties = {
  height: '104px', background: 'repeating-linear-gradient(45deg,#e5e5e5 0 9px,#d4d4d4 9px 18px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const fotoLabelStyle: CSSProperties = {
  fontFamily: 'monospace', fontSize: '10px', letterSpacing: '.1em', color: theme.color.ink,
  background: theme.color.bg, border: '1px solid ' + theme.color.line,
  borderRadius: theme.radius.pill, padding: '3px 7px',
};
const bodyStyle: CSSProperties = { padding: '11px 13px 13px' };
const headerRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '7px' };
const wappenStyle: CSSProperties = { width: '15px', height: '19px', objectFit: 'contain' };
const nameStyle: CSSProperties = {
  fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700, fontSize: '14.5px',
  color: theme.color.ink, lineHeight: 1.2,
};
const addressStyle: CSSProperties = { fontSize: '11.5px', color: theme.color.muted, marginTop: '3px' };
const tagsRowStyle: CSSProperties = { display: 'flex', gap: '6px', marginTop: '9px' };
const tagStyle: CSSProperties = {
  fontSize: '10.5px', fontWeight: 600, color: theme.color.ink, background: theme.color.bg,
  border: '1px solid ' + theme.color.line, borderRadius: theme.radius.pill, padding: '3px 8px',
};
const detailBtnStyle: CSSProperties = {
  marginTop: '11px', width: '100%', border: 'none', cursor: 'pointer', background: theme.color.accent,
  color: theme.color.accentInk, fontFamily: theme.font.body, fontWeight: 600, fontSize: '12.5px',
  padding: '9px', borderRadius: '10px',
};

// Rendered to a static HTML string (see markers.tsx's popupHtml) and handed to Leaflet's
// bindPopup as plain content, so there's no live React tree here — the Details button uses
// data-detail instead of a real onClick; MapView.tsx wires the click via DOM delegation.
export function MarkerPopup({ venue, t }: MarkerPopupProps) {
  const c = cantonByCode(venue.canton);
  return (
    <div style={wrapStyle}>
      {venue.photo_url ? (
        <div style={photoStyle(venue.photo_url)} />
      ) : (
        <div style={photoPlaceholderStyle}>
          <span style={fotoLabelStyle}>FOTO</span>
        </div>
      )}
      <div style={bodyStyle}>
        <div style={headerRowStyle}>
          {c && <img src={wappenUrl(c.code)} alt="" style={wappenStyle} />}
          <span style={nameStyle}>{venue.name}</span>
        </div>
        <div style={addressStyle}>{venue.address}</div>
        <div style={tagsRowStyle}>
          {venue.indoor && (
            <span style={tagStyle}><Home size={11} style={iconStyle} /> {t.indoor}</span>
          )}
          {venue.outdoor && (
            <span style={tagStyle}><Mountain size={11} style={iconStyle} /> {t.outdoor}</span>
          )}
        </div>
        <button data-detail={venue.id} style={detailBtnStyle}>
          {t.details} <ArrowRight size={13} style={iconStyle} />
        </button>
      </div>
    </div>
  );
}
