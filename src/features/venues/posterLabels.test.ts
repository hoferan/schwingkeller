import { describe, it, expect } from 'vitest';
import { POSTER_LAYOUT } from './posterLayout';
import { placePinLabels, ellipsizeLabel, type LabelPin } from './posterLabels';

const PADDED = POSTER_LAYOUT.labelPadX * 2;
const OFFSET = POSTER_LAYOUT.pinRadius + POSTER_LAYOUT.labelGap;

const square = { posterWidth: 1080, posterHeight: 1080 };
const pin = (x: number, y: number, text = 'MARLY', width = 100): LabelPin => ({ x, y, text, width });

describe('placePinLabels', () => {
  it('places a lone label to the right of its pin, vertically centered on it', () => {
    const [label] = placePinLabels([pin(200, 300)], square);

    expect(label.slot).toBe('right');
    expect(label.x).toBe(200 + OFFSET);
    expect(label.y).toBe(300 - POSTER_LAYOUT.labelH / 2);
    expect(label.w).toBe(100 + PADDED);
    expect(label.h).toBe(POSTER_LAYOUT.labelH);
    expect(label.text).toBe('MARLY');
  });

  it('returns one entry per pin when nothing collides', () => {
    const labels = placePinLabels([pin(100, 100, 'A'), pin(100, 500, 'B'), pin(100, 900, 'C')], square);

    expect(labels.map((l) => l.text)).toEqual(['A', 'B', 'C']);
    expect(labels.every((l) => l.slot === 'right')).toBe(true);
  });

  // The four slots are tried right -> left -> above -> below. Each case below blocks exactly one
  // more slot than the previous one, so the pin is forced one step further down that order.
  it('falls back to the left when the right slot hits a placed label', () => {
    const labels = placePinLabels([pin(600, 300, 'RIGHTMOST'), pin(500, 300, 'CROWDED')], square);

    expect(labels[1].slot).toBe('left');
    expect(labels[1].x + labels[1].w).toBe(500 - OFFSET);
    expect(labels[1].y).toBe(300 - POSTER_LAYOUT.labelH / 2);
  });

  it('falls back to above when both side slots are taken', () => {
    const labels = placePinLabels(
      [pin(600, 300, 'RIGHTMOST'), pin(200, 300, 'WIDE_TO_THE_LEFT', 200), pin(500, 300, 'CROWDED')],
      square,
    );

    expect(labels[2].slot).toBe('above');
    expect(labels[2].x).toBe(500 - labels[2].w / 2);
    expect(labels[2].y + labels[2].h).toBe(300 - OFFSET);
  });

  it('falls back to below when the sides and the space above are all taken', () => {
    const labels = placePinLabels(
      [
        pin(600, 300, 'RIGHTMOST'),
        pin(200, 300, 'WIDE_TO_THE_LEFT', 200),
        pin(500, 240, 'JUST_ABOVE'),
        pin(500, 300, 'CROWDED'),
      ],
      square,
    );

    expect(labels[3].slot).toBe('below');
    expect(labels[3].x).toBe(500 - labels[3].w / 2);
    expect(labels[3].y).toBe(300 + OFFSET);
  });

  it('drops the label when no slot fits, keeping the pins that do', () => {
    const labels = placePinLabels([pin(540, 540, 'FITS'), pin(540, 540, 'FAR_TOO_WIDE', 2000)], square);

    expect(labels.map((l) => l.text)).toEqual(['FITS']);
  });

  it('is deterministic — the same pins always place identically', () => {
    const pins = [pin(600, 300, 'A'), pin(200, 300, 'B', 200), pin(500, 300, 'C')];

    expect(placePinLabels(pins, square)).toEqual(placePinLabels(pins, square));
  });

  it('keeps out of an obstacle such as the header band', () => {
    const header = { x: 0, y: 0, w: 1080, h: 190 };
    const [label] = placePinLabels([pin(200, 200)], { ...square, obstacles: [header] });

    expect(label.slot).toBe('below');
    expect(label.y).toBeGreaterThanOrEqual(header.h);
  });

  // A whole canton's worth of pins at once: the invariant that matters on a real poster is that
  // nothing the placer emits ever sits on top of anything else.
  it('places a dense canton without a single overlap', () => {
    const cluster: LabelPin[] = [
      pin(430, 470, 'FRIBOURG ET ENVIRONS', 300), pin(360, 250, 'MURTEN', 120),
      pin(300, 700, 'BULLE', 100), pin(470, 540, 'MARLY', 95),
      pin(560, 530, 'SCHMITTEN', 160), pin(250, 420, 'PAYERNE', 130),
      pin(120, 800, 'CHATEL', 110), pin(340, 690, 'ROMONT', 120),
      pin(600, 260, 'KERZERS', 120),
    ];
    const header = { x: 0, y: 0, w: 1080, h: 190 };

    const labels = placePinLabels(cluster, { ...square, obstacles: [header] });
    const pinBoxes = cluster.map((p) => ({
      x: p.x - POSTER_LAYOUT.pinRadius, y: p.y - POSTER_LAYOUT.pinRadius,
      w: POSTER_LAYOUT.pinRadius * 2, h: POSTER_LAYOUT.pinRadius * 2,
    }));
    const hits = (a: typeof header, b: typeof header) =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label, i) => {
      expect(hits(label, header)).toBe(false);
      pinBoxes.forEach((box) => expect(hits(label, box)).toBe(false));
      labels.slice(i + 1).forEach((other) => expect(hits(label, other)).toBe(false));
      expect(label.x).toBeGreaterThanOrEqual(0);
      expect(label.x + label.w).toBeLessThanOrEqual(square.posterWidth);
      expect(label.y + label.h).toBeLessThanOrEqual(square.posterHeight);
    });
  });

  it('never runs a label off the poster edge', () => {
    const [label] = placePinLabels([pin(1060, 500)], square);

    expect(label.slot).toBe('left');
    expect(label.x).toBeGreaterThanOrEqual(0);
    expect(label.x + label.w).toBeLessThanOrEqual(square.posterWidth);
  });
});

// One character per unit keeps the arithmetic obvious: the measured width IS the character count.
const measureByChar = (s: string) => s.length;

describe('ellipsizeLabel', () => {
  it('leaves a name that already fits untouched', () => {
    expect(ellipsizeLabel('MARLY', measureByChar, 10)).toEqual({ text: 'MARLY', width: 5 });
  });

  it('shortens an over-long name to an ellipsis inside the budget', () => {
    const { text, width } = ellipsizeLabel('FRIBOURG ET ENVIRONS', measureByChar, 10);

    expect(text).toBe('FRIBOURG …');
    expect(width).toBeLessThanOrEqual(10);
  });

  it('falls back to the ellipsis alone when even one character will not fit', () => {
    expect(ellipsizeLabel('MARLY', measureByChar, 1)).toEqual({ text: '…', width: 1 });
  });
});
