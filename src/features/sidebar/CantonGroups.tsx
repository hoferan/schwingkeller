import { ChevronRight, Camera } from 'lucide-react';
import type { Venue } from '../venues/types';
import type { PosterTarget } from '../venues/posterSubject';
import { groupByCanton } from '../venues/grouping';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { CantonArms, RowChevron, VenueRow } from './VenueRow';

interface CantonGroupsProps {
  list: Venue[];
  filtering: boolean;
  isAdmin: boolean;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGeneratePoster: (target: PosterTarget) => void;
}

// The sidebar grouped by canton, shown while the verband flag is off. Removed in #72.
export const CantonGroups = ({
  list,
  filtering,
  isAdmin,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  onGeneratePoster,
}: CantonGroupsProps) => {
  const { t } = useTranslation();
  const groups = groupByCanton(list, !filtering);
  return (
    <>
      {groups.map((group) => {
        const exp = filtering || !!expanded[group.code];
        return (
          <div key={group.code} style={{ borderBottom: '1px solid ' + theme.color.line }}>
            <div
              onClick={() => onToggle(group.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '13px 2px',
                cursor: 'pointer',
              }}
            >
              <CantonArms code={group.code} size="header" />
              <span
                style={{
                  fontFamily: theme.font.display,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: theme.color.ink,
                  fontSize: '15.5px',
                  flex: 1,
                }}
              >
                {group.name}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: theme.color.accentInk,
                  background: theme.color.ink,
                  padding: '2px 9px',
                  borderRadius: theme.radius.pill,
                }}
              >
                {group.count}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onGeneratePoster({ kind: 'canton', code: group.code }); }}
                  aria-label={t.generatePoster}
                  title={t.generatePoster}
                  // Every canton row renders this same button under the same label, so the code
                  // is the only thing that tells them apart from outside the component.
                  data-testid={`generate-poster-${group.code}`}
                  style={{
                    width: '26px', height: '26px', border: 'none', background: 'transparent',
                    color: theme.color.ink, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  }}
                >
                  <Camera size={15} />
                </button>
              )}
              <span style={{ color: theme.color.ink, width: '12px', display: 'flex', justifyContent: 'center' }}>
                <ChevronRight
                  size={12}
                  style={{ transform: exp ? 'rotate(90deg)' : 'none', transition: 'transform .2s ease' }}
                />
              </span>
            </div>
            {exp && (
              <div style={{ padding: '1px 0 9px' }}>
                {group.venues.length === 0 ? (
                  <div
                    style={{
                      padding: '10px 12px 14px',
                      color: theme.color.muted,
                      fontSize: '12.5px',
                      lineHeight: 1.5,
                    }}
                  >
                    {t.cantonEmpty}
                  </div>
                ) : (
                  group.venues.map((v) => (
                    <VenueRow
                      key={v.id}
                      venue={v}
                      selected={v.id === selectedId}
                      onSelect={onSelect}
                      trailing={<RowChevron selected={v.id === selectedId} />}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
