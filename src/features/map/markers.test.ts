import { describe, it, expect, vi, afterEach } from 'vitest';
import { clusterIcon, clusterRing, pinIcon, popupHtml, userPinHtml, USER_PIN_SIZE } from './markers';
import { STR } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';
import { theme } from '../../theme';
import type { Venue } from '../venues/types';
import type { CantonalId } from '../../data/associations';

const venue: Venue = {
  id: '1', name: 'Emmental', canton: 'BE', address: '3550 Langnau', lat: 46.9, lng: 7.7,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'emmental',
};

// Stands in for Leaflet: divIcon hands back its options, and a cluster is its children's ids.
const fakeL = { divIcon: (o: { html: string; iconSize: [number, number] }) => o };
const cluster = (ids: CantonalId[]) => ({
  getChildCount: () => ids.length,
  getAllChildMarkers: () => ids.map((associationId) => ({ options: { associationId } })),
});
const clusterHtml = (ids: CantonalId[]) => clusterIcon(fakeL)(cluster(ids));

afterEach(() => { vi.unstubAllEnvs(); });

describe('markers html', () => {
  it('popupHtml includes name and a data-detail hook', () => {
    const html = popupHtml(venue, STR.de, associationsFor('de'));
    expect(html).toContain('Emmental');
    expect(html).toContain('data-detail="1"');
  });
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('pins with the verband flag off', () => {
  it('draws every pin in the accent red, whatever the association', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    expect(pinIcon(false, 'emmental').html).toBe(pinIcon(false, 'luzern').html);
    expect(pinIcon(false, 'emmental').html).toContain(theme.color.accent);
    expect(pinIcon(true, 'emmental').html).toContain(theme.color.accent);
  });

  it('still marks the selected pin as a teardrop', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    expect(pinIcon(true, 'emmental').html).toContain('<path');
    expect(pinIcon(false, 'emmental').html).not.toContain('<path');
  });
});

// VITE_APP_ENV is unset here, which reads as development, where the verband flag is on.
describe('pins with the verband flag on', () => {
  it('fills a pin with its Teilverband colour', () => {
    const { html } = pinIcon(false, 'emmental');
    expect(html).toContain('#1A1A1A');
    expect(html).not.toContain(theme.color.accent);
  });

  it('draws each pin as a single SVG', () => {
    expect(pinIcon(false, 'luzern').html.startsWith('<svg')).toBe(true);
    expect(count(pinIcon(false, 'luzern').html, '<svg')).toBe(1);
    expect(pinIcon(true, 'luzern').html.startsWith('<svg')).toBe(true);
    expect(count(pinIcon(true, 'luzern').html, '<svg')).toBe(1);
  });

  it('draws an unselected pin as a 28px disc with a white edge and a white centre on the same point', () => {
    const { html, iconSize, iconAnchor, popupAnchor } = pinIcon(false, 'freiburg');
    expect(iconSize).toEqual([28, 28]);
    expect(iconAnchor).toEqual([14, 14]);
    expect(popupAnchor).toEqual([0, -20]);
    expect(html).toContain('<circle cx="14" cy="14" r="12.5" fill="#5D6B80" stroke="#ffffff" stroke-width="3"');
    expect(html).toContain('<circle cx="14" cy="14" r="5" fill="#ffffff"');
  });

  it('draws the selected pin as a teardrop in the Teilverband colour, anchored at its tip', () => {
    const { html, iconSize, iconAnchor, popupAnchor } = pinIcon(true, 'luzern');
    expect(iconSize).toEqual([30, 42]);
    expect(iconAnchor).toEqual([15, 39]);
    expect(popupAnchor).toEqual([0, -42]);
    expect(html).toMatch(/<path d="M15 39 [^"]+" fill="#E30613" stroke="#ffffff" stroke-width="2.5"/);
    expect(html).toContain('<circle cx="15" cy="15.5" r="5" fill="#ffffff"');
  });

  it('marks the selected pin by its shape, without a dark ring', () => {
    expect(pinIcon(true, 'freiburg').html).not.toContain(theme.color.ink);
    expect(pinIcon(false, 'freiburg').html).not.toContain(theme.color.ink);
  });
});

