import { theme } from '../../theme';
import {
  POSTER_SIZE, POSTER_LAYOUT, chromeLayoutFor,
  type ChromeLayoutConstants,
  type ChromePosition, type ChromeSize, type ChromeStyle, type QrCorner,
} from './posterLayout';
import {
  layoutPinLabels, LABEL_FONT,
  type LabelRect, type PinLabelInput,
} from './posterLabels';

export type { PinLabelInput };

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

const TRANSLATE3D_RE = /translate3d\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px/;
const SCALE_RE = /scale\((-?\d+(?:\.\d+)?)\)/;

// Reads each tile's translate3d(...) offset — composed with its tile container's own
// translate3d + scale(...) transform, which Leaflet uses at fractional zoom levels (the tile
// pane is CSS-scaled from the nearest integer zoom) — into coordinates directly comparable to
// map.latLngToContainerPoint()'s pin coordinates. That only holds because the capture map in
// cantonPoster.ts sets its view exactly once with no prior setView/pan/zoom and
// fadeAnimation: false — so the tile layer and the pin projection share the same origin. If the
// capture map's setup ever gains an initial view or an animated transition before the final
// view, this alignment can silently break.
export const extractTileDraws = (tilePane: HTMLElement): TileDraw[] => {
  const imgs = tilePane.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded');
  const tiles: TileDraw[] = [];
  imgs.forEach((img) => {
    const match = img.style.transform.match(TRANSLATE3D_RE);
    if (!match) return;

    let containerX = 0;
    let containerY = 0;
    let scale = 1;
    const container = img.closest<HTMLElement>('.leaflet-tile-container');
    if (container) {
      const cMatch = container.style.transform.match(TRANSLATE3D_RE);
      if (cMatch) {
        containerX = parseFloat(cMatch[1]);
        containerY = parseFloat(cMatch[2]);
      }
      const sMatch = container.style.transform.match(SCALE_RE);
      if (sMatch) scale = parseFloat(sMatch[1]);
    }

    const size = (img.width || 256) * scale;
    tiles.push({
      img,
      x: containerX + parseFloat(match[1]) * scale,
      y: containerY + parseFloat(match[2]) * scale,
      size,
    });
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

// Where the QR code sits, given the corner the admin picked and how much of that edge the chrome
// bands already take. drawPosterOverlay draws the code from this, and labelObstacles keeps the
// venue labels off it, so the two can never disagree about where the code ended up.
export const qrRect = (
  corner: QrCorner,
  chrome: ChromeLayoutResult,
  chromeLayout: ChromeLayoutConstants,
  posterHeight: number,
): LabelRect => {
  const isTop = corner.startsWith('top');
  const isLeft = corner.endsWith('left');
  // chrome.bottomOccupied already includes the minimal attribution strip when the footer is off.
  const occupied = isTop ? chrome.topOccupied : chrome.bottomOccupied;
  return {
    x: isLeft ? chromeLayout.qrMargin : POSTER_SIZE - chromeLayout.qrSize - chromeLayout.qrMargin,
    y: isTop
      ? occupied + chromeLayout.qrMargin
      : posterHeight - occupied - chromeLayout.qrSize - chromeLayout.qrMargin,
    w: chromeLayout.qrSize,
    h: chromeLayout.qrSize,
  };
};

// The regions venue labels must keep clear. Derived from topOccupied/bottomOccupied rather than
// from the individual bands, so it stays correct for every header/footer arrangement — stacked on
// one edge, hidden, compact — plus the attribution strip, all of which those two totals encode.
export const labelObstacles = (
  chrome: ChromeLayoutResult,
  posterHeight: number,
  qr: LabelRect | null,
): LabelRect[] => {
  const rects: LabelRect[] = [];
  if (chrome.topOccupied > 0) rects.push({ x: 0, y: 0, w: POSTER_SIZE, h: chrome.topOccupied });
  if (chrome.bottomOccupied > 0) {
    rects.push({
      x: 0, y: posterHeight - chrome.bottomOccupied, w: POSTER_SIZE, h: chrome.bottomOccupied,
    });
  }
  if (qr) rects.push(qr);
  return rects;
};

export interface DrawPinLabelsOptions {
  posterHeight: number;
  obstacles: LabelRect[];
}

// Venue names wear the brand colour, the same pill as the header's count badge, so a pin and its
// name read as one badge and the count reads as their legend. Deliberately independent of the
// chrome style: the fill is fully opaque, so no map or satellite tile shows through behind a name,
// where the chrome's translucent dark plate nearly vanished over Esri imagery. Being
// style-independent also removes the exception the transparent style used to need, since that
// style has no fill of its own to borrow.
export const LABEL_COLORS = { fill: theme.color.accent, text: theme.color.accentInk } as const;

// Venue names beside their pins, in the same fill and ink as the chrome bands.
export const drawPinLabels = (
  ctx: CanvasRenderingContext2D,
  pins: PinLabelInput[],
  { posterHeight, obstacles }: DrawPinLabelsOptions,
): void => {
  ctx.font = LABEL_FONT;
  const placed = layoutPinLabels(pins, (s) => ctx.measureText(s).width, { posterHeight, obstacles });

  placed.forEach((label) => {
    ctx.fillStyle = LABEL_COLORS.fill;
    ctx.beginPath();
    ctx.roundRect(label.x, label.y, label.w, label.h, L.labelH / 2);
    ctx.fill();
    ctx.fillStyle = LABEL_COLORS.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label.text, label.x + L.labelPadX, label.y + label.h / 2);
  });
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
    ctx.fillStyle = LABEL_COLORS.text;
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
    const { x: qrX, y: qrY } = qrRect(qrCorner, chrome, CL, posterHeight);
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
    ctx.fillStyle = LABEL_COLORS.text;
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
    ctx.fillStyle = LABEL_COLORS.text;
    ctx.font = `400 ${L.attribFont}px 'Work Sans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(attribution, POSTER_SIZE - L.attribMarginX, posterHeight - L.minAttribStripH / 2);
    ctx.textAlign = 'left';
  }
};
