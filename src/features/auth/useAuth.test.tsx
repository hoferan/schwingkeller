import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { getSession, onAuthStateChange } = vi.hoisted(() => {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };
});
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

const Probe = () => {
  const { isAdmin } = useAuth();
  return <div>admin:{String(isAdmin)}</div>;
};

describe('AuthProvider', () => {
  it('defaults to not-admin when no session', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('admin:false')).toBeInTheDocument());
  });
});
