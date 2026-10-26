import { useId, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { RegionalBadge } from '../associations/AssociationMark';
import { useAssociations } from '../associations/useAssociations';
import { visuallyHidden } from './listStyles';
import { scopeLabel } from './scopeLabel';
import type { ScopeBoard, ScopeCount } from './scopeOptions';

export interface ScopeChipsProps {
  board: ScopeBoard;
  // Null while the approved scopes load, so no chip claims a Verband has no editors yet.
  counts: ((id: string) => ScopeCount) | null;
  // '' while nothing is picked.
  value: string;
  onChange: (id: string) => void;
  labelledBy: string;
}

const boardStyle: CSSProperties = {
  display: 'grid', gap: '14px', padding: '12px', border: '1px solid ' + theme.color.line,
  borderRadius: theme.radius.sm, maxHeight: 'min(360px, 50dvh)', overflowY: 'auto',
};
const fieldsetStyle: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const legendStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: 0, marginBottom: '7px',
  fontSize: '13px', fontWeight: 600, color: theme.color.ink,
};
const chipsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px' };
const chipStyle = (checked: boolean, whole: boolean): CSSProperties => ({
  position: 'relative', display: 'inline-flex', alignItems: 'baseline', gap: '6px', padding: '5px 11px',
  border: '1.5px solid ' + (checked ? theme.color.accent : theme.color.line), borderRadius: theme.radius.pill,
  background: checked ? theme.color.accent : theme.color.bg, color: checked ? theme.color.accentInk : theme.color.ink,
  fontSize: '13px', fontWeight: whole ? 600 : 400, lineHeight: 1.25, cursor: 'pointer',
});
const countStyle = (checked: boolean): CSSProperties => ({
  fontSize: '11px', fontWeight: 400, fontVariantNumeric: 'tabular-nums',
  color: checked ? theme.color.accentInk : theme.color.muted,
});
const belowStyle: CSSProperties = { marginLeft: 'auto', fontSize: '12px', fontWeight: 400, color: theme.color.muted };

// Picks one node of the Verband tree. Every node is a native radio drawn as a chip, all in one
// group: Tab lands on the checked chip and the arrow keys walk the board. Each Teilverband is a
// fieldset, so a screen reader names the block before its Verbände.
export const ScopeChips = ({ board, counts, value, onChange, labelledBy }: ScopeChipsProps) => {
  const { t } = useTranslation();
  const a = useAssociations();
  const name = useId();
  const fill = (template: string, n: number) => template.replace('{n}', String(n));

  const chip = (id: string, label: ReactNode, whole: boolean) => {
    const checked = value === id;
    const c = counts?.(id);
    const visibleCount = c && (c.below === null || !whole ? `${c.direct}` : `${c.direct} · ${fill(t.scopeBelow, c.below)}`);
    return (
      <label key={id} className="scope-chip" style={chipStyle(checked, whole)}>
        <input
          type="radio"
          name={name}
          value={id}
          checked={checked}
          onChange={() => onChange(id)}
          style={visuallyHidden}
        />
        <span>{label}</span>
        {c && (
          <>
            <span aria-hidden="true" style={countStyle(checked)}>{visibleCount}</span>
            <span style={visuallyHidden}>
              {`, ${fill(t.scopeEditors, c.direct)}${c.below === null ? '' : `, ${fill(t.scopeBelow, c.below)}`}`}
            </span>
          </>
        )}
      </label>
    );
  };

  const top = board.top ? a.byId.get(board.top) : undefined;
  return (
    <>
      <div role="radiogroup" aria-labelledby={labelledBy} style={boardStyle}>
        {top && (
          <div style={chipsStyle}>
            {top.level === 'federation'
              ? chip(top.id, <><b>{a.shortOf(top.id)}</b> · {t.scopeWholeCountry}</>, true)
              : chip(top.id, a.nameOf(top.id), true)}
          </div>
        )}
        {board.blocks.map((block) => {
          const node = a.byId.get(block.regional);
          const below = counts?.(block.regional).below;
          return (
            <fieldset key={block.regional} style={fieldsetStyle}>
              <legend style={legendStyle}>
                {node?.level === 'regional' && <RegionalBadge id={node.id} />}
                <span>{a.nameOf(block.regional)}</span>
                {below != null && <span aria-hidden="true" style={belowStyle}>{fill(t.scopeBelow, below)}</span>}
              </legend>
              <div style={chipsStyle}>
                {block.regionalPickable && chip(block.regional, t.scopeWholeRegional, true)}
                {block.children.map((id) => chip(id, a.nameOf(id), false))}
              </div>
            </fieldset>
          );
        })}
      </div>
      {value && (
        <div style={{ marginTop: '10px', fontSize: '13px', color: theme.color.muted, overflowWrap: 'anywhere' }}>
          {`${t.accountsScope}: ${scopeLabel(a, t, value)}`}
        </div>
      )}
    </>
  );
};
