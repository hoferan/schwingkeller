import { theme } from '../../theme';
import { POSTER_SIZE, POSTER_LAYOUT } from './posterLayout';

export { POSTER_SIZE };

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
  title?: string;
  wappenImg: HTMLImageElement | null;
  count: number;
  unitLabel: string;
  attribution: string;
  showHeader?: boolean;
  showFooter?: boolean;
  qrImg?: HTMLImageElement | null;
}

const APP_NAME = 'Schwingkeller Schweiz';
const L = POSTER_LAYOUT;

export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution,
    showHeader = true, showFooter = true, qrImg,
  } = opts;

  if (showHeader) {
    ctx.fillStyle = 'rgba(17,17,17,0.72)';
    ctx.fillRect(0, 0, POSTER_SIZE, L.headerH);

    let textX = L.padX;
    if (wappenImg) {
      ctx.drawImage(wappenImg, L.wappenX, L.wappenY, L.wappenW, L.wappenH);
      textX = L.padX + L.wappenW + L.wappenGap;
    }

    ctx.fillStyle = theme.color.bg;
    ctx.font = `700 ${L.titleFont}px Oswald, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText((title || cantonName).toUpperCase(), textX, L.titleBaselineY);

    const pillText = `${count} ${unitLabel}`;
    ctx.font = `700 ${L.pillFont}px Oswald, sans-serif`;
    const pillWidth = ctx.measureText(pillText).width + L.pillPadX * 2;
    ctx.fillStyle = theme.color.accent;
    ctx.beginPath();
    ctx.roundRect(textX, L.pillY, pillWidth, L.pillH, L.pillH / 2);
    ctx.fill();
    ctx.fillStyle = theme.color.accentInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, textX + L.pillPadX, L.pillY + L.pillH / 2 + 1);
  }

  // QR sits bottom-right, inset above the footer band area.
  if (qrImg) {
    const qrX = POSTER_SIZE - L.qrSize - L.qrMargin;
    const qrY = POSTER_SIZE - L.qrSize - L.qrMargin - L.footerH;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - L.qrPad, qrY - L.qrPad, L.qrSize + L.qrPad * 2, L.qrSize + L.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, L.qrSize, L.qrSize);
  }

  if (showFooter) {
    ctx.fillStyle = 'rgba(17,17,17,0.72)';
    ctx.fillRect(0, POSTER_SIZE - L.footerH, POSTER_SIZE, L.footerH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `600 ${L.appNameFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(APP_NAME, L.appNameX, POSTER_SIZE - L.footerH / 2);
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, POSTER_SIZE - L.footerH / 2);
    ctx.textAlign = 'left';
  } else {
    // Attribution is legally required even without the branding band — draw a
    // minimal credit with a subtle backing strip for legibility.
    ctx.fillStyle = 'rgba(17,17,17,0.55)';
    ctx.fillRect(0, POSTER_SIZE - L.minAttribStripH, POSTER_SIZE, L.minAttribStripH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, POSTER_SIZE - L.minAttribStripH / 2);
    ctx.textAlign = 'left';
  }
};
