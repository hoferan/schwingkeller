import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forwardGeocode } from './geocoding';

beforeEach(() => { vi.restoreAllMocks(); });

describe('forwardGeocode', () => {
  it('sends a User-Agent header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', mockFetch);
    await forwardGeocode('Schlossstrasse 3, 3550 Langnau');
    const headers = (mockFetch.mock.calls[0] as [string, RequestInit])[1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Schwingkeller/);
  });
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
