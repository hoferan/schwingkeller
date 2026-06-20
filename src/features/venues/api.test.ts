import { describe, it, expect, vi, beforeEach } from 'vitest';

const { order, from, rpc } = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn();
  return { order, select, from, rpc };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));

import { listVenues, replaceAllVenues } from './api';
import type { VenueInput } from './types';

beforeEach(() => { vi.clearAllMocks(); });

describe('listVenues', () => {
  it('selects venues ordered by name', async () => {
    order.mockResolvedValue({ data: [{ id: '1', name: 'A' }], error: null });
    const result = await listVenues();
    expect(from).toHaveBeenCalledWith('venues');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([{ id: '1', name: 'A' }]);
  });
  it('throws with error code prefix when Supabase returns an error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'relation not found', code: '42P01' } });
    await expect(listVenues()).rejects.toThrow('[42P01] relation not found');
  });
});

const SAMPLE_VENUE: VenueInput = {
  name: 'Testkeller', canton: 'BE', address: 'Musterweg 1', lat: 46.9, lng: 7.4,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photo_url: null,
};

describe('replaceAllVenues', () => {
  it('calls replace_venues RPC with the given rows', async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceAllVenues([SAMPLE_VENUE]);
    expect(rpc).toHaveBeenCalledWith('replace_venues', { rows: [SAMPLE_VENUE] });
  });
  it('works with an empty list', async () => {
    rpc.mockResolvedValue({ error: null });
    await replaceAllVenues([]);
    expect(rpc).toHaveBeenCalledWith('replace_venues', { rows: [] });
  });
  it('throws with error code prefix on RPC error', async () => {
    rpc.mockResolvedValue({ error: { message: 'function does not exist', code: '42883' } });
    await expect(replaceAllVenues([SAMPLE_VENUE])).rejects.toThrow('[42883] function does not exist');
  });
});
