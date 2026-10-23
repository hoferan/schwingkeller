import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { signInWithPassword, signOut, rpc } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword, signOut }, rpc } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { useDeleteOwnAccount } from './useProfile';

const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(['profile', 'u1'], { id: 'u1' });
  client.setQueryData(['accounts', 'list', 'all'], []);
  client.setQueryData(['venues'], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useDeleteOwnAccount(), { wrapper }) };
};

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
});

describe('useDeleteOwnAccount', () => {
  it('forgets the profile and the account list once the account is deleted', async () => {
    const { client, result } = setup();
    result.current.mutate({ email: 'a@example.ch', password: 'pw' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(['profile', 'u1'])).toBeUndefined();
    expect(client.getQueryData(['accounts', 'list', 'all'])).toBeUndefined();
    expect(client.getQueryData(['venues'])).toEqual([]);
  });

  it('keeps the profile when the deletion fails', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot delete the last super-admin' } });
    const { client, result } = setup();
    result.current.mutate({ email: 'a@example.ch', password: 'pw' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(['profile', 'u1'])).toEqual({ id: 'u1' });
  });
});
