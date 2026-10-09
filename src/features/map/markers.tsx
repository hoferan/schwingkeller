import { renderToStaticMarkup } from 'react-dom/server';
import type { DivIconOptions } from 'leaflet';
import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { theme } from '../../theme';
import { REGIONAL_TINTS, tintOf } from '../../data/associationTints';
import { isFeatureOn } from '../../lib/features';
import { MarkerPopup } from './MarkerPopup';

type T = typeof STR.de;

export const popupHtml = (v: Venue, t: T): string => renderToStaticMarkup(<MarkerPopup venue={v} t={t} />);

// With the verband flag on, a selected pin grows and gets a dark ring, because once pins come in
// five colours a colour alone can't mark it. With the flag off every pin looks the same.
export const pinSize = (selected: boolean): number => (selected && isFeatureOn('verband') ? 34 : 28);

export const pinHtml = (selected: boolean, associationId: string | null): string => {
  const verband = isFeatureOn('verband');
  const fill = (verband ? tintOf(associationId) : null) ?? theme.color.accent;
  const marked = selected && verband;
  const size = pinSize(selected);
  const dot = marked ? 12 : 10;
  const shadow = marked ? '0 0 0 2.5px ' + theme.color.ink + ',' + theme.shadow : theme.shadow;
  return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;">'
    + '<div style="position:absolute;inset:0;border-radius:50%;background:' + fill + ';border:3px solid ' + theme.color.bg + ';box-shadow:' + shadow + ';"></div>'
    + '<div style="position:absolute;left:' + (size - dot) / 2 + 'px;top:' + (size - dot) / 2 + 'px;width:' + dot + 'px;height:' + dot + 'px;border-radius:50%;background:' + theme.color.bg + ';"></div>'
    + '</div>';
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
// belong to it, in the order of REGIONAL_TINTS. Venues without an association come last, in red.
export const clusterRing = (associationIds: readonly (string | null)[]): string => {
  const counts = new Map<string, number>();
  for (const id of associationIds) {
    const tint = tintOf(id) ?? theme.color.accent;
    counts.set(tint, (counts.get(tint) ?? 0) + 1);
  }
  const order = [...Object.values(REGIONAL_TINTS), theme.color.accent];
  let done = 0;
  const segments = order.flatMap((tint) => {
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
  getAllChildMarkers(): { options: { associationId?: string | null } }[];
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
  const ids = cluster.getAllChildMarkers().map((m) => m.options.associationId ?? null);
  const tints = new Set(ids.map((id) => tintOf(id) ?? theme.color.accent));
  const countColor = tints.size === 1 ? [...tints][0] : theme.color.ink;
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="box-sizing:border-box;width:' + size + 'px;height:' + size + 'px;border-radius:50%;padding:5px;background:' + clusterRing(ids) + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';">'
    + '<div style="width:100%;height:100%;border-radius:50%;background:' + theme.color.bg + ';display:flex;align-items:center;justify-content:center;color:' + countColor + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + fontSize + ';line-height:1;">' + n + '</div>'
    + '</div>' });
};
