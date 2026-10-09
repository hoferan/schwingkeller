import type { Venue } from './types';
import { boundsForCanton, type CantonBounds } from '../../data/cantonBounds';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { ASSOCIATION_HOME_BOUNDS } from '../../data/associationBounds';
import { REGIONAL_TINTS, tintOf } from '../../data/associationTints';
import type { Associations } from '../associations/useAssociations';
import { withAssociationParam, withCantonParam } from '../../lib/permalink';

export class PosterGenerationError extends Error {}

// What sits in the header's left slot: a canton's coat of arms, or a Verband's dot with its
// Teilverband's badge.
export type PosterMark =
  | { kind: 'arms'; url: string }
  | { kind: 'association'; tint: string; badge: { text: string; colour: string } };

// Everything on a poster that depends on what the poster is of. The generator, the overlay and the
// editor read only this, so canton and Verband posters go through the same code.
export interface PosterSubject {
  id: string; // in the filename
  name: string; // the default title
  venues: Venue[]; // the pins, already filtered
  homeBounds: CantonBounds; // the framing when there are no venues
  mark: PosterMark;
  count: number | null; // null draws no count pill
  permalink: (url: string) => string; // the QR code's target
}

export type PosterTarget = { kind: 'canton'; code: string } | { kind: 'association'; id: string };

export const cantonPosterSubject = (code: string, venues: Venue[]): PosterSubject => {
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }
  const own = venues.filter((v) => v.canton === code);
  return {
    id: code,
    name: canton.name,
    venues: own,
    homeBounds: bounds,
    mark: { kind: 'arms', url: wappenUrl(code) },
    count: own.length,
    permalink: (url) => withCantonParam(url, code),
  };
};

// A Verband's poster carries no count: posters hang for months, and a printed number goes stale
// with the first venue added or closed, while the pins already show the venues.
export const associationPosterSubject = (
  id: string,
  venues: Venue[],
  associations: Associations,
): PosterSubject => {
  const node = associations.byId.get(id);
  const regional = associations.regionalOf(id);
  if (node?.level !== 'cantonal' || !regional) {
    throw new PosterGenerationError(`[UNKNOWN_ASSOCIATION] No Verband ${id}.`);
  }
  const cantonal = node.id;
  const regionalId = regional.id;
  return {
    id: cantonal,
    name: associations.nameOf(cantonal),
    venues: venues.filter((v) => v.association_id === cantonal),
    homeBounds: ASSOCIATION_HOME_BOUNDS[cantonal],
    mark: {
      kind: 'association',
      tint: tintOf(cantonal),
      badge: { text: associations.shortOf(regionalId) ?? '', colour: REGIONAL_TINTS[regionalId] },
    },
    count: null,
    permalink: (url) => withAssociationParam(url, cantonal),
  };
};

export const posterSubjectFor = (
  target: PosterTarget,
  venues: Venue[],
  associations: Associations,
): PosterSubject =>
  target.kind === 'canton'
    ? cantonPosterSubject(target.code, venues)
    : associationPosterSubject(target.id, venues, associations);