describe('clusterRing', () => {
  it('splits the ring by Teilverband, in the order of the tints', () => {
    expect(clusterRing(['freiburg', 'emmental', 'emmental', 'oberland']))
      .toBe('conic-gradient(#1A1A1A 0% 75%, #5D6B80 75% 100%)');
  });

  it('paints the whole ring in one colour when all venues share a Teilverband', () => {
    expect(clusterRing(['freiburg', 'waadt'])).toBe('conic-gradient(#5D6B80 0% 100%)');
  });

  it('rounds the shares', () => {
    expect(clusterRing(['luzern', 'thurgau', 'zuerich']))
      .toBe('conic-gradient(#E30613 0% 33.33%, #0B7A26 33.33% 100%)');
  });
});

describe('cluster icon', () => {
  it('stays a red disc with the count when the flag is off', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    const icon = clusterHtml(['emmental', 'freiburg']);
    expect(icon.html).toContain('background:' + theme.color.accent);
    expect(icon.html).toContain('>2<');
    expect(icon.html).not.toContain('conic-gradient');
    expect(icon.iconSize).toEqual([34, 34]);
  });

  // The outer element carries the white edge and the ring, the inner one the white centre and count.
  const parts = (html: string) => {
    const [outer, inner] = [...html.matchAll(/<div style="([^"]*)"/g)].map((m) => m[1]);
    return { outer, inner };
  };

  it('draws a cluster like a pin with a number when the flag is on', () => {
    const icon = clusterHtml(['emmental', 'freiburg']);
    const { outer, inner } = parts(icon.html);
    expect(outer).toContain('background:' + clusterRing(['emmental', 'freiburg']));
    expect(outer).toContain('border:2.5px solid ' + theme.color.bg);
    expect(outer).toContain('box-shadow:' + theme.shadow);
    expect(inner).toContain('background:' + theme.color.bg);
    expect(inner).toContain('line-height:1');
    expect(icon.html).toContain('>2<');
    expect(icon.iconSize).toEqual([34, 34]);
  });

  it('writes the count in the Teilverband colour when all venues share one', () => {
    expect(parts(clusterHtml(['emmental', 'oberland']).html).inner).toContain('color:#1A1A1A');
  });

  it('writes the count in dark grey when the venues belong to several Teilverbände', () => {
    expect(parts(clusterHtml(['emmental', 'freiburg']).html).inner).toContain('color:' + theme.color.ink);
  });

  it('grows with the number of venues and shrinks the count from 100 on', () => {
    const sized = (n: number) => clusterHtml(Array<CantonalId>(n).fill('luzern'));
    expect([9, 10, 50].map((n) => sized(n).iconSize)).toEqual([[34, 34], [40, 40], [46, 46]]);
    expect(parts(sized(99).html).inner).toContain('font-size:14px');
    expect(parts(sized(100).html).inner).toContain('font-size:12px');
  });
});

describe('userPinHtml', () => {
  const layers = () => {
    const box = document.createElement('div');
    box.innerHTML = userPinHtml();
    const root = box.firstElementChild as HTMLElement;
    const [halo, dot] = [...root.children] as HTMLElement[];
    return { root, halo, dot };
  };

  it('draws a blue dot with a white edge in the middle of its box', () => {
    const { root, dot } = layers();
    expect(root.style.width).toBe(USER_PIN_SIZE + 'px');
    expect(root.style.height).toBe(USER_PIN_SIZE + 'px');
    expect(dot.style.background).toBe('rgb(26, 115, 232)');
    expect(dot.style.border).toContain('3px solid');
    expect(dot.style.left).toBe((USER_PIN_SIZE - 18) / 2 + 'px');
  });

  it('puts a translucent blue halo with a rim around the dot, filling the box', () => {
    const { halo } = layers();
    expect(halo.style.inset).toBe('0px');
    expect(halo.style.borderRadius).toBe('50%');
    expect(halo.style.background).toBe('rgba(26, 115, 232, 0.18)');
    expect(halo.style.border).toContain('rgba(26, 115, 232, 0.6)');
  });

  it('is wider than a venue pin, so its shape tells it apart from a blue NWSV pin', () => {
    expect(USER_PIN_SIZE).toBeGreaterThan(pinIcon(true, 'aargau').iconSize[0]);
    expect(userPinHtml()).not.toBe(pinIcon(false, 'aargau').html);
  });
});
