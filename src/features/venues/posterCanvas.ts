import { theme } from '../../theme';
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor, type ChromePosition, type ChromeSize,
} from './posterLayout';

export { POSTER_SIZE };

const L = POSTER_LAYOUT;

export const posterFilename = (code: string): string => `schwingkeller-${code.toLowerCase()}.png`;

export const createOffscreenContainer = (width: number, height: number): HTMLDivElement => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
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

export const drawPin = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.beginPath();
  ctx.arc(x, y, L.pinRadius, 0, Math.PI * 2);
  ctx.fillStyle = theme.color.accent;
  ctx.fill();
  ctx.lineWidth = L.pinRing;
  ctx.strokeStyle = theme.color.bg;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, L.pinRadius * L.pinDotRatio, 0, Math.PI * 2);
  ctx.fillStyle = theme.color.bg;
  ctx.fill();
};

export interface ChromeLayoutResult {
  headerY: number | null;
  footerY: number | null;
  topOccupied: number;
  bottomOccupied: number;
}

export interface ChromeLayoutOptions {
  showHeader: boolean;
  showFooter: boolean;
  headerPosition: ChromePosition;
  footerPosition: ChromePosition;
  chromeSize: ChromeSize;
  posterHeight: number;
}

// Header and footer each independently sit on the top or bottom edge; when both land on the same
// edge they stack rather than overlap, with header always closer to the edge and footer stacked
// adjacent to it. Pure geometry — no canvas/DOM access — so both the capture (drawPosterOverlay)
// and the live DOM preview can share one source of truth for where each band actually is.
export const computeChromeLayout = (opts: ChromeLayoutOptions): ChromeLayoutResult => {
  const { showHeader, showFooter, headerPosition, footerPosition, chromeSize, posterHeight } = opts;
  const CL = chromeLayoutFor(chromeSize);

  let headerY: number | null = null;
  let footerY: number | null = null;
  let topOccupied = 0;
  let bottomOccupied = 0;

  if (showHeader && headerPosition === 'top') {
    headerY = topOccupied;
    topOccupied += CL.headerH;
  }
  if (showFooter && footerPosition === 'top') {
    footerY = topOccupied;
    topOccupied += CL.footerH;
  }
  if (showHeader && headerPosition === 'bottom') {
    bottomOccupied += CL.headerH;
    headerY = posterHeight - bottomOccupied;
  }
  if (showFooter && footerPosition === 'bottom') {
    bottomOccupied += CL.footerH;
    footerY = posterHeight - bottomOccupied;
  }

  return { headerY, footerY, topOccupied, bottomOccupied };
};

export interface PosterOverlayOptions {
  cantonName: string;
  title?: string;
  wappenImg: HTMLImageElement | null;
  count: number;
  unitLabel: string;
  attribution: string;
  posterHeight: number;
  showHeader?: boolean;
  showFooter?: boolean;
  qrImg?: HTMLImageElement | null;
}

const APP_NAME = 'Schwingkeller Schweiz';

export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution, posterHeight,
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
    const qrY = posterHeight - L.qrSize - L.qrMargin - L.footerH;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - L.qrPad, qrY - L.qrPad, L.qrSize + L.qrPad * 2, L.qrSize + L.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, L.qrSize, L.qrSize);
  }

  if (showFooter) {
    ctx.fillStyle = 'rgba(17,17,17,0.72)';
    ctx.fillRect(0, posterHeight - L.footerH, POSTER_SIZE, L.footerH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `600 ${L.appNameFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(APP_NAME, L.appNameX, posterHeight - L.footerH / 2);
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, posterHeight - L.footerH / 2);
    ctx.textAlign = 'left';
  } else {
    // Attribution is legally required even without the branding band — draw a
    // minimal credit with a subtle backing strip for legibility.
    ctx.fillStyle = 'rgba(17,17,17,0.55)';
    ctx.fillRect(0, posterHeight - L.minAttribStripH, POSTER_SIZE, L.minAttribStripH);
    ctx.fillStyle = theme.color.bg;
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, posterHeight - L.minAttribStripH / 2);
    ctx.textAlign = 'left';
  }
};
