import type { Venue } from '../venues/types';

// A canton poster prints every venue of the canton, whatever Verband it belongs to. The editor
// may print it only when they can edit all of those venues. A canton without venues has no
// Verband to check, so only a super-admin gets the button.
export const canPrintCantonPoster = (
  venues: Venue[],
  code: string,
  canEdit: (associationId: string) => boolean,
  isSuperAdmin: boolean,
): boolean => {
  const inCanton = venues.filter((venue) => venue.canton === code);
  if (inCanton.length === 0) return isSuperAdmin;
  return inCanton.every((venue) => canEdit(venue.association_id));
};
