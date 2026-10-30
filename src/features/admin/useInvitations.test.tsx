import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { rpc, from, state } = vi.hoisted(() => {
  const state: { result: unknown } = { result: { data: [], error: null } };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'order']) builder[m] = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) => resolve(state.result);
  return { rpc: vi.fn(), from: vi.fn(() => builder), state };
});
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, from } }));

import { useCreateInvitation, useInvitations, useRevokeInvitation } from './useInvitations';

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
};

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: 'secret-token', error: null });
});

describe('useInvitations', () => {
  it('returns the fetched rows', async () => {
    const row = { id: 'i1', email: 'a@b.ch' };
    state.result = { data: [row], error: null };
    const { wrapper } = setup();
    const { result } = renderHook(() => useInvitations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([row]);
    expect(from).toHaveBeenCalledWith('invitations');
  });
});

describe('useCreateInvitation', () => {
  it('returns the token and leaves no trace in the mutation cache once unmounted', async () => {
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useCreateInvitation(), { wrapper });
    await expect(result.current.mutateAsync({ email: 'a@b.ch', scope: 'emmental' })).resolves.toBe('secret-token');
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('refetches the invitations when it settles', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateInvitation(), { wrapper });
    await result.current.mutateAsync({ email: 'a@b.ch', scope: 'emmental' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['invitations'] });
  });
});

describe('useRevokeInvitation', () => {
  it('refetches the invitations after a revocation', async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRevokeInvitation({}), { wrapper });
    result.current.mutate('i1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['invitations'] });
  });

  it('refetches after a failed revocation too, and reports the error', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'cannot revoke an invitation that is used' } });
    const onError = vi.fn();
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useRevokeInvitation({ onError }), { wrapper });
    result.current.mutate('i1');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['invitations'] });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
