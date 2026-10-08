import type { CSSProperties } from 'react';
import type { RegionalId } from '../../data/associations';
import { REGIONAL_TINTS, tintOf } from '../../data/associationTints';
import { theme } from '../../theme';
import { useAssociations } from './useAssociations';

// The mark of a cantonal association: a dot in its Teilverband's colour. The name always sits next
// to it, so the dot is decoration for screen readers.
export const AssociationMark = ({ id, size = 10 }: { id: string | null | undefined; size?: number }) => {
  const tint = tintOf(id);
  if (!tint) return null;
  const style: CSSProperties = {
    display: 'inline-block',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: tint,
    flex: 'none',
  };
  return <span aria-hidden="true" style={style} />;
};

// A Teilverband heading's badge: its abbreviation in the current language, on its colour. Styled
// like the distance badge in the sidebar. A fixed `width` centres the abbreviation, so badges in a
// column line up whatever their text.
export const RegionalBadge = ({ id, width }: { id: RegionalId; width?: string }) => {
  const { shortOf } = useAssociations();
  const style: CSSProperties = {
    flex: 'none',
    fontFamily: theme.font.display,
    fontSize: '11px',
    fontWeight: 700,
    color: theme.color.accentInk,
    background: REGIONAL_TINTS[id],
    padding: '2px 9px',
    borderRadius: theme.radius.pill,
    whiteSpace: 'nowrap',
    ...(width ? { width, boxSizing: 'border-box', textAlign: 'center' } : {}),
  };
  return <span style={style}>{shortOf(id)}</span>;
};
