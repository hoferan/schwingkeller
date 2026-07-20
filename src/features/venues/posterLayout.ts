// Single source of truth for the canton poster's overlay geometry, in POSTER_SIZE (1080-space)
// pixels. Consumed by BOTH the canvas exporter (posterCanvas.drawPosterOverlay, which draws in
// absolute px) and the editor's DOM preview (PosterEditorModal, via `cqw()` = percent of the
// preview square's width). Sharing one set of numbers makes the on-screen preview an exact scaled
// replica of the exported PNG — change a value here and both move together.

export const POSTER_SIZE = 1080;

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
