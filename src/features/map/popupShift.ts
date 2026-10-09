// Where to move an open venue popup so that all of it can be seen. Leaflet's own autoPan only keeps a
// popup inside the map's edges; it knows nothing of the controls drawn over the map, the zoom
// buttons on the left and the base switch and legend on the right, so a pin near the top could open
// its popup under them, close button included. MapView turns autoPan off and pans by this instead,
// which covers both.

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Shift {
  dx: number;
  dy: number;
}

// Leaflet's default autoPan padding between a popup and the map's edge.
const EDGE = 5;
// Space between a moved popup and the control it was moved clear of.
const GAP = 8;
// Room under the popup's tip for the selected pin, a teardrop 42px tall.
const PIN_ROOM = 48;

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const moved = (b: Box, { dx, dy }: Shift): Box =>
  ({ left: b.left + dx, top: b.top + dy, right: b.right + dx, bottom: b.bottom + dy });

const centre = (b: Box): number => (b.left + b.right) / 2;

// Leaflet's rule: a popup that sticks out is pulled back in, and where it sticks out on both sides
// the left and the top win, so its close button stays reachable.
const intoMap = (popup: Box, map: Box): Shift => {
  let dx = 0; let dy = 0;
  if (popup.right + EDGE > map.right) dx = map.right - EDGE - popup.right;
  if (popup.left + dx - EDGE < map.left) dx = map.left + EDGE - popup.left;
  if (popup.bottom + EDGE > map.bottom) dy = map.bottom - EDGE - popup.bottom;
  if (popup.top + dy - EDGE < map.top) dy = map.top + EDGE - popup.top;
  return { dx, dy };
};

// The controls sit at the top, so a covered popup moves down below them or sideways away from them,
// whichever is shorter, as long as the popup and its pin stay on the map. Null when no control
// covers it or no move works.
const clearOf = (popup: Box, controls: Box[], map: Box): Shift | null => {
  const covering = controls.filter((c) => overlaps(popup, c));
  if (covering.length === 0) return null;

  const candidates: Shift[] = [{ dx: 0, dy: Math.max(...covering.map((c) => c.bottom)) + GAP - popup.top }];
  if (covering.every((c) => centre(c) > centre(popup))) {
    candidates.push({ dx: Math.min(...covering.map((c) => c.left)) - GAP - popup.right, dy: 0 });
  } else if (covering.every((c) => centre(c) <= centre(popup))) {
    candidates.push({ dx: Math.max(...covering.map((c) => c.right)) + GAP - popup.left, dy: 0 });
  }

  const fits = (shift: Shift): boolean => {
    const p = moved(popup, shift);
    return p.left >= map.left && p.right <= map.right && p.bottom + PIN_ROOM <= map.bottom
      && !controls.some((c) => overlaps(p, c));
  };
  const length = ({ dx, dy }: Shift): number => Math.abs(dx) + Math.abs(dy);
  return candidates.filter(fits).sort((a, b) => length(a) - length(b))[0] ?? null;
};

// Screen pixels to move the popup by, or null when it can stay where it is. Moving the popup means
// panning the map by the opposite.
export const popupShift = (popup: Box, controls: Box[], map: Box): Shift | null => {
  const edge = intoMap(popup, map);
  const clear = clearOf(moved(popup, edge), controls, map) ?? { dx: 0, dy: 0 };
  const shift = { dx: edge.dx + clear.dx, dy: edge.dy + clear.dy };
  return shift.dx || shift.dy ? shift : null;
};
