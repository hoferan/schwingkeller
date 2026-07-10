import { cantonByCode } from '../data/cantons';

// The seam for the future ?venue= permalink (see issue #10): once it
// exists, its parsing should run first and take precedence over ?ctn=
// when both are present, since a venue is more specific than a canton.
export const parseCantonParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('ctn');
  if (!raw) return null;
  const code = raw.toUpperCase();
  return cantonByCode(code) ? code : null;
};
