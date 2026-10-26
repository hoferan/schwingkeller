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
