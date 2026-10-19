import type { CSSProperties } from 'react';
import { theme } from '../../theme';

export const inputStyle: CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
export const labelStyle: CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};
export const secondaryButtonStyle: CSSProperties = {
  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
};
export const primaryButtonStyle: CSSProperties = {
  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
  fontWeight: 700, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
};
export const linkButtonStyle: CSSProperties = {
  border: 'none', background: 'none', padding: 0, color: theme.color.ink, fontSize: '12.5px',
  textDecoration: 'underline', cursor: 'pointer',
};
