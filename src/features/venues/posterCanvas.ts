import { theme } from '../../theme';

export const POSTER_SIZE = 1080;

export const posterFilename = (code: string): string => `schwingkeller-${code.toLowerCase()}.png`;

export const createOffscreenContainer = (size: number = POSTER_SIZE): HTMLDivElement => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  document.body.appendChild(el);
  return el;
};

export const loadImage = (src: string, crossOrigin?: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

export interface TileDraw { img: HTMLImageElement; x: number; y: number; size: number }

// Reads each tile's own translate3d(...) offset and treats it as directly comparable to
// map.latLngToContainerPoint()'s pin coordinates. That only holds because the capture map in
// cantonPoster.ts calls fitBounds exactly once with no prior setView/pan/zoom and
// fadeAnimation: false — so the tile layer and the pin projection share the same origin. If the
// capture map's setup ever gains an initial view or an animated transition before fitBounds,
// this alignment can silently break.
export const extractTileDraws = (tilePane: HTMLElement): TileDraw[] => {
  const imgs = tilePane.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded');
  const tiles: TileDraw[] = [];
  imgs.forEach((img) => {
    const match = img.style.transform.match(/translate3d\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px/);
    if (!match) return;
    const size = img.width || 256;
    tiles.push({ img, x: parseFloat(match[1]), y: parseFloat(match[2]), size });
  });
  return tiles;
};

export const drawTiles = (ctx: CanvasRenderingContext2D, tiles: TileDraw[]): void => {
  tiles.forEach(({ img, x, y, size }) => ctx.drawImage(img, x, y, size, size));
};

const PIN_RADIUS = 16;
const PIN_RING = 5;

export const drawPin = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.beginPath();
  ctx.arc(x, y, PIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = theme.color.accent;
  ctx.fill();
  ctx.lineWidth = PIN_RING;
  ctx.strokeStyle = theme.color.bg;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, PIN_RADIUS * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = theme.color.bg;
  ctx.fill();
};

export interface PosterOverlayOptions {
  cantonName: string;
  wappenImg: HTMLImageElement | null;
  count: number;
  unitLabel: string;
  attribution: string;
}

const OVERLAY_PANEL_HEIGHT = 190;
const FOOTER_HEIGHT = 46;
const APP_NAME = 'Schwingkeller Schweiz';

export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const { cantonName, wappenImg, count, unitLabel, attribution } = opts;

  ctx.fillStyle = 'rgba(17,17,17,0.72)';
  ctx.fillRect(0, 0, POSTER_SIZE, OVERLAY_PANEL_HEIGHT);

  let textX = 40;
  if (wappenImg) {
    const wappenW = 64;
    const wappenH = 80;
    ctx.drawImage(wappenImg, 40, 55, wappenW, wappenH);
    textX = 40 + wappenW + 24;
  }

  ctx.fillStyle = theme.color.bg;
  ctx.font = "700 56px Oswald, sans-serif";
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(cantonName.toUpperCase(), textX, 110);

  const pillText = `${count} ${unitLabel}`;
  ctx.font = "700 24px Oswald, sans-serif";
  const pillPaddingX = 18;
  const pillWidth = ctx.measureText(pillText).width + pillPaddingX * 2;
  const pillHeight = 40;
  const pillY = 130;
  ctx.fillStyle = theme.color.accent;
  ctx.beginPath();
  ctx.roundRect(textX, pillY, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.fillStyle = theme.color.accentInk;
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, textX + pillPaddingX, pillY + pillHeight / 2 + 1);

  ctx.fillStyle = 'rgba(17,17,17,0.72)';
  ctx.fillRect(0, POSTER_SIZE - FOOTER_HEIGHT, POSTER_SIZE, FOOTER_HEIGHT);
  ctx.fillStyle = theme.color.bg;
  ctx.font = "600 20px 'Work Sans', sans-serif";
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(APP_NAME, 24, POSTER_SIZE - FOOTER_HEIGHT / 2);
  ctx.font = "400 14px 'Work Sans', sans-serif";
  ctx.textAlign = 'right';
  ctx.fillText(attribution, POSTER_SIZE - 24, POSTER_SIZE - FOOTER_HEIGHT / 2);
  ctx.textAlign = 'left';
};
