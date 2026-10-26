import { describe, it, expect, vi, beforeEach } from 'vitest';

const { from, rpc, calls, state } = vi.hoisted(() => {
  const calls: [string, ...unknown[]][] = [];
  const state: { result: unknown } = { result: { data: [], error: null } };
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'order']) {
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

import { extractCode } from '../../lib/sentry';
import {
  INVITATION_DAYS,
  createInvitation,
  fetchInvitations,
  invitationLink,
  isExpired,
  revokeInvitation,
} from './invitations';

beforeEach(() => {
  calls.length = 0;
  state.result = { data: [], error: null };
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

describe('fetchInvitations', () => {
  it('reads the open invitations, newest first', async () => {
    const row = { id: 'i1', email: 'a@b.ch' };
    state.result = { data: [row], error: null };
    await expect(fetchInvitations()).resolves.toEqual([row]);
    expect(calls).toEqual([
      ['from', 'invitations'],
      ['select', 'id,email,association_id,invited_by,created_at,expires_at'],
      ['order', 'created_at', { ascending: false }],
    ]);
  });

  it('rejects with the database error', async () => {
    state.result = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    const err = await fetchInvitations().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(extractCode(err)).toBe('PGRST301');
  });
});

describe('createInvitation', () => {
  it('resolves to the token the RPC returns', async () => {
    rpc.mockResolvedValue({ data: 'tok-1', error: null });
    await expect(createInvitation('a@b.ch', 'emmental')).resolves.toBe('tok-1');
    expect(rpc).toHaveBeenCalledWith('create_invitation', { target_email: 'a@b.ch', scope: 'emmental' });
  });

  it('rejects with an error that carries the Postgres code', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not authorized' } });
    const err = await createInvitation('a@b.ch', 'emmental').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(extractCode(err)).toBe('42501');
  });
});

describe('revokeInvitation', () => {
  it('calls the RPC with the invitation id', async () => {
    await revokeInvitation('i1');
    expect(rpc).toHaveBeenCalledWith('revoke_invitation', { invitation_id: 'i1' });
  });

  it('rejects with an error that carries the Postgres code', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not authorized' } });
    const err = await revokeInvitation('i1').catch((e: unknown) => e);
    expect(extractCode(err)).toBe('42501');
  });
});

describe('isExpired', () => {
  const inv = { expires_at: '2026-11-02T10:00:00Z' };

  it('is true at the expiry instant', () => {
    expect(isExpired(inv, new Date('2026-11-02T10:00:00Z'))).toBe(true);
  });

  it('is false one millisecond earlier', () => {
    expect(isExpired(inv, new Date('2026-11-02T09:59:59.999Z'))).toBe(false);
  });
});

describe('invitationLink', () => {
  it('puts the token in the invite parameter', () => {
    expect(invitationLink('https://x.ch', 'a-b_c')).toBe('https://x.ch/?invite=a-b_c');
  });

  it('encodes characters that are not URL-safe', () => {
    expect(invitationLink('https://x.ch', 'a b&c')).toBe('https://x.ch/?invite=a%20b%26c');
  });
});

describe('INVITATION_DAYS', () => {
  it('is one week', () => {
    expect(INVITATION_DAYS).toBe(7);
  });
});
