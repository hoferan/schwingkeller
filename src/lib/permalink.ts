import { cantonByCode } from '../data/cantons';
import { ASSOCIATIONS, HOME_AREAS } from '../data/associations';

// The app reads three URL parameters once at startup (docs/adr/0007-url-parameters-without-a-router.md):
//
// - ?venue=<id> opens that venue. When it is present, the other two are ignored, even if the id
//   turns out not to exist.
// - ?vb=<id> opens a Teilverband or Verband and frames its venues. It needs the verband flag.
// - ?ctn=XX opens a canton and frames its bounds. With the verband flag on, the canton is mapped to
//   a Verband through the home areas instead (associationForCanton), and ?vb= wins when both are
//   valid. Printed posters carry ?ctn= links, so the parameter stays.
//
// Once the app is in use, only the open venue is written back (withVenueParam).

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

// A Teilverband or Verband id. The federation would only show the whole map, so it is ignored like
// an unknown id.
export const parseAssociationParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('vb');
  if (!raw) return null;
  const id = raw.toLowerCase();
  const node = ASSOCIATIONS.find((a) => a.id === id);
  return node && node.level !== 'federation' ? node.id : null;
};

// Where an old ?ctn= link lands with the verband flag on. A canton that is home to one Verband goes
// to it, AR and AI to appenzell, OW and NW to ob-nidwalden. Bern is home to several Gaue and the
// canton doesn't say which, so it goes to their Teilverband.
export const associationForCanton = (code: string): string | null => {
  const ids = [...new Set(HOME_AREAS.filter((h) => h.canton === code).map((h) => h.associationId))];
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];
  return ASSOCIATIONS.find((a) => a.id === ids[0])?.parentId ?? null;
};

// Builds the next pathname+search for history.replaceState. Always drops
// `ctn` and `vb` since a venue permalink supersedes them once the app is
// being interacted with; sets or clears `venue` based on `id`.
export const withVenueParam = (url: string, id: string | null): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('ctn');
  params.delete('vb');
  if (id) {
    params.set('venue', id);
  } else {
    params.delete('venue');
  }
  const next = params.toString();
  return next ? path + '?' + next : path;
};

// Inverse of withVenueParam: sets ?ctn=<code> (uppercased) and clears any
// `venue` or `vb` param. Used to build the poster QR link back to the canton view.
export const withCantonParam = (url: string, code: string): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('venue');
  params.delete('vb');
  params.set('ctn', code.toUpperCase());
  const next = params.toString();
  return next ? path + '?' + next : path;
};

// Sets ?vb=<id> (lowercased) and clears `venue` and `ctn`. Used to build the poster QR link to a
// Verband.
export const withAssociationParam = (url: string, id: string): string => {
  const [path, search = ''] = url.split('?');
  const params = new URLSearchParams(search);
  params.delete('venue');
  params.delete('ctn');
  params.set('vb', id.toLowerCase());
  const next = params.toString();
  return next ? path + '?' + next : path;
};
