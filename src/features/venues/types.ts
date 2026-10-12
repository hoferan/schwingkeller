import type { CantonalId } from '../../data/associations';

export interface VenuePhoto {
  id: string;
  url: string;
  position: number;
}

export interface Venue {
  id: string;
  name: string;
  canton: string;
  address: string;
  lat: number;
  lng: number;
  // Still a column, but the app neither shows nor edits it: every venue has a room inside. Only
  // `outdoor`, a place outside as well, is shown.
  indoor: boolean;
  outdoor: boolean;
  person: string;
  phone: string;
  website: string;
  photos: VenuePhoto[];
  // One of the 29 cantonal associations. The database requires it (0010), and its foreign key and
  // level trigger, checked against this tree by the parity test, keep any other id out.
  association_id: CantonalId;
}

// Leaves `indoor` out, so a new venue gets the column's default and an edit leaves it as it is.
export type VenueInput = Omit<Venue, 'id' | 'photos' | 'indoor'>;
