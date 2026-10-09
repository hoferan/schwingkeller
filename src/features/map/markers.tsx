import { renderToStaticMarkup } from 'react-dom/server';
import type { DivIconOptions } from 'leaflet';
import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { theme } from '../../theme';
import type { CantonalId } from '../../data/associations';
import { REGIONAL_TINTS, tintOf } from '../../data/associationTints';
import { isFeatureOn } from '../../lib/features';
import { MarkerPopup } from './MarkerPopup';
import type { Associations } from '../associations/useAssociations';

type T = typeof STR.de;

export const popupHtml = (v: Venue, t: T, associations: Associations): string =>
  renderToStaticMarkup(<MarkerPopup venue={v} t={t} associations={associations} />);

export interface PinIcon {
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
  popupAnchor: [number, number];
}

// A venue pin is a disc in its Teilverband's colour, or red with the verband flag off. The selected
// pin is a teardrop in the same colour: its shape marks it whatever the colour, and no other marker
// on the map has that shape. Each pin is one SVG, so its circles share one centre at any zoom.
export const pinIcon = (selected: boolean, associationId: CantonalId): PinIcon => {
  const fill = isFeatureOn('verband') ? tintOf(associationId) : theme.color.accent;
  if (!selected) {
    return {
      html: '<svg width="28" height="28" viewBox="0 0 28 28" style="display:block;overflow:visible;filter:drop-shadow(0 4px 8px rgba(0,0,0,.12))">'
        + '<circle cx="14" cy="14" r="12.5" fill="' + fill + '" stroke="' + theme.color.bg + '" stroke-width="3"/>'
        + '<circle cx="14" cy="14" r="5" fill="' + theme.color.bg + '"/>'
        + '</svg>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -20],
    };
  }
  // The head is a circle of radius 12.5 around (15, 15.5); the tip at (15, 39) is the venue's spot,
  // with a small ground shadow under it.
  return {
    html: '<svg width="30" height="42" viewBox="0 0 30 42" style="display:block;overflow:visible;filter:drop-shadow(0 2px 2.5px rgba(0,0,0,.35))">'
      + '<ellipse cx="15" cy="39" rx="5" ry="1.8" fill="rgba(0,0,0,.28)"/>'
      + '<path d="M15 39 C11 33 2.5 25 2.5 15.5 A12.5 12.5 0 1 1 27.5 15.5 C27.5 25 19 33 15 39 Z" fill="' + fill + '" stroke="' + theme.color.bg + '" stroke-width="2.5" stroke-linejoin="round"/>'
      + '<circle cx="15" cy="15.5" r="5" fill="' + theme.color.bg + '"/>'
      + '</svg>',
    iconSize: [30, 42],
    iconAnchor: [15, 39],
    popupAnchor: [0, -42],
  };
};

// The width of the "you are here" marker, halo included. MapView sizes and anchors the icon with it.
export const USER_PIN_SIZE = 48;

// "You are here": a blue dot with a white edge inside a translucent blue halo, the usual sign for a
// device location. NWSV pins are blue too, so it is the halo that sets it apart from a venue
// pin. The halo's rim keeps its edge visible on the satellite view.
export const userPinHtml = (): string => {
  const dot = 18;
  const offset = (USER_PIN_SIZE - dot) / 2;
  return '<div style="position:relative;width:' + USER_PIN_SIZE + 'px;height:' + USER_PIN_SIZE + 'px;">'
    + '<div style="position:absolute;inset:0;box-sizing:border-box;border-radius:50%;background:rgba(26,115,232,0.18);border:1.5px solid rgba(26,115,232,0.6);"></div>'
    + '<div style="position:absolute;left:' + offset + 'px;top:' + offset + 'px;width:' + dot + 'px;height:' + dot + 'px;box-sizing:border-box;border-radius:50%;background:#1a73e8;border:3px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';"></div>'
    + '</div>';
};

const percent = (part: number, whole: number): number => Math.round((part / whole) * 10000) / 100;

// The ring around a cluster: one segment per Teilverband, sized by how many of the cluster's venues
// belong to it, in the order of REGIONAL_TINTS.
export const clusterRing = (associationIds: readonly CantonalId[]): string => {
  const counts = new Map<string, number>();
  for (const id of associationIds) {
    const tint = tintOf(id);
    counts.set(tint, (counts.get(tint) ?? 0) + 1);
  }
  let done = 0;
  const segments = Object.values(REGIONAL_TINTS).flatMap((tint) => {
    const n = counts.get(tint);
    if (!n) return [];
    const from = percent(done, associationIds.length);
    done += n;
    return [tint + ' ' + from + '% ' + percent(done, associationIds.length) + '%'];
  });
  return 'conic-gradient(' + segments.join(', ') + ')';
};

// MapView stores each venue's association in its marker's options, so a cluster can read them.
interface ClusterLike {
  getChildCount(): number;
  getAllChildMarkers(): { options: { associationId: CantonalId } }[];
}

// With the verband flag off a cluster is a red disc. With it on it is drawn like a pin with a number:
// a white edge, a ring showing which Teilverbände its venues belong to, and a white centre with the
// count. The count takes the ring's colour when there is only one, and the ink colour otherwise.
export const clusterIcon = <I,>(L: { divIcon(options: DivIconOptions): I }) => (cluster: ClusterLike): I => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  const fontSize = (n < 100 ? 14 : 12) + 'px';
  if (!isFeatureOn('verband')) {
    return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + fontSize + ';">' + n + '</div>' });
  }
  const ids = cluster.getAllChildMarkers().map((m) => m.options.associationId);
  const tints = new Set(ids.map(tintOf));
  const countColor = tints.size === 1 ? [...tints][0] : theme.color.ink;
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="box-sizing:border-box;width:' + size + 'px;height:' + size + 'px;border-radius:50%;padding:5px;background:' + clusterRing(ids) + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';">'
    + '<div style="width:100%;height:100%;border-radius:50%;background:' + theme.color.bg + ';display:flex;align-items:center;justify-content:center;color:' + countColor + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + fontSize + ';line-height:1;">' + n + '</div>'
    + '</div>' });
};
