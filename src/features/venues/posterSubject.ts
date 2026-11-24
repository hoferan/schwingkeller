import type { Venue } from './types';
import type { CantonBounds } from '../../data/cantonBounds';
import { ASSOCIATION_HOME_BOUNDS } from '../../data/associationBounds';
import { REGIONAL_TINTS, tintOf } from '../../data/associationTints';
import type { Associations } from '../associations/useAssociations';
import { withAssociationParam } from '../../lib/permalink';
import type { PosterMark } from './posterCanvas';

export class PosterGenerationError extends Error {}

// Everything on a poster that depends on which Verband it shows. The generator, the overlay and the
// editor read only this.
export interface PosterSubject {
  id: string; // in the filename
  name: string; // the default title
  venues: Venue[]; // the pins, already filtered
  homeBounds: CantonBounds; // the framing when there are no venues
  mark: PosterMark;
  permalink: (url: string) => string; // the QR code's target
}

// A poster carries no count: posters hang for months, and a printed number goes stale with the
// first venue added or closed, while the pins already show the venues.
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
      tint: tintOf(cantonal),
      badge: { text: associations.shortOf(regionalId) ?? '', colour: REGIONAL_TINTS[regionalId] },
    },
    permalink: (url) => withAssociationParam(url, cantonal),
  };
};
