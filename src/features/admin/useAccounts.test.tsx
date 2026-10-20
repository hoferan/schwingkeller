import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));

import { useApproveEditor, useRejectEditor } from './useAccounts';

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
};

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe('admin mutations', () => {
  it('refetch the account queries after a rejection', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRejectEditor(), { wrapper });
    result.current.mutate('u1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['accounts'] });
  });

  // Someone else may have acted first: the list has to show the account as it is now.
  it('refetch the account queries after a failed approval too', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot approve an account that is approved' } });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useApproveEditor(), { wrapper });
    result.current.mutate({ targetId: 'u1', scope: 'emmental' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['accounts'] });
  });
});
