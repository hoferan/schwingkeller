import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { updateVenue, removeVenue } = vi.hoisted(() => ({
  updateVenue: vi.fn(),
  removeVenue: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, updateVenue, removeVenue };
});

import { VenueChangeRefusedError } from './api';
import { useVenueMutations } from './useVenues';

const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useVenueMutations(), { wrapper });
  const keys = () => invalidate.mock.calls.map(([f]) => f?.queryKey);
  return { result, keys };
};

describe('useVenueMutations refused changes', () => {
  beforeEach(() => {
    updateVenue.mockReset();
    removeVenue.mockReset();
  });

  it('refreshes venues and profile after a refused remove', async () => {
    removeVenue.mockRejectedValue(new VenueChangeRefusedError());
    const { result, keys } = setup();
    await act(async () => {
      await result.current.remove.mutateAsync('v1').catch(() => {});
    });
    expect(keys()).toEqual(expect.arrayContaining([['venues'], ['profile']]));
  });

  it('refreshes venues and profile after a refused update', async () => {
    updateVenue.mockRejectedValue(new VenueChangeRefusedError());
    const { result, keys } = setup();
    await act(async () => {
      await result.current.update.mutateAsync({ id: 'v1', input: {} }).catch(() => {});
    });
    expect(keys()).toEqual(expect.arrayContaining([['venues'], ['profile']]));
  });

  it('leaves the caches alone after another error', async () => {
    removeVenue.mockRejectedValue(new Error('network down'));
    updateVenue.mockRejectedValue(new Error('network down'));
    const { result, keys } = setup();
    await act(async () => {
      await result.current.remove.mutateAsync('v1').catch(() => {});
      await result.current.update.mutateAsync({ id: 'v1', input: {} }).catch(() => {});
    });
    expect(keys()).toEqual([]);
  });
});
