import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));

import { fetchInvitation } from './invitation';

beforeEach(() => {
  rpc.mockReset();
});

describe('fetchInvitation', () => {
  it('asks invitation_details about the token', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await fetchInvitation('tok');
    expect(rpc).toHaveBeenCalledWith('invitation_details', { token: 'tok' });
  });

  it('returns the live invitation', async () => {
    rpc.mockResolvedValue({
      data: [{ email: 'a@b.ch', association_id: 'emmental', expires_at: '2026-11-02T00:00:00Z' }],
      error: null,
    });
    expect(await fetchInvitation('tok')).toEqual({
      email: 'a@b.ch',
      associationId: 'emmental',
      expiresAt: '2026-11-02T00:00:00Z',
    });
  });

  it('returns null when no invitation matches', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchInvitation('tok')).toBeNull();
  });

  it('throws when the lookup fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000' } });
    await expect(fetchInvitation('tok')).rejects.toThrow('[XX000] boom');
  });
});
