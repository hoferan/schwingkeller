// Single source of truth for the canton poster's overlay geometry, in POSTER_SIZE (1080-space)
// pixels. Consumed by BOTH the canvas exporter (posterCanvas.drawPosterOverlay, which draws in
// absolute px) and the editor's DOM preview (PosterEditorModal, via `cqw()` = percent of the
// preview square's width). Sharing one set of numbers makes the on-screen preview an exact scaled
// replica of the exported PNG — change a value here and both move together.

export const POSTER_SIZE = 1080;

export type PosterAspectRatio = 'square' | 'portrait';

export const posterHeightFor = (ratio: PosterAspectRatio): number =>
  ratio === 'portrait' ? POSTER_SIZE * 1.5 : POSTER_SIZE; // 1620 : 1080 — exactly 2:3

export const POSTER_LAYOUT = {
  headerH: 190, // top branding band height
  footerH: 46, // bottom branding band height
  minAttribStripH: 26, // attribution-only strip when the footer is hidden
  padX: 40, // left inset of the header content
  wappenX: 40,
  wappenY: 55,
  wappenW: 64,
  wappenH: 80,
  wappenGap: 24, // gap between the wappen and the title/pill column
  titleGap: 10, // vertical gap between title and count pill
  titleFont: 56,
  titleBaselineY: 110, // canvas text baseline (canvas-only)
  pillFont: 24,
  pillPadX: 18,
  pillH: 40,
  pillY: 130, // canvas pill top (canvas-only)
  appNameFont: 20,
  appNameX: 24,
  attribFont: 14,
  attribMarginX: 24,
  qrSize: 150,
  qrMargin: 28,
  qrPad: 8, // white backing inset around the QR
  pinRadius: 16, // venue pin (canvas drawPin)
  pinRing: 5,
  pinDotRatio: 0.32, // inner white dot radius = pinRadius * this
} as const;

export type ChromePosition = 'top' | 'bottom';
export type ChromeStyle = 'solid' | 'transparent' | 'light';
export type ChromeSize = 'normal' | 'compact';
export type QrCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// The chrome-only subset of POSTER_LAYOUT (everything except venue-pin geometry, which never
// scales with the admin's header/footer size choice).
export interface ChromeLayoutConstants {
  headerH: number; footerH: number; minAttribStripH: number; padX: number;
  wappenX: number; wappenY: number; wappenW: number; wappenH: number; wappenGap: number;
  titleGap: number; titleFont: number; titleBaselineY: number;
  pillFont: number; pillPadX: number; pillH: number; pillY: number;
  appNameFont: number; appNameX: number; attribFont: number; attribMarginX: number;
  qrSize: number; qrMargin: number; qrPad: number;
}

const CHROME_KEYS: (keyof ChromeLayoutConstants)[] = [
  'headerH', 'footerH', 'minAttribStripH', 'padX', 'wappenX', 'wappenY', 'wappenW', 'wappenH',
  'wappenGap', 'titleGap', 'titleFont', 'titleBaselineY', 'pillFont', 'pillPadX', 'pillH', 'pillY',
  'appNameFont', 'appNameX', 'attribFont', 'attribMarginX', 'qrSize', 'qrMargin', 'qrPad',
];

const CHROME_LAYOUT_NORMAL: ChromeLayoutConstants = CHROME_KEYS.reduce((acc, key) => {
  acc[key] = POSTER_LAYOUT[key];
  return acc;
}, {} as ChromeLayoutConstants);

// "Compact" reduces the bands' footprint without scaling any content: fonts, pill, Wappen, and QR
// keep their normal size (scaling them down made the chrome illegible — smoke-test finding); only
// the band heights and the vertical anchors inside them change. The count pill moves inline next
// to the canton name (drawPosterOverlay/preview branch on chromeSize for that), which is what
// lets the header drop to Wappen height + inset.
const CHROME_LAYOUT_COMPACT: ChromeLayoutConstants = {
  ...CHROME_LAYOUT_NORMAL,
  headerH: 120, // wappenH (80) + 2 * wappenY inset
  wappenY: 20, // centers the full-size 80px Wappen in the 120px band
  titleBaselineY: 80, // 56px title optically centered in the 120px band
  pillY: 40, // (headerH - pillH) / 2 — pill vertically centered, inline after the title
  footerH: 34, // just enough for the 20px app name / 14px attribution line
};

export const chromeLayoutFor = (size: ChromeSize): ChromeLayoutConstants =>
  size === 'compact' ? CHROME_LAYOUT_COMPACT : CHROME_LAYOUT_NORMAL;

// Convert a 1080-space px measurement into a container-query-width unit for the DOM preview, so the
// preview chrome scales with the (square) preview container to match the export exactly.
export const cqw = (px: number): string => `${(px / POSTER_SIZE) * 100}cqw`;

// Venue-pin dimensions (px) for the DOM preview at a given square size — scaled from the same
// canvas geometry (drawPin) so the preview pins match the exported pins proportionally.
export const previewPin = (size: number) => {
  const k = size / POSTER_SIZE;
  return {
    d: POSTER_LAYOUT.pinRadius * 2 * k,
    ring: POSTER_LAYOUT.pinRing * k,
    dot: POSTER_LAYOUT.pinRadius * 2 * POSTER_LAYOUT.pinDotRatio * k,
  };
};
