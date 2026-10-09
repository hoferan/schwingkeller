export const theme = {
  color: {
    bg: '#ffffff',
    ink: '#111111',
    paper: '#f2f2f2',
    accent: '#e30613',
    accentInk: '#ffffff',
    line: '#e2e2e2',
    muted: '#6b6b6b',
  },
  font: {
    display: "'Oswald', sans-serif",
    body: "'Work Sans', sans-serif",
  },
  radius: {
    sm: '10px',
    pill: '999px',
  },
  shadow: '0 4px 16px rgba(0,0,0,.12)',
  // A hairline around a coat of arms, so arms with a white field (FR, ZH, LU) keep their edge on white.
  armsOutline: 'drop-shadow(0 0 0.75px rgba(0,0,0,.55))',
  // Map pin shadows, drawn as CSS filters on the pin SVG: the disc's soft lift (theme.shadow in
  // filter form), the selected teardrop's closer shadow, and the spot of shade under its tip.
  pinShadow: {
    disc: 'drop-shadow(0 4px 8px rgba(0,0,0,.12))',
    teardrop: 'drop-shadow(0 2px 2.5px rgba(0,0,0,.35))',
    ground: 'rgba(0,0,0,.28)',
  },
} as const;
