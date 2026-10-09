import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Venue } from '../venues/types';
import { wappenUrl } from '../../data/cantons';
import { theme } from '../../theme';

const rowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '13px 14px',
  margin: '7px 0',
  borderRadius: theme.radius.sm,
  cursor: 'pointer',
  background: sel ? theme.color.paper : theme.color.bg,
  border: sel ? '1.5px solid ' + theme.color.accent : '1px solid ' + theme.color.line,
  boxShadow: sel ? theme.shadow : 'none',
});

const chevronBadgeStyle = (sel: boolean): CSSProperties => ({
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  background: sel ? theme.color.bg : theme.color.paper,
  color: theme.color.accent,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const lineStyle = (size: string, color: string, weight?: number): CSSProperties => ({
  fontSize: size,
  ...(weight ? { fontWeight: weight } : {}),
  color,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const ARMS_SIZE = {
  row: { width: '16px', height: '20px' },
  header: { width: '21px', height: '26px' },
} as const;

// "town" line: drop the street part of the address, fall back to full address.
const townOf = (address: string): string =>
  address.split(',').slice(1).join(',').trim() || address;

// A canton's coat of arms. The canton name always sits next to it or is a fact about the venue in
// the row, so the image is decoration for screen readers.
export const CantonArms = ({ code, size }: { code: string; size: keyof typeof ARMS_SIZE }) => (
  <img
    src={wappenUrl(code)}
    alt=""
    style={{
      ...ARMS_SIZE[size],
      objectFit: 'contain',
      flex: 'none',
      filter: theme.armsOutline,
    }}
  />
);

export const RowChevron = ({ selected }: { selected: boolean }) => (
  <span style={chevronBadgeStyle(selected)}><ChevronRight size={14} /></span>
);

interface VenueRowProps {
  venue: Venue;
  selected: boolean;
  onSelect: (id: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const VenueRow = ({ venue, selected, onSelect, leading, trailing }: VenueRowProps) => (
  <div data-testid="venue-row" aria-current={selected || undefined} onClick={() => onSelect(venue.id)} style={rowStyle(selected)}>
    {leading}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={lineStyle('14px', theme.color.ink, 600)}>{venue.name}</div>
      <div style={lineStyle('12px', theme.color.muted)}>{townOf(venue.address)}</div>
    </div>
    {trailing}
  </div>
);
