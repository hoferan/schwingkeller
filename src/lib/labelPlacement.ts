// Where a name sits next to its pin, so that no two names overlap and none covers a pin. Pure
// geometry in the caller's pixels: the poster passes its 1080-space sizes, the map its screen
// sizes. Callers measure the text themselves and pass the width in.

export interface LabelPin {
  x: number;
  y: number;
  text: string;
  width: number; // measured text width
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

// The pin's radius, the gap between pin and label, the label's height and its padding left and
// right of the text.
export interface LabelMetrics {
  pinRadius: number;
  gap: number;
  labelH: number;
  padX: number;
}

// The labels stay inside width × height and clear of the obstacles.
export interface LabelArea {
  width: number;
  height: number;
  obstacles?: LabelRect[];
}

// Tried in this order; the first slot that clears everything wins.
const SLOT_ORDER: readonly LabelSlot[] = ['right', 'left', 'above', 'below'];

const slotRect = (pin: LabelPin, w: number, h: number, offset: number, slot: LabelSlot): LabelRect => {
  switch (slot) {
    case 'right':
      return { x: pin.x + offset, y: pin.y - h / 2, w, h };
    case 'left':
      return { x: pin.x - offset - w, y: pin.y - h / 2, w, h };
    case 'above':
      return { x: pin.x - w / 2, y: pin.y - offset - h, w, h };
    case 'below':
      return { x: pin.x - w / 2, y: pin.y + offset, w, h };
  }
};

const overlaps = (a: LabelRect, b: LabelRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const inside = (r: LabelRect, width: number, height: number): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height;

// A pin's own footprint, so a label never covers a neighbouring pin. Every slot already clears its
// own pin by the gap, so pins need no special-casing here.
const pinRect = (pin: LabelPin, r: number): LabelRect => ({ x: pin.x - r, y: pin.y - r, w: r * 2, h: r * 2 });

// Places as many labels as fit, in the order given: earlier pins get first pick of the slots. A pin
// whose four slots are all blocked is left out of the result rather than labelled on top of
// something else, so the caller draws that pin bare. Same pins in, same boxes out.
export const placeLabels = (
  pins: LabelPin[],
  { pinRadius, gap, labelH, padX }: LabelMetrics,
  { width, height, obstacles = [] }: LabelArea,
): PlacedLabel[] => {
  const offset = pinRadius + gap; // pin centre to the near edge of the label
  const blocked: LabelRect[] = [...obstacles, ...pins.map((p) => pinRect(p, pinRadius))];
  const placed: PlacedLabel[] = [];

  pins.forEach((pin) => {
    const w = pin.width + padX * 2;
    const slot = SLOT_ORDER.find((candidate) => {
      const rect = slotRect(pin, w, labelH, offset, candidate);
      return inside(rect, width, height) && !blocked.some((b) => overlaps(rect, b));
    });
    if (!slot) return;

    const rect = slotRect(pin, w, labelH, offset, slot);
    placed.push({ ...rect, text: pin.text, slot });
    blocked.push(rect);
  });

  return placed;
};
