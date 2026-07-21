import { cantonByCode } from '../data/cantons';

// ?venue= takes precedence over ?ctn= when both are present — see
// parseVenueParam below and
// docs/superpowers/specs/2026-07-10-venue-permalink-share-design.md.
export const parseCantonParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('ctn');
  if (!raw) return null;
  const code = raw.toUpperCase();
  return cantonByCode(code) ? code : null;
};

// Existence of the id against real venues can only be checked once the
// (async) venue list has loaded — this just extracts the raw id.
export const parseVenueParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('venue');
  return raw ? raw : null;
};

// Builds the next pathname+search for history.replaceState. Always drops
// `ctn` since a venue permalink supersedes a canton one once the app is
// being interacted with; sets or clears `venue` based on `id`.
export const withVenueParam = (url: string, id: string | null): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('ctn');
  if (id) {
    params.set('venue', id);
  } else {
    params.delete('venue');
  }
  const next = params.toString();
  return next ? path + '?' + next : path;
};

// Inverse of withVenueParam: sets ?ctn=<code> (uppercased) and clears any
// `venue` param. Used to build the poster QR link back to the canton view.
export const withCantonParam = (url: string, code: string): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('venue');
  params.set('ctn', code.toUpperCase());
  const next = params.toString();
  return next ? path + '?' + next : path;
};
