// Which tile providers the map uses, kept in its own module with no Leaflet import so it can be
// read from plain Node. Leaflet touches `window` when it loads, so a Playwright fixture that
// imported tileLayers.ts to learn these origins would crash before it ran a single test.
// tileLayers.ts re-exports everything here, so callers can keep importing from either.

export type BaseKind = 'map' | 'sat';

export const TILE_URLS: Record<BaseKind, string> = {
  map: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  sat: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export const TILE_MAX_ZOOM: Record<BaseKind, number> = { map: 19, sat: 18 };

export const TILE_ATTRIBUTION: Record<BaseKind, string> = {
  map: '© OpenStreetMap contributors',
  sat: '© Esri, Maxar, Earthstar Geographics',
};
