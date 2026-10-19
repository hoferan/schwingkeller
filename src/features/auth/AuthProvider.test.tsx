import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';

const { getSession, onAuthStateChange, signOutFn, single } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOutFn: vi.fn().mockResolvedValue({ error: null }),
  single: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession, onAuthStateChange, signOut: signOutFn },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  },
}));

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/react', () => ({ captureException }));

import { buildTree } from '../associations/tree';
import { AuthProvider, buildAuthValue } from './AuthProvider';
import { useAuth } from './useAuth';
import type { Profile, ProfileStatus } from './profile';

const tree = buildTree();
const session = { user: { id: 'u1' } } as unknown as Session;
const profile = (status: ProfileStatus, scope: string | null): Profile => ({
  id: 'u1',
  status,
  scope_association_id: scope,
  requested_association_id: null,
});

describe('buildAuthValue', () => {
  it('gives an approved regional editor their subtree', () => {
    const v = buildAuthValue(session, profile('approved', 'bksv'), tree);
    expect(v.scope).toBe('bksv');
    expect(v.isApproved).toBe(true);
    expect(v.isSuperAdmin).toBe(false);
    expect(v.canEditAssociation('emmental')).toBe(true);
    expect(v.canEditAssociation('luzern')).toBe(false);
    expect(v.canEditAssociation(null)).toBe(false);
  });

  it('makes an approved esv account the super-admin', () => {
    const v = buildAuthValue(session, profile('approved', 'esv'), tree);
    expect(v.isSuperAdmin).toBe(true);
    expect(v.canEditAssociation(null)).toBe(true);
    expect(v.canEditAssociation('luzern')).toBe(true);
  });

  it.each(['pending', 'suspended', 'rejected'] as const)('gives a %s account no rights', (status) => {
    const v = buildAuthValue(session, profile(status, 'emmental'), tree);
    expect(v.scope).toBeNull();
    expect(v.isApproved).toBe(false);
    expect(v.isSuperAdmin).toBe(false);
    expect(v.canEditAssociation('emmental')).toBe(false);
  });

  it('gives no rights while the profile is still loading', () => {
    const v = buildAuthValue(session, null, tree);
    expect(v.profile).toBeNull();
    expect(v.scope).toBeNull();
    expect(v.isApproved).toBe(false);
    expect(v.canEditAssociation('emmental')).toBe(false);
    expect(v.canEditAssociation(null)).toBe(false);
  });

  it('gives no rights without a session, even with a stale profile', () => {
    const v = buildAuthValue(null, profile('approved', 'esv'), tree);
    expect(v.profile).toBeNull();
    expect(v.scope).toBeNull();
    expect(v.canEditAssociation('emmental')).toBe(false);
  });

  it('does not throw for a scope node the tree does not know', () => {
    const v = buildAuthValue(session, profile('approved', 'brand-new'), tree);
    expect(v.canEditAssociation('emmental')).toBe(false);
  });
});

describe('AuthProvider', () => {
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue({ data: { session } });
    onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    single.mockReset().mockResolvedValue({ data: profile('approved', 'emmental'), error: null });
    captureException.mockReset();
  });

  const Probe = () => {
    const { scope, signOut } = useAuth();
    return (
      <div>
        <span>scope:{String(scope)}</span>
        <button onClick={() => void signOut()}>out</button>
      </div>
    );
  };

  const renderProvider = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    return client;
  };

  it('loads the profile of the signed-in user', async () => {
    renderProvider();
    expect(screen.getByText('scope:null')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('scope:emmental')).toBeInTheDocument());
  });

  it('drops the cached profile on sign-out', async () => {
    const client = renderProvider();
    await waitFor(() => expect(screen.getByText('scope:emmental')).toBeInTheDocument());
    expect(client.getQueryData(['profile', 'u1'])).toBeDefined();
    await act(async () => {
      screen.getByText('out').click();
    });
    expect(signOutFn).toHaveBeenCalled();
    expect(client.getQueryCache().findAll({ queryKey: ['profile'] })).toHaveLength(0);
  });

  it('reports a failed profile fetch to Sentry once', async () => {
    const failure = new Error('profile fetch failed');
    single.mockResolvedValue({ data: null, error: failure });
    const client = renderProvider();
    await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
    expect(captureException).toHaveBeenCalledWith(expect.anything());
    // A re-render without a new failure sends nothing more.
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['unrelated'] });
    });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('reports nothing when the profile loads', async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByText('scope:emmental')).toBeInTheDocument());
    expect(captureException).not.toHaveBeenCalled();
  });
});
