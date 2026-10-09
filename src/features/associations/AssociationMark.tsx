import type { CSSProperties } from 'react';
import type { CantonalId, RegionalId } from '../../data/associations';
import { tintOf } from '../../data/associationTints';
import { useAssociations } from './useAssociations';
import { regionalBadgeStyle } from './regionalBadgeStyle';

// The mark of a cantonal association: a dot in its Teilverband's colour. The name always sits next
// to it, so the dot is decoration for screen readers.
export const AssociationMark = ({ id, size = 10 }: { id: CantonalId; size?: number }) => {
  const style: CSSProperties = {
    display: 'inline-block',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: tintOf(id),
    flex: 'none',
  };
  return <span aria-hidden="true" style={style} />;
};

// A Teilverband heading's badge: its abbreviation in the current language, on its colour. Styled
// like the distance badge in the sidebar. A fixed `width` centres the abbreviation, so badges in a
// column line up whatever their text.
export const RegionalBadge = ({ id, width, title }: { id: RegionalId; width?: string; title?: string }) => {
  const { shortOf } = useAssociations();
  const style: CSSProperties = {
    ...regionalBadgeStyle(id),
    ...(width ? { width, boxSizing: 'border-box', textAlign: 'center' } : {}),
  };
  return <span title={title} style={style}>{shortOf(id)}</span>;
};
