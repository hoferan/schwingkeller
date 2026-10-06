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
  // One of the 29 cantonal associations, or null until it has one. The edit form starts sending it
  // in #66, so VenueInput leaves it out until then.
  association_id: string | null;
}

export type VenueInput = Omit<Venue, 'id' | 'photos' | 'association_id'>;
