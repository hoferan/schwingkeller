import type { CSSProperties } from 'react';
import { theme } from '../../theme';

// Shared by the account list and the invitation list.
export const cell: CSSProperties = { padding: '10px 12px', borderBottom: '1px solid ' + theme.color.line, verticalAlign: 'top' };
export const head: CSSProperties = {
  ...cell, textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
  color: theme.color.muted,
};
// Delete gets the red outline of the venue delete button.
export const actionStyle = (kind: 'primary' | 'plain' | 'danger', busy: boolean): CSSProperties => ({
  border: kind === 'primary' ? 'none' : '1.5px solid ' + (kind === 'danger' ? theme.color.accent : theme.color.line),
  background: kind === 'primary' ? theme.color.accent : 'transparent',
  color: kind === 'primary' ? theme.color.accentInk : kind === 'danger' ? theme.color.accent : theme.color.ink,
  fontWeight: 600, fontSize: '13px', padding: '7px 12px', borderRadius: theme.radius.sm,
  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap',
});

// The round count on the tab and on the top-bar button.
export const badgeStyle: CSSProperties = {
  minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: theme.radius.pill,
  background: theme.color.accent, color: theme.color.accentInk, fontSize: '11px', fontWeight: 700,
  lineHeight: '18px', textAlign: 'center', boxSizing: 'border-box',
};
// What a screen reader says for the number in the badge. `template` is t.accountsPendingCount.
export const pendingCountText = (template: string, n: number) => template.replace('{n}', String(n));

// Read by screen readers, not shown.
export const visuallyHidden: CSSProperties = {
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
};
