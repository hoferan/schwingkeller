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

// `crossOrigin` is only needed when the tiles will be drawn onto a canvas for export (the canton
// poster capture): without it the tile <img>s are fetched non-CORS and taint the canvas, so
// canvas.toBlob() throws a SecurityError. The live map leaves it unset — it never exports.
export const createTileLayer = (
  kind: BaseKind,
  crossOrigin?: L.TileLayerOptions['crossOrigin'],
): L.TileLayer =>
  L.tileLayer(TILE_URLS[kind], {
    attribution: TILE_ATTRIBUTION[kind],
    maxZoom: TILE_MAX_ZOOM[kind],
    ...(crossOrigin ? { crossOrigin } : {}),
  });
