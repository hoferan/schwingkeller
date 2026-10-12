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

// How long the pointer has to rest on a pin or a cluster before its chip or list shows, and how long
// it then takes to fade in. A pointer passing over pins on its way across the map leaves each one
// before its chip shows, so nothing flickers. MapView hands both to the CSS (.pin-tip in index.css).
export const TIP_SHOW_DELAY_MS = 300;
export const TIP_FADE_MS = 150;

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

// The distances from a marker's point to the edges of its icon, plus 1px of air: a tooltip opens
// just outside them. midY is the height a tooltip to the left or right lines up with.
export interface TipExtents { top: number; bottom: number; left: number; right: number; midY: number }

export type TipDirection = 'top' | 'bottom' | 'right' | 'left';

// Leaflet's tooltip arrow, which its CSS adds between the tooltip and the point it opens from.
const TIP_ARROW = 6;

// The side a chip or a cluster's list opens on: above when it fits inside the map and clear of the
// map's controls, else below, right or left, else above all the same. Above and below keep it
// centred on the marker; the sides are for markers at the left or right edge. The offset is what
// Leaflet's tooltip needs for that side.
export const placeTip = (
  p: { x: number; y: number },
  ext: TipExtents,
  { w, h }: { w: number; h: number },
  area: { width: number; height: number; obstacles: LabelRect[] },
): { direction: TipDirection; offset: [number, number] } => {
  const sides: { direction: TipDirection; offset: [number, number]; rect: LabelRect }[] = [
    { direction: 'top', offset: [0, ext.top], rect: { x: p.x - w / 2, y: p.y + ext.top - TIP_ARROW - h, w, h } },
    { direction: 'bottom', offset: [0, ext.bottom], rect: { x: p.x - w / 2, y: p.y + ext.bottom + TIP_ARROW, w, h } },
    { direction: 'right', offset: [ext.right, ext.midY], rect: { x: p.x + ext.right + TIP_ARROW, y: p.y + ext.midY - h / 2, w, h } },
    { direction: 'left', offset: [ext.left, ext.midY], rect: { x: p.x + ext.left - TIP_ARROW - w, y: p.y + ext.midY - h / 2, w, h } },
  ];
  const fits = ({ x, y }: LabelRect) => x >= 0 && y >= 0 && x + w <= area.width && y + h <= area.height;
  const clear = (r: LabelRect) =>
    area.obstacles.every((o) => r.x >= o.x + o.w || o.x >= r.x + r.w || r.y >= o.y + o.h || o.y >= r.y + r.h);
  const side = sides.find((s) => fits(s.rect) && clear(s.rect)) ?? sides[0];
  return { direction: side.direction, offset: side.offset };
};
