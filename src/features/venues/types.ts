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
  photo_url: string | null;
}

export type VenueInput = Omit<Venue, 'id'>;
