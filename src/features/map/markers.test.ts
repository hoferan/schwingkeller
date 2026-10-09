import { describe, it, expect, vi, afterEach } from 'vitest';
import { clusterIcon, clusterRing, pinHtml, pinSize, popupHtml, userPinHtml } from './markers';
import { STR } from '../../i18n/translations';
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
    const html = popupHtml(venue, STR.de);
    expect(html).toContain('Emmental');
    expect(html).toContain('data-detail="1"');
  });
});

describe('pins with the verband flag off', () => {
  it('draws every pin in the accent red, selected or not, whatever the association', () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    expect(pinHtml(true, 'emmental')).toBe(pinHtml(false, 'luzern'));
    expect(pinHtml(false, 'emmental')).toContain(theme.color.accent);
    expect(pinSize(true)).toBe(28);
  });
});

// VITE_APP_ENV is unset here, which reads as development, where the verband flag is on.
describe('pins with the verband flag on', () => {
  it('fills a pin with its Teilverband colour', () => {
    const html = pinHtml(false, 'emmental');
    expect(html).toContain('#1A1A1A');
    expect(html).not.toContain(theme.color.accent);
  });

  it('draws the selected pin larger and with a dark ring', () => {
    const html = pinHtml(true, 'luzern');
    expect(html).toContain('width:34px');
    expect(html).toContain('0 0 0 2.5px ' + theme.color.ink);
    expect(pinSize(true)).toBe(34);
    expect(pinSize(false)).toBe(28);
    expect(pinHtml(false, 'luzern')).not.toContain(theme.color.ink);
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
  it('is a blue location dot, visually distinct from venue pins', () => {
    const html = userPinHtml();
    expect(html).toContain('#1a73e8');
    expect(html).not.toBe(pinHtml(false, 'emmental'));
  });
});
