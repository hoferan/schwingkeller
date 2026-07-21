import { theme } from '../../theme';
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor,
  type ChromePosition, type ChromeSize, type ChromeStyle, type QrCorner,
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
// edge they stack rather than overlap, and the footer always reads BELOW the header: on the top
// edge the header takes the edge with the footer under it, on the bottom edge the footer takes
// the edge with the header above it. Pure geometry — no canvas/DOM access — so both the capture
// (drawPosterOverlay) and the live DOM preview share one source of truth for where each band is.
export const computeChromeLayout = (opts: ChromeLayoutOptions): ChromeLayoutResult => {
  const { showHeader, showFooter, headerPosition, footerPosition, chromeSize, posterHeight } = opts;
  const CL = chromeLayoutFor(chromeSize);

  let headerY: number | null = null;
  let footerY: number | null = null;
  let topOccupied = 0;
  // When the footer band is hidden, the always-on minimal attribution strip owns the bottom edge
  // (at its fixed normal size) — bottom-positioned bands stack above it, and QR/padding consumers
  // of bottomOccupied clear it automatically.
  let bottomOccupied = showFooter ? 0 : POSTER_LAYOUT.minAttribStripH;

  if (showHeader && headerPosition === 'top') {
    headerY = topOccupied;
    topOccupied += CL.headerH;
  }
  if (showFooter && footerPosition === 'top') {
    footerY = topOccupied;
    topOccupied += CL.footerH;
  }
  if (showFooter && footerPosition === 'bottom') {
    bottomOccupied += CL.footerH;
    footerY = posterHeight - bottomOccupied;
  }
  if (showHeader && headerPosition === 'bottom') {
    bottomOccupied += CL.headerH;
    headerY = posterHeight - bottomOccupied;
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
  headerPosition?: ChromePosition;
  footerPosition?: ChromePosition;
  chromeStyle?: ChromeStyle;
  chromeSize?: ChromeSize;
  qrCorner?: QrCorner;
}

// Transparent is plain dark ink over the bare map — light text washed out on bright tiles, and a
// halo/glow shadow made it mushy (both smoke-test findings), so no shadow of any kind.
export const CHROME_STYLE_COLORS: Record<ChromeStyle, { fill: string | null; text: string }> = {
  solid: { fill: 'rgba(17,17,17,0.72)', text: theme.color.bg },
  transparent: { fill: null, text: theme.color.ink },
  light: { fill: 'rgba(255,255,255,0.85)', text: theme.color.ink },
};

const APP_NAME = 'Schwingkeller Schweiz';

export const drawPosterOverlay = (ctx: CanvasRenderingContext2D, opts: PosterOverlayOptions): void => {
  const {
    cantonName, title, wappenImg, count, unitLabel, attribution, posterHeight, qrImg,
    showHeader = true, showFooter = true,
    headerPosition = 'top', footerPosition = 'bottom',
    chromeStyle = 'solid', chromeSize = 'normal', qrCorner = 'bottom-right',
  } = opts;

  const CL = chromeLayoutFor(chromeSize);
  const colors = CHROME_STYLE_COLORS[chromeStyle];
  const chrome = computeChromeLayout({
    showHeader, showFooter, headerPosition, footerPosition, chromeSize, posterHeight,
  });

  if (showHeader && chrome.headerY !== null) {
    const y = chrome.headerY;
    if (colors.fill) {
      ctx.fillStyle = colors.fill;
      ctx.fillRect(0, y, POSTER_SIZE, CL.headerH);
    }

    let textX = CL.padX;
    if (wappenImg) {
      ctx.drawImage(wappenImg, CL.wappenX, y + CL.wappenY, CL.wappenW, CL.wappenH);
      textX = CL.padX + CL.wappenW + CL.wappenGap;
    }

    const titleText = (title || cantonName).toUpperCase();
    ctx.fillStyle = colors.text;
    ctx.font = `700 ${CL.titleFont}px Oswald, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(titleText, textX, y + CL.titleBaselineY);
    // Compact: the pill sits inline after the title (the band is too short to stack them).
    const titleWidth = chromeSize === 'compact' ? ctx.measureText(titleText).width : 0;
    const pillX = chromeSize === 'compact' ? textX + titleWidth + CL.pillPadX : textX;

    const pillText = `${count} ${unitLabel}`;
    ctx.font = `700 ${CL.pillFont}px Oswald, sans-serif`;
    const pillWidth = ctx.measureText(pillText).width + CL.pillPadX * 2;
    ctx.fillStyle = theme.color.accent;
    ctx.beginPath();
    ctx.roundRect(pillX, y + CL.pillY, pillWidth, CL.pillH, CL.pillH / 2);
    ctx.fill();
    ctx.fillStyle = theme.color.accentInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, pillX + CL.pillPadX, y + CL.pillY + CL.pillH / 2 + 1);
  }

  if (qrImg) {
    const isTop = qrCorner.startsWith('top');
    const isLeft = qrCorner.endsWith('left');
    // chrome.bottomOccupied already includes the minimal attribution strip when the footer is off.
    const occupied = isTop ? chrome.topOccupied : chrome.bottomOccupied;
    const qrX = isLeft ? CL.qrMargin : POSTER_SIZE - CL.qrSize - CL.qrMargin;
    const qrY = isTop ? occupied + CL.qrMargin : posterHeight - occupied - CL.qrSize - CL.qrMargin;
    ctx.fillStyle = theme.color.bg;
    ctx.fillRect(qrX - CL.qrPad, qrY - CL.qrPad, CL.qrSize + CL.qrPad * 2, CL.qrSize + CL.qrPad * 2);
    ctx.drawImage(qrImg, qrX, qrY, CL.qrSize, CL.qrSize);
  }

  if (showFooter && chrome.footerY !== null) {
    const y = chrome.footerY;
    if (colors.fill) {
      ctx.fillStyle = colors.fill;
      ctx.fillRect(0, y, POSTER_SIZE, CL.footerH);
    }
    ctx.fillStyle = colors.text;
    ctx.font = `600 ${CL.appNameFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(APP_NAME, CL.appNameX, y + CL.footerH / 2);
    ctx.font = `400 ${CL.attribFont}px 'Work Sans', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - CL.attribMarginX, y + CL.footerH / 2);
    ctx.textAlign = 'left';
  } else {
    // Attribution is legally required even without the branding band — draw a minimal credit
    // strip. Always at the bottom, at NORMAL size (uses `L`, not `CL`) and unaffected by
    // footerPosition/chromeSize, so hiding the footer's content can never relocate the
    // legally-required attribution somewhere unexpected — but it follows the selected chrome
    // STYLE (fill + text color) so it doesn't clash with the bands (smoke-test finding).
    if (colors.fill) {
      ctx.fillStyle = colors.fill;
      ctx.fillRect(0, posterHeight - L.minAttribStripH, POSTER_SIZE, L.minAttribStripH);
    }
    ctx.fillStyle = colors.text;
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, posterHeight - L.minAttribStripH / 2);
    ctx.textAlign = 'left';
  }
};
