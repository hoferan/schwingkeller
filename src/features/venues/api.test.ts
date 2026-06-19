import { describe, it, expect, vi, beforeEach } from 'vitest';

const { order, from } = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  return { order, select, from };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from } }));

import { listVenues } from './api';

beforeEach(() => { vi.clearAllMocks(); });

describe('listVenues', () => {
  it('selects venues ordered by name', async () => {
    order.mockResolvedValue({ data: [{ id: '1', name: 'A' }], error: null });
    const result = await listVenues();
    expect(from).toHaveBeenCalledWith('venues');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([{ id: '1', name: 'A' }]);
  });
  it('throws on error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(listVenues()).rejects.toThrow('boom');
  });
});
