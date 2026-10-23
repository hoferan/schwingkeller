import { describe, it, expect, vi, beforeEach } from 'vitest';

const { signInWithPassword, signOut, rpc, captureException } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword, signOut }, rpc } }));
vi.mock('@sentry/react', () => ({ captureException }));

import { deleteOwnAccount, deleteOwnErrorKey, WrongPasswordError } from './deleteOwnAccount';

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  captureException.mockReset();
});

describe('deleteOwnAccount', () => {
  it('checks the password, deletes without a target and signs out locally', async () => {
    await deleteOwnAccount('a@example.ch', 'pw');
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.ch', password: 'pw' });
    expect(rpc).toHaveBeenCalledWith('delete_account');
    expect(rpc.mock.calls[0]).toHaveLength(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    const order = [signInWithPassword, rpc, signOut].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('throws WrongPasswordError and deletes nothing on invalid credentials', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
    });
    await expect(deleteOwnAccount('a@example.ch', 'nope')).rejects.toBeInstanceOf(WrongPasswordError);
    expect(rpc).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('throws other sign-in errors with their code and deletes nothing', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'over_request_rate_limit', message: 'Request rate limit reached', status: 429 },
    });
    await expect(deleteOwnAccount('a@example.ch', 'pw')).rejects.toThrow(
      '[over_request_rate_limit] Request rate limit reached',
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('throws the RPC error and stays signed in', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'cannot delete the last super-admin' } });
    await expect(deleteOwnAccount('a@example.ch', 'pw')).rejects.toThrow('[P0001] cannot delete the last super-admin');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('still resolves when the local sign-out fails', async () => {
    signOut.mockResolvedValue({ error: { message: 'network' } });
    await expect(deleteOwnAccount('a@example.ch', 'pw')).resolves.toBeUndefined();
  });
});

describe('deleteOwnErrorKey', () => {
  it('maps a wrong password without reporting it', () => {
    expect(deleteOwnErrorKey(new WrongPasswordError())).toBe('deleteOwnErrPassword');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('maps the last super-admin without reporting it', () => {
    expect(deleteOwnErrorKey(new Error('[P0001] cannot delete the last super-admin'))).toBe(
      'deleteOwnErrLastSuperAdmin',
    );
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports anything else to Sentry as a generic failure', () => {
    const err = new Error('boom');
    expect(deleteOwnErrorKey(err)).toBe('adminErrGeneric');
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err);
  });
});
