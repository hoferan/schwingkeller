// Venue names on the map: the chip a hovered pin shows, the list a hovered cluster shows, and the
// names written next to lone pins once the map is zoomed in far enough. MapView wires these to
// Leaflet; this file holds the parts that need no map.
import { placeLabelsFor, type LabelMetrics, type LabelRect, type PlacedLabel } from '../../lib/labelPlacement';
import { ellipsizeLabel } from '../venues/posterLabels';

// From this zoom on, lone pins carry their names.
export const NAME_ZOOM = 12;

// A name next to a pin, in screen pixels: the pin is a 28px disc, the name 20px high with 8px of
// padding either side, 4px away from the pin.
export const NAME_METRICS: LabelMetrics = { pinRadius: 14, gap: 4, labelH: 20, padX: 8 };

// Longer names are cut with an ellipsis, so one long name can't run across the map.
export const NAME_MAX_TEXT_W = 160;

// A cluster lists at most this many names. One more than that is listed in full, so the "+ n" line
// always stands for two or more and reads right in every language.
const LIST_MAX = 5;

// The names' font. MapView loads it before the names need it.
export const NAME_FONT = '600 11px Oswald, sans-serif';

// Phones and tablets can't hover: there a tap opens the popup and nothing else.
export const canHover = (): boolean => window.matchMedia?.('(hover: hover)').matches === true;

let canvas: HTMLCanvasElement | null = null;

// The width of a name as the map shows it, in capitals and in the names' font. Without a canvas
// (jsdom) it estimates.
export const measureName = (text: string): number => {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * 7;
  ctx.font = NAME_FONT;
  return ctx.measureText(text.toUpperCase()).width;
};

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const byName = (a: string, b: string) => a.localeCompare(b, 'de');

// The venues of a cluster, one per line in name order. `moreText` is t.moreVenues, with {n} for
// the names left out.
export const clusterTipHtml = (names: string[], moreText: string): string => {
  const sorted = [...names].sort(byName);
  const shown = sorted.length > LIST_MAX + 1 ? sorted.slice(0, LIST_MAX) : sorted;
  const lines = shown.map((n) => `<div>${escapeHtml(n)}</div>`);
  if (shown.length < sorted.length) {
    lines.push(`<div class="pin-tip-more">${escapeHtml(moreText.replace('{n}', String(sorted.length - shown.length)))}</div>`);
  }
  return `<div class="pin-tip-list">${lines.join('')}</div>`;
};

export interface NamePin { id: string; x: number; y: number; name: string }

export type PlacedName = PlacedLabel & { id: string };

// Places the names of lone pins in map container pixels. Names get first pick of the free sides in
// name order, so the same view always gives the same names.
export const placeNames = (
  pins: NamePin[],
  measure: (s: string) => number,
  area: { width: number; height: number; obstacles: LabelRect[] },
): PlacedName[] => {
  const labels = [...pins].sort((a, b) => byName(a.name, b.name)).map((p) => {
    const { text, width } = ellipsizeLabel(p.name, measure, NAME_MAX_TEXT_W);
    return { x: p.x, y: p.y, text, width, id: p.id };
  });
  return placeLabelsFor(labels, NAME_METRICS, area).map(({ pin, label }) => ({ ...label, id: pin.id }));
};
