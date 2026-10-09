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

export type VenueInput = Omit<Venue, 'id' | 'photos'>;
