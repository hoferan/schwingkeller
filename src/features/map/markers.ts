import { theme } from '../../theme';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pinHtml = (_sel: boolean): string =>
  '<div style="position:relative;width:28px;height:28px;">'
  + '<div style="position:absolute;inset:0;border-radius:50%;background:' + theme.color.accent + ';border:3px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';"></div>'
  + '<div style="position:absolute;left:9px;top:9px;width:10px;height:10px;border-radius:50%;background:' + theme.color.bg + ';"></div>'
  + '</div>';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clusterIcon = (L: any) => (cluster: any) => {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : (n < 50 ? 40 : 46);
  return L.divIcon({ className: '', iconSize: [size, size], html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + theme.color.accent + ';border:2.5px solid ' + theme.color.bg + ';box-shadow:' + theme.shadow + ';display:flex;align-items:center;justify-content:center;color:' + theme.color.accentInk + ';font-family:Oswald,sans-serif;font-weight:700;font-size:' + (n < 100 ? 14 : 12) + 'px;">' + n + '</div>' });
};
