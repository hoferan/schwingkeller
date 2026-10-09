import type { CSSProperties } from 'react';
import { Home, Mountain, ArrowRight } from 'lucide-react';
import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { coverPhotoUrl } from '../venues/photos';
import { theme } from '../../theme';
import { isFeatureOn } from '../../lib/features';
import type { RegionalId } from '../../data/associations';
import type { Associations } from '../associations/useAssociations';
import { regionalBadgeStyle } from '../associations/regionalBadgeStyle';

type T = typeof STR.de;

interface MarkerPopupProps {
  venue: Venue;
  t: T;
  associations: Associations;
}

// Matches svgIcon's inline style from the old popupHtml string builder, preserved for
// pixel-equivalent alignment inside the badge/button text.
const iconStyle: CSSProperties = { flex: 'none', verticalAlign: '-2px' };

const wrapStyle: CSSProperties = { width: '222px', fontFamily: 'Work Sans, sans-serif' };
const photoStyle = (url: string): CSSProperties => ({
  height: '104px', background: `url(${url}) center/cover`,
});
const bodyStyle: CSSProperties = { padding: '11px 13px 13px' };
// The arms line up with the first line of a long name. Without a photo the close button sits on
// the body, so the name keeps clear of it.
const headerRowStyle = (photo: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', gap: '7px', paddingRight: photo ? 0 : '28px',
});
const wappenStyle: CSSProperties = {
  width: '15px', height: '19px', objectFit: 'contain', flex: 'none', marginTop: '1px',
  filter: theme.armsOutline,
};
const nameStyle: CSSProperties = {
  fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700, fontSize: '14.5px',
  color: theme.color.ink, lineHeight: 1.2,
};
const addressStyle: CSSProperties = { fontSize: '11.5px', color: theme.color.muted, marginTop: '3px' };
const verbandRowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', fontSize: '11.5px',
  color: theme.color.muted,
};
const tagsRowStyle: CSSProperties = { display: 'flex', gap: '6px', marginTop: '9px' };
const tagStyle: CSSProperties = {
  fontSize: '11.5px', fontWeight: 600, color: theme.color.ink, background: theme.color.bg,
  border: '1px solid ' + theme.color.line, borderRadius: theme.radius.pill, padding: '3px 9px',
};
const detailBtnStyle: CSSProperties = {
  marginTop: '12px', width: '100%', height: '40px', border: 'none', cursor: 'pointer',
  background: theme.color.accent, color: theme.color.accentInk, fontFamily: theme.font.body,
  fontWeight: 600, fontSize: '13px', borderRadius: '10px',
};

// Rendered to a static HTML string (see markers.tsx's popupHtml) and handed to Leaflet's
// bindPopup as plain content, so there's no live React tree here — the Details button uses
// data-detail instead of a real onClick; MapView.tsx wires the click via DOM delegation.
export function MarkerPopup({ venue, t, associations }: MarkerPopupProps) {
  const c = cantonByCode(venue.canton);
  const photo = coverPhotoUrl(venue);
  // With the verband flag on, the Teilverband's badge, in the pin's colour, says what the colour means.
  const regional = isFeatureOn('verband') ? associations.regionalOf(venue.association_id) : null;
  const regionalId = regional?.id as RegionalId | undefined;
  return (
    <div style={wrapStyle}>
      {photo && <div data-popup-photo="" style={photoStyle(photo)} />}
      <div style={bodyStyle}>
        <div style={headerRowStyle(!!photo)}>
          {c && <img src={wappenUrl(c.code)} alt="" style={wappenStyle} />}
          <span style={nameStyle}>{venue.name}</span>
        </div>
        <div style={addressStyle}>{venue.address}</div>
        {regionalId && (
          <div style={verbandRowStyle}>
            <span
              title={associations.nameOf(regionalId)}
              style={{ ...regionalBadgeStyle(regionalId), fontSize: '10.5px', padding: '1px 7px' }}
            >
              {associations.shortOf(regionalId)}
            </span>
            <span>{associations.nameOf(venue.association_id)}</span>
          </div>
        )}
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
