import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';

const { fetchInvitation } = vi.hoisted(() => ({ fetchInvitation: vi.fn() }));
vi.mock('./invitation', () => ({ fetchInvitation }));

import { useInvitation } from './useInvitation';

const invitation = { email: 'a@b.ch', associationId: 'emmental', expiresAt: '2026-11-02T00:00:00Z' };

const setup = () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useInvitation('tok'), { wrapper }) };
};

describe('useInvitation', () => {
  it('resolves to the invitation for the token', async () => {
    fetchInvitation.mockResolvedValue(invitation);
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toEqual(invitation));
    expect(fetchInvitation).toHaveBeenCalledWith('tok');
  });

  it('does not retry a failed lookup', async () => {
    fetchInvitation.mockReset().mockRejectedValue(new Error('boom'));
    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchInvitation).toHaveBeenCalledTimes(1);
  });

  // The token is a credential until it is used, so the cache doesn't keep it once the dialog is gone.
  it('drops the token from the cache once nothing uses it', async () => {
    fetchInvitation.mockResolvedValue(invitation);
    const { client, result, unmount } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unmount();
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: ['invitation', 'tok'] })).toBeUndefined());
  });

  // A used invitation looks up as nothing, so a second lookup after sign-up would turn the welcome
  // step into "link not valid". The dialog needs the answer once.
  it('looks the token up once, even when the window regains focus', async () => {
    fetchInvitation.mockReset().mockResolvedValue(invitation);
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchInvitation).toHaveBeenCalledTimes(1);
    focusManager.setFocused(undefined);
  });
});
