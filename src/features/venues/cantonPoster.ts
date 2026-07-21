import L from 'leaflet';
import type { Venue } from './types';
import { boundsForCanton } from '../../data/cantonBounds';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { createTileLayer, TILE_ATTRIBUTION, type BaseKind } from '../map/tileLayers';
import {
  POSTER_SIZE, posterFilename, createOffscreenContainer, loadImage,
  extractTileDraws, drawTiles, drawPin, drawPosterOverlay,
} from './posterCanvas';
import {
  posterHeightFor,
  type PosterAspectRatio, type ChromePosition, type ChromeStyle, type ChromeSize, type QrCorner,
} from './posterLayout';

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

export interface PosterView { center: [number, number]; zoom: number }

export interface GeneratePosterOptions {
  baseKind: BaseKind;
  // Exact framing from the editor: `center` is the preview map's center and `zoom` is already
  // scaled up by log2(POSTER_SIZE / previewWidthPx), so this larger canvas covers the identical
  // ground area the preview showed. Falls back to the canton's default bounds when absent.
  view?: PosterView;
  unitLabel: string;
  title?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  qrDataUrl?: string | null;
  aspectRatio?: PosterAspectRatio; // defaults to 'square', matching today's output
  headerPosition?: ChromePosition;
  footerPosition?: ChromePosition;
  chromeStyle?: ChromeStyle;
  chromeSize?: ChromeSize;
  qrCorner?: QrCorner;
}

export const generateCantonPosterBlob = async (
  code: string,
  venues: Venue[],
  options: GeneratePosterOptions,
): Promise<GeneratePosterResult> => {
  const {
    baseKind, view, unitLabel, title, showHeader, showFooter, qrDataUrl,
    aspectRatio = 'square',
    headerPosition, footerPosition, chromeStyle, chromeSize, qrCorner,
  } = options;
  const canton = cantonByCode(code);
  const bounds = boundsForCanton(code);
  if (!canton || !bounds) {
    throw new PosterGenerationError(`[UNKNOWN_CANTON] No data for canton ${code}.`);
  }
  const posterHeight = posterHeightFor(aspectRatio);

  const container = createOffscreenContainer(POSTER_SIZE, posterHeight);
  // Integer zoom only: the editor passes an integer `view.zoom` (previewZoom + log2(1080/previewSize),
  // and previewSize is a power-of-2 fraction of 1080). A fractional zoom would make Leaflet CSS-scale
  // the tile pane, which the tile-capture below cannot reproduce (misframed export + missing tiles).
  const map = L.map(container, { attributionControl: false, zoomControl: false, fadeAnimation: false });

  try {
    const tileLayer = createTileLayer(baseKind, 'anonymous');
    tileLayer.addTo(map);
    if (view) {
      map.setView(view.center, view.zoom);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    await waitForTilesLoad(tileLayer, TILE_LOAD_TIMEOUT_MS);

    const wappenImg = await loadImage(wappenUrl(code), 'anonymous');
    const qrImg = qrDataUrl ? await loadImage(qrDataUrl) : null;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    const canvas = document.createElement('canvas');
    canvas.width = POSTER_SIZE;
    canvas.height = posterHeight;
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
      title,
      wappenImg,
      count: cantonVenues.length,
      unitLabel,
      attribution: TILE_ATTRIBUTION[baseKind],
      posterHeight,
      showHeader,
      showFooter,
      qrImg,
      headerPosition,
      footerPosition,
      chromeStyle,
      chromeSize,
      qrCorner,
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new PosterGenerationError('[NO_BLOB] Could not encode the poster image.');

    return { blob, filename: posterFilename(code) };
  } finally {
    map.remove();
    container.remove();
  }
};
