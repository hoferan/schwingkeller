import { useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Venue } from '../venues/types';
import { tintOf } from '../../data/associationTints';
import { useAssociations } from '../associations/useAssociations';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';

// Styled like the map/satellite switch above it (baseToggleWrapStyle and baseToggleBtnStyle in
// MapView): grey, flat, 4px inset, 13px bold labels. Collapsed it is a pill of the switch's height.
// Open, its corners are rounded by half that height, so they match the ends of the switch.
const cardStyle = (open: boolean): CSSProperties => ({
  background: theme.color.paper, padding: '4px', borderRadius: open ? '17px' : theme.radius.pill,
  fontSize: '13px', color: theme.color.ink,
});
const toggleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 10px',
  border: 'none', background: 'transparent', cursor: 'pointer', color: theme.color.muted,
  font: 'inherit', fontWeight: 700, lineHeight: '1',
};
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: '2px 10px 6px' };
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' };
const dot = (color: string, size = 10): CSSProperties => ({
  display: 'inline-block', width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color, flex: 'none',
});

// Names the pin colours, since colour alone doesn't say which Teilverband a pin belongs to. Open on
// larger screens; on a phone it starts as a row of dots so it doesn't hide the map.
export const MapLegend = ({ venues, isMobile }: { venues: Venue[]; isMobile: boolean }) => {
  const { t } = useTranslation();
  const { childrenOf, shortOf, nameOf } = useAssociations();
  const [open, setOpen] = useState(!isMobile);
  const regionals = childrenOf('esv');
  const hasUnassigned = venues.some((v) => !tintOf(v.association_id));

  return (
    <div style={cardStyle(open)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t.legendHide : t.legendShow}
        style={toggleStyle}
      >
        {open ? (
          <span>{t.legendTitle}</span>
        ) : (
          <span style={{ display: 'flex', gap: '4px' }}>
            {regionals.map((r) => <span key={r.id} style={dot(tintOf(r.id) ?? theme.color.accent)} />)}
          </span>
        )}
        <ChevronDown size={14} style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <ul style={listStyle} aria-label={t.legendTitle}>
          {regionals.map((r) => (
            <li key={r.id} title={nameOf(r.id)} style={rowStyle}>
              <span aria-hidden="true" style={dot(tintOf(r.id) ?? theme.color.accent)} />
              {shortOf(r.id)}
            </li>
          ))}
          {hasUnassigned && (
            <li style={rowStyle}>
              <span aria-hidden="true" style={dot(theme.color.accent)} />
              {t.unassignedGroup}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
