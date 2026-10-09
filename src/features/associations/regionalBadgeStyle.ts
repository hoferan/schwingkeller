import type { CSSProperties } from 'react';
import type { RegionalId } from '../../data/associations';
import { REGIONAL_TINTS } from '../../data/associationTints';
import { theme } from '../../theme';

// A Teilverband badge's look: its abbreviation in white on its colour. RegionalBadge uses it, and so
// does the map popup, which is static HTML and can't use the component.
export const regionalBadgeStyle = (id: RegionalId): CSSProperties => ({
  flex: 'none',
  fontFamily: theme.font.display,
  fontSize: '11px',
  fontWeight: 700,
  color: theme.color.accentInk,
  background: REGIONAL_TINTS[id],
  padding: '2px 9px',
  borderRadius: theme.radius.pill,
  whiteSpace: 'nowrap',
});
