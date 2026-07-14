export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371; // Earth radius in km
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export const haversineKm = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatDistance = (km: number, locale: string): string => {
  const swiss: Record<string, string> = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH' };
  const loc = swiss[locale] ?? locale;
  if (km < 1) {
    const m = Math.round((km * 1000) / 10) * 10;
    return `${new Intl.NumberFormat(loc).format(m)} m`;
  }
  if (km < 100) {
    const n = new Intl.NumberFormat(loc, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(km);
    return `${n} km`;
  }
  return `${new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(km)} km`;
};

export const sortByDistance = <T extends LatLng>(items: T[], origin: LatLng): T[] =>
  [...items].sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b));
