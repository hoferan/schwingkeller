import L from 'leaflet';
import type { Venue } from './types';
import { boundsForCanton } from '../../data/cantonBounds';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { createTileLayer, TILE_ATTRIBUTION, type BaseKind } from '../map/tileLayers';
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage,
  extractTileDraws, drawTiles, drawPin, drawPosterOverlay,
} from './posterCanvas';

export class PosterGenerationError extends Error {}

const TILE_LOAD_TIMEOUT_MS = 8000;

export interface OnceEmitter { once: (event: 'load', handler: () => void) => void }

export const waitForTilesLoad = (layer: OnceEmitter, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new PosterGenerationError('[TILE_TIMEOUT] Tiles took too long to load.')),
      timeoutMs,
    );
    layer.once('load', () => {
      window.clearTimeout(timer);
      resolve();
    });
  });

export interface GeneratePosterResult { blob: Blob; filename: string }

export const generateCantonPosterBlob = async (
  code: string,
  venues: Venue[],
  baseKind: BaseKind,
  unitLabel: string,
): Promise<GeneratePosterResult> => {
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }

  const container = createOffscreenContainer(POSTER_SIZE);
  const map = L.map(container, { attributionControl: false, zoomControl: false, fadeAnimation: false });

  try {
    const tileLayer = createTileLayer(baseKind);
    tileLayer.addTo(map);
    map.fitBounds(bounds, { padding: [40, 40] });
    await waitForTilesLoad(tileLayer, TILE_LOAD_TIMEOUT_MS);

    const wappenImg = await loadImage(wappenUrl(code), 'anonymous');
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    const canvas = document.createElement('canvas');
    canvas.width = POSTER_SIZE;
    canvas.height = POSTER_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PosterGenerationError('[NO_CANVAS_CONTEXT] Canvas 2D context unavailable.');

    const tilePane = map.getPane('tilePane');
    if (tilePane) drawTiles(ctx, extractTileDraws(tilePane));

    const cantonVenues = venues.filter((v) => v.canton === code);
    cantonVenues.forEach((v) => {
      const point = map.latLngToContainerPoint([v.lat, v.lng]);
      drawPin(ctx, point.x, point.y);
    });

    drawPosterOverlay(ctx, {
      cantonName: canton.name,
      wappenImg,
      count: cantonVenues.length,
      unitLabel,
      attribution: TILE_ATTRIBUTION[baseKind],
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new PosterGenerationError('[NO_BLOB] Could not encode the poster image.');

    return { blob, filename: posterFilename(code) };
  } finally {
    map.remove();
    container.remove();
  }
};
