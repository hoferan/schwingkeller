import type { CSSProperties, ReactNode } from 'react';
import { Camera, ChevronRight } from 'lucide-react';
import type { Venue } from '../venues/types';
import type { PosterTarget } from '../venues/posterSubject';
import { groupByAssociation } from '../associations/grouping';
import { useAssociations } from '../associations/useAssociations';
import { AssociationMark, RegionalBadge } from '../associations/AssociationMark';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { CantonArms, RowChevron, VenueRow } from './VenueRow';

// Wider than the widest abbreviation, so every Teilverband name starts at the same place.
const BADGE_WIDTH = '46px';

interface AssociationGroupsProps {
  list: Venue[];
  filtering: boolean;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isAdmin: boolean;
  onGeneratePoster: (target: PosterTarget) => void;
}

const posterButtonStyle: CSSProperties = {
  width: '26px', height: '26px', border: 'none', background: 'transparent',
  color: theme.color.ink, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
};

const headerStyle = (level: 1 | 2): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: level === 1 ? '12px' : '10px',
  width: '100%',
  flex: 1, // shares a row with the poster button on Verband rows
  minWidth: 0,
  padding: level === 1 ? '13px 2px' : '10px 2px 10px 14px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
});

const nameStyle = (level: 1 | 2): CSSProperties =>
  level === 1
    ? {
        fontFamily: theme.font.display,
        textTransform: 'uppercase',
        fontWeight: 700,
        color: theme.color.ink,
        fontSize: '13.5px',
        lineHeight: 1.2,
        flex: 1,
      }
    : { fontSize: '14px', fontWeight: 600, color: theme.color.ink, flex: 1 };

const countStyle: CSSProperties = {
  flex: 'none',
  fontSize: '11px',
  fontWeight: 700,
  color: theme.color.accentInk,
  background: theme.color.ink,
  padding: '2px 9px',
  borderRadius: theme.radius.pill,
};

const emptyStyle: CSSProperties = {
  padding: '6px 12px 12px 14px',
  color: theme.color.muted,
  fontSize: '12.5px',
  lineHeight: 1.5,
};

interface GroupHeaderProps {
  id: string;
  level: 1 | 2;
  open: boolean;
  onToggle: (key: string) => void;
  mark: ReactNode;
  name: string;
  count: number;
}

const GroupHeader = ({ id, level, open, onToggle, mark, name, count }: GroupHeaderProps) => (
  <button
    type="button"
    aria-expanded={open}
    data-testid={`group-${id}`}
    onClick={() => onToggle(id)}
    style={headerStyle(level)}
  >
    {mark}
    <span style={nameStyle(level)}>{name}</span>
    <span data-testid="group-count" style={countStyle}>{count}</span>
    <span style={{ color: theme.color.ink, width: '12px', display: 'flex', justifyContent: 'center', flex: 'none' }}>
      <ChevronRight
        size={12}
        style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s ease' }}
      />
    </span>
  </button>
);

// The sidebar grouped by Teilverband, then Verband, shown while the verband flag is on. A venue
// sits under the association stored on it, so a club across a canton border shows its own arms.
export const AssociationGroups = ({
  list,
  filtering,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  isAdmin,
  onGeneratePoster,
}: AssociationGroupsProps) => {
  const { t } = useTranslation();
  const associations = useAssociations();
  const groups = groupByAssociation(list, associations, !filtering);
  const isOpen = (id: string) => filtering || !!expanded[id];

  const rows = (venues: Venue[]) => (
    <div style={{ padding: '1px 0 9px 14px' }}>
      {venues.map((v) => (
        <VenueRow
          key={v.id}
          venue={v}
          selected={v.id === selectedId}
          onSelect={onSelect}
          leading={<CantonArms code={v.canton} size="row" />}
          trailing={<RowChevron selected={v.id === selectedId} />}
        />
      ))}
    </div>
  );

  return (
    <>
      {groups.map((regional) => (
        <div key={regional.id} style={{ borderBottom: '1px solid ' + theme.color.line }}>
          {/* For admins the Verband rows end in a poster button, so the Teilverband row keeps the
              same space free and its chevron lines up with theirs. */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <GroupHeader
              id={regional.id}
              level={1}
              open={isOpen(regional.id)}
              onToggle={onToggle}
              mark={<RegionalBadge id={regional.id} width={BADGE_WIDTH} />}
              name={associations.nameOf(regional.id)}
              count={regional.count}
            />
            {isAdmin && <span aria-hidden="true" style={{ width: posterButtonStyle.width, flex: 'none' }} />}
          </div>
          {isOpen(regional.id) && (
            <div style={{ paddingBottom: '6px' }}>
              {regional.associations.map((a) => (
                <div key={a.id}>
                  {/* The poster button is the toggle's sibling because a button can't contain
                      another button. */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <GroupHeader
                      id={a.id}
                      level={2}
                      open={isOpen(a.id)}
                      onToggle={onToggle}
                      mark={<AssociationMark id={a.id} />}
                      name={associations.nameOf(a.id)}
                      count={a.count}
                    />
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onGeneratePoster({ kind: 'association', id: a.id })}
                        aria-label={t.generatePoster}
                        title={t.generatePoster}
                        data-testid={`generate-poster-${a.id}`}
                        style={posterButtonStyle}
                      >
                        <Camera size={15} />
                      </button>
                    )}
                  </div>
                  {isOpen(a.id) &&
                    (a.venues.length === 0 ? <div style={emptyStyle}>{t.associationEmpty}</div> : rows(a.venues))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
};
