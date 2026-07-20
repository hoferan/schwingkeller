import L from 'leaflet';

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

export const createTileLayer = (kind: BaseKind): L.TileLayer =>
  L.tileLayer(TILE_URLS[kind], { attribution: TILE_ATTRIBUTION[kind], maxZoom: TILE_MAX_ZOOM[kind] });
