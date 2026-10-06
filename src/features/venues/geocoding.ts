import { cantonFromGeo } from '../../data/plzRanges';

const HEADERS = {
  'Accept-Language': 'de',
  'User-Agent': 'Schwingkeller-Schweiz/1.0 (https://github.com/hoferan/schwingkeller)',
};

export interface ForwardResult { lat: number; lng: number; canton: string | null }

export const forwardGeocode = async (query: string): Promise<ForwardResult | null> => {
  const q = String(query ?? '').trim();
  if (q.length < 6) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch&addressdetails=1&q=${encodeURIComponent(q)}`,
      { headers: HEADERS },
    );
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr.length) return null;
    const d = arr[0];
    const lat = +parseFloat(d.lat).toFixed(5);
    const lng = +parseFloat(d.lon).toFixed(5);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat, lng, canton: cantonFromGeo(d.address) };
  } catch { return null; }
};
