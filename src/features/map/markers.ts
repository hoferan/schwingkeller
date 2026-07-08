import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { theme } from '../../theme';

type T = typeof STR.de;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pinHtml = (_sel: boolean): string =>
  '<div style="position:relative;width:28px;height:28px;">'
  + '<div style="position:absolute;inset:0;border-radius:50%;background:' + theme.color.accent + ';border:3px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';"></div>'
  + '<div style="position:absolute;left:9px;top:9px;width:10px;height:10px;border-radius:50%;background:' + theme.color.bg + ';"></div>'
  + '</div>';

export const popupHtml = (v: Venue, t: T): string => {
  const c = cantonByCode(v.canton);
  const photo = v.photo_url ? '<div style="height:104px;background:url(' + v.photo_url + ') center/cover;"></div>' : '<div style="height:104px;background:repeating-linear-gradient(45deg,#e5e5e5 0 9px,#d4d4d4 9px 18px);display:flex;align-items:center;justify-content:center;"><span style="font-family:monospace;font-size:10px;letter-spacing:.1em;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';border-radius:999px;padding:3px 7px;">FOTO</span></div>';
  return '<div style="width:222px;font-family:Work Sans,sans-serif;">' + photo
    + '<div style="padding:11px 13px 13px;">'
    + '<div style="display:flex;align-items:center;gap:7px;">' + (c ? '<img src="' + wappenUrl(c.code) + '" style="width:15px;height:19px;object-fit:contain;">' : '') + '<span style="font-family:Oswald,sans-serif;text-transform:uppercase;font-weight:700;font-size:14.5px;color:' + theme.color.ink + ';line-height:1.2;">' + v.name + '</span></div>'
    + '<div style="font-size:11.5px;color:' + theme.color.muted + ';margin-top:3px;">' + v.address + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:9px;">' + (v.indoor ? '<span style="font-size:10.5px;font-weight:600;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';border-radius:999px;padding:3px 8px;">⌂ ' + t.indoor + '</span>' : '') + (v.outdoor ? '<span style="font-size:10.5px;font-weight:600;color:' + theme.color.ink + ';background:' + theme.color.bg + ';border:1px solid ' + theme.color.line + ';border-radius:999px;padding:3px 8px;">⛰ ' + t.outdoor + '</span>' : '') + '</div>'
    + '<button data-detail="' + v.id + '" style="margin-top:11px;width:100%;border:none;cursor:pointer;background:' + theme.color.accent + ';color:' + theme.color.accentInk + ';font-family:Work Sans;font-weight:600;font-size:12.5px;padding:9px;border-radius:10px;">' + t.details + ' →</button>'
    + '</div></div>';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
