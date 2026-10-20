import { describe, it, expect, vi, beforeEach } from 'vitest';

// A PostgREST query builder stand-in: every call is recorded, and awaiting it gives `result`.
const { from, rpc, calls, state } = vi.hoisted(() => {
  const calls: [string, ...unknown[]][] = [];
  const state: { result: unknown } = { result: { data: [], error: null } };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(state.result);
  const from = vi.fn((table: string) => {
    calls.push(['from', table]);
    return builder;
  });
  return { from, rpc: vi.fn(), calls, state };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from, rpc } }));

import { approveEditor, fetchAccounts, fetchApprovedScopes, fetchPendingCount, rejectEditor } from './accounts';

const COLUMNS = 'id,email,status,requested_association_id,scope_association_id,created_at';

beforeEach(() => {
  calls.length = 0;
  state.result = { data: [], error: null };
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe('fetchAccounts', () => {
  it('reads one status, newest first', async () => {
    const row = { id: 'u1', email: 'a@b.ch', status: 'pending' };
    state.result = { data: [row], error: null };
    await expect(fetchAccounts('pending')).resolves.toEqual([row]);
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['select', COLUMNS],
      ['eq', 'status', 'pending'],
      ['order', 'created_at', { ascending: false }],
    ]);
  });

  it('reads every status for "all"', async () => {
    await fetchAccounts('all');
    expect(calls.some(([m]) => m === 'eq')).toBe(false);
  });

  it('throws the error with its code', async () => {
    state.result = { data: null, error: { code: '42501', message: 'not authorized' } };
    await expect(fetchAccounts('pending')).rejects.toThrow('[42501] not authorized');
  });
});

describe('fetchPendingCount', () => {
  it('counts pending rows without reading them', async () => {
    state.result = { data: null, count: 3, error: null };
    await expect(fetchPendingCount()).resolves.toBe(3);
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['select', 'id', { count: 'exact', head: true }],
      ['eq', 'status', 'pending'],
    ]);
  });

  it('reads a missing count as 0', async () => {
    state.result = { data: null, count: null, error: null };
    await expect(fetchPendingCount()).resolves.toBe(0);
  });
});

describe('fetchApprovedScopes', () => {
  it('returns the scope of every approved account', async () => {
    state.result = {
      data: [{ scope_association_id: 'bksv' }, { scope_association_id: null }, { scope_association_id: 'emmental' }],
      error: null,
    };
    await expect(fetchApprovedScopes()).resolves.toEqual(['bksv', 'emmental']);
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['select', 'scope_association_id'],
      ['eq', 'status', 'approved'],
    ]);
  });
});

describe('editor RPCs', () => {
  it('approves with a scope', async () => {
    await approveEditor('u1', 'emmental');
    expect(rpc).toHaveBeenCalledWith('approve_editor', { target_id: 'u1', scope: 'emmental' });
  });

  it('rejects', async () => {
    await rejectEditor('u1');
    expect(rpc).toHaveBeenCalledWith('reject_editor', { target_id: 'u1' });
  });

  it('throws the RPC error with its code', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot reject an account that is approved' } });
    await expect(rejectEditor('u1')).rejects.toThrow('[P0001] cannot reject an account that is approved');
  });
});
