import L from 'leaflet';
import { TILE_URLS, TILE_MAX_ZOOM, TILE_ATTRIBUTION, type BaseKind } from './tileSources';

export { TILE_URLS, TILE_MAX_ZOOM, TILE_ATTRIBUTION };
export type { BaseKind };

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
