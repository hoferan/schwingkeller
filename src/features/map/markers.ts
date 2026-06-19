import type { Venue } from '../venues/types';
import type { STR } from '../../i18n/translations';
import { cantonByCode, wappenUrl } from '../../data/cantons';

type T = typeof STR.de;

export const pinHtml = (sel: boolean): string =>
  '<div style="position:relative;width:32px;height:40px;">'
  + '<div style="position:absolute;left:1px;top:0;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + (sel ? 'linear-gradient(135deg,#ecc05a,#bd7a14)' : 'linear-gradient(135deg,#a86a1f,#6e4314)') + ';border:2.5px solid #f4ead4;box-shadow:0 4px 9px rgba(0,0,0,.4);"></div>'
  + '<div style="position:absolute;left:11px;top:9px;width:10px;height:10px;border-radius:50%;background:#f4ead4;box-shadow:inset 0 0 0 2px ' + (sel ? '#bd7a14' : '#6e4314') + ';"></div>'
  + '</div>';

export const popupHtml = (v: Venue, t: T): string => {
  const c = cantonByCode(v.canton);
  const photo = v.photo_url ? '<div style="height:104px;background:url(' + v.photo_url + ') center/cover;"></div>' : '<div style="height:104px;background:repeating-linear-gradient(45deg,#d8c79c 0 9px,#cdbb8c 9px 18px);display:flex;align-items:center;justify-content:center;"><span style="font-family:monospace;font-size:10px;letter-spacing:.1em;color:#7a6342;background:rgba(248,239,219,.85);padding:3px 7px;border-radius:4px;">FOTO</span></div>';
  return '<div style="width:222px;font-family:Work Sans,sans-serif;">' + photo
    + '<div style="padding:11px 13px 13px;">'
    + '<div style="display:flex;align-items:center;gap:7px;">' + (c ? '<img src="' + wappenUrl(c.code) + '" style="width:15px;height:19px;object-fit:contain;">' : '') + '<span style="font-family:Bitter,serif;font-weight:700;font-size:14.5px;color:#2e2013;line-height:1.2;">' + v.name + '</span></div>'
    + '<div style="font-size:11.5px;color:#9a8460;margin-top:3px;">' + v.address + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:9px;">' + (v.indoor ? '<span style="font-size:10.5px;font-weight:600;color:#5a4a2a;background:#e9d8ab;padding:3px 8px;border-radius:6px;">⌂ ' + t.indoor + '</span>' : '') + (v.outdoor ? '<span style="font-size:10.5px;font-weight:600;color:#5a4a2a;background:#e9d8ab;padding:3px 8px;border-radius:6px;">⛰ ' + t.outdoor + '</span>' : '') + '</div>'
    + '<button data-detail="' + v.id + '" style="margin-top:11px;width:100%;border:none;cursor:pointer;background:#2e2013;color:#f4ead4;font-family:Work Sans;font-weight:600;font-size:12.5px;padding:9px;border-radius:8px;">' + t.details + ' →</button>'
    + '</div></div>';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c89a3e,#8a5a14);border:2.5px solid #f4ead4;box-shadow:0 4px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff8e6;font-family:Bitter,serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
