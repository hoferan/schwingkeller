// Venue-name pin labels for the canton poster: where each name sits relative to its pin, in
// POSTER_SIZE (1080-space) px. The placement rule itself is shared with the map's names
// (src/lib/labelPlacement.ts); this file gives it the poster's sizes. Pure geometry — no canvas, no
// DOM — so the canvas exporter
// (posterCanvas.drawPinLabels) and the editor's live DOM preview (PosterEditorModal) place labels
// identically from one source of truth, the same way posterLayout/computeChromeLayout already do.
// Callers measure the text themselves and pass the width in, which is what keeps this file free of
// any rendering dependency.

import { POSTER_SIZE, POSTER_LAYOUT } from './posterLayout';
import { placeLabels, type LabelPin, type LabelRect, type LabelSlot, type PlacedLabel } from '../../lib/labelPlacement';

const L = POSTER_LAYOUT;

export type { LabelPin, LabelRect, LabelSlot, PlacedLabel };

export interface PlacePinLabelsOptions {
  posterWidth: number;
  posterHeight: number;
  // Regions the labels must keep clear: the header/footer bands and the QR code. Callers build
  // these from computeChromeLayout so a label can never slide under the chrome.
  obstacles?: LabelRect[];
}

// The poster's sizes for the shared placement rule in src/lib/labelPlacement.ts.
const POSTER_METRICS = { pinRadius: L.pinRadius, gap: L.labelGap, labelH: L.labelH, padX: L.labelPadX };

export const placePinLabels = (
  pins: LabelPin[],
  { posterWidth, posterHeight, obstacles = [] }: PlacePinLabelsOptions,
): PlacedLabel[] => placeLabels(pins, POSTER_METRICS, { width: posterWidth, height: posterHeight, obstacles });

const ELLIPSIS = '…';

// Clamps one name to a width budget, returning the text to draw and its measured width — exactly
// the shape a LabelPin needs. `measure` is the caller's own text measurement (a canvas 2D context
// in both renderers), so a name is shortened identically in the preview and in the export.
export const ellipsizeLabel = (
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
): { text: string; width: number } => {
  const full = measure(text);
  if (full <= maxWidth) return { text, width: full };

  for (let end = text.length - 1; end > 0; end -= 1) {
    const candidate = text.slice(0, end) + ELLIPSIS;
    const width = measure(candidate);
    if (width <= maxWidth) return { text: candidate, width };
  }
  return { text: ELLIPSIS, width: measure(ELLIPSIS) };
};

// The one font string both renderers measure and draw with, so a name's width — and therefore
// where its pill lands — is identical in the preview and in the exported PNG.
export const LABEL_FONT = `600 ${L.labelFont}px Oswald, sans-serif`;

export interface PinLabelInput { x: number; y: number; text: string }

export interface LayoutPinLabelsOptions {
  posterHeight: number;
  obstacles: LabelRect[];
}

// Takes pins in 1080-space coordinates and returns their placed pills: clamp each name to the
// width budget, then place it. Names keep the casing they are stored with. Capitals would eat the
// budget and truncate sooner, lowercase shapes read better at labelFont size, and names like
// "Eidg." carry casing worth keeping. Callers supply `measure` — a canvas 2D context in both
// renderers. Poster width is always POSTER_SIZE, so only the height varies with the format.
export const layoutPinLabels = (
  pins: PinLabelInput[],
  measure: (s: string) => number,
  { posterHeight, obstacles }: LayoutPinLabelsOptions,
): PlacedLabel[] => {
  const measured = pins.map(({ x, y, text }) => {
    const clamped = ellipsizeLabel(text, measure, L.labelMaxTextW);
    return { x, y, text: clamped.text, width: clamped.width };
  });
  return placePinLabels(measured, { posterWidth: POSTER_SIZE, posterHeight, obstacles });
};
