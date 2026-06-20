import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reverseGeocode, forwardGeocode } from './geocoding';

beforeEach(() => { vi.restoreAllMocks(); });

describe('reverseGeocode', () => {
  it('sends a User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);
    await reverseGeocode(46.9, 7.7);
    const headers = (mockFetch.mock.calls[0] as [string, RequestInit])[1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Schwingkeller/);
  });
  it('maps address + canton from a Nominatim reverse response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { road: 'Schlossstrasse', house_number: '3', postcode: '3550', town: 'Langnau', 'ISO3166-2-lvl4': 'CH-BE' } }),
    }));
    const r = await reverseGeocode(46.9, 7.7);
    expect(r?.address).toBe('Schlossstrasse 3, 3550 Langnau');
    expect(r?.canton).toBe('BE');
  });
  it('returns null on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await reverseGeocode(0, 0)).toBeNull();
  });
});

describe('forwardGeocode', () => {
  it('maps lat/lng + canton from a search response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ lat: '46.9389', lon: '7.7869', address: { postcode: '3550' } }]),
    }));
    const r = await forwardGeocode('Schlossstrasse 3, 3550 Langnau');
    expect(r?.lat).toBeCloseTo(46.9389);
    expect(r?.canton).toBe('BE');
  });
  it('returns null for short queries', async () => {
    expect(await forwardGeocode('abc')).toBeNull();
  });
});
