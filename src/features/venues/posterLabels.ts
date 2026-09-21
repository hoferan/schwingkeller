// Venue-name pin labels for the canton poster: where each name sits relative to its pin, in
// POSTER_SIZE (1080-space) px. Pure geometry — no canvas, no DOM — so the canvas exporter
// (posterCanvas.drawPinLabels) and the editor's live DOM preview (PosterEditorModal) place labels
// identically from one source of truth, the same way posterLayout/computeChromeLayout already do.
// Callers measure the text themselves and pass the width in, which is what keeps this file free of
// any rendering dependency.

import { POSTER_SIZE, POSTER_LAYOUT } from './posterLayout';

const L = POSTER_LAYOUT;

export interface LabelPin {
  x: number;
  y: number;
  text: string;
  width: number; // measured text width in 1080-space px
}

export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LabelSlot = 'right' | 'left' | 'above' | 'below';

export interface PlacedLabel extends LabelRect {
  text: string;
  slot: LabelSlot;
}

export interface PlacePinLabelsOptions {
  posterWidth: number;
  posterHeight: number;
  // Regions the labels must keep clear: the header/footer bands and the QR code. Callers build
  // these from computeChromeLayout so a label can never slide under the chrome.
  obstacles?: LabelRect[];
}

// Tried in this order; the first slot that clears everything wins.
const SLOT_ORDER: readonly LabelSlot[] = ['right', 'left', 'above', 'below'];

const OFFSET = L.pinRadius + L.labelGap; // pin centre to the near edge of the pill

const slotRect = (pin: LabelPin, w: number, h: number, slot: LabelSlot): LabelRect => {
  switch (slot) {
    case 'right':
      return { x: pin.x + OFFSET, y: pin.y - h / 2, w, h };
    case 'left':
      return { x: pin.x - OFFSET - w, y: pin.y - h / 2, w, h };
    case 'above':
      return { x: pin.x - w / 2, y: pin.y - OFFSET - h, w, h };
    case 'below':
      return { x: pin.x - w / 2, y: pin.y + OFFSET, w, h };
  }
};

const overlaps = (a: LabelRect, b: LabelRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const insidePoster = (r: LabelRect, width: number, height: number): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height;

// A pin's own footprint, so a label never covers a neighboring pin. Every slot already clears its
// own pin by labelGap, so pins need no special-casing here.
const pinRect = (pin: LabelPin): LabelRect => ({
  x: pin.x - L.pinRadius,
  y: pin.y - L.pinRadius,
  w: L.pinRadius * 2,
  h: L.pinRadius * 2,
});

// Places as many names as fit, in the order given — earlier pins get first pick of the slots. A pin
// whose four slots are all blocked is left out of the result rather than labelled on top of
// something else, so the caller draws that pin bare. Same pins in, same boxes out.
export const placePinLabels = (
  pins: LabelPin[],
  { posterWidth, posterHeight, obstacles = [] }: PlacePinLabelsOptions,
): PlacedLabel[] => {
  const blocked: LabelRect[] = [...obstacles, ...pins.map(pinRect)];
  const placed: PlacedLabel[] = [];

  pins.forEach((pin) => {
    const w = pin.width + L.labelPadX * 2;
    const slot = SLOT_ORDER.find((candidate) => {
      const rect = slotRect(pin, w, L.labelH, candidate);
      return insidePoster(rect, posterWidth, posterHeight) && !blocked.some((b) => overlaps(rect, b));
    });
    if (!slot) return;

    const rect = slotRect(pin, w, L.labelH, slot);
    placed.push({ ...rect, text: pin.text, slot });
    blocked.push(rect);
  });

  return placed;
};

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

// Takes pins in 1080-space coordinates and returns their placed pills: uppercase each name, clamp
// it to the width budget, then place it. Callers supply `measure` — a canvas 2D context in both
// renderers. Poster width is always POSTER_SIZE, so only the height varies with the format.
export const layoutPinLabels = (
  pins: PinLabelInput[],
  measure: (s: string) => number,
  { posterHeight, obstacles }: LayoutPinLabelsOptions,
): PlacedLabel[] => {
  const measured = pins.map(({ x, y, text }) => {
    const clamped = ellipsizeLabel(text.toUpperCase(), measure, L.labelMaxTextW);
    return { x, y, text: clamped.text, width: clamped.width };
  });
  return placePinLabels(measured, { posterWidth: POSTER_SIZE, posterHeight, obstacles });
};
