import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/react', () => ({ captureException }));

import { createInvitationErrorKey, revokeInvitationErrorKey } from './invitationError';

beforeEach(() => captureException.mockReset());

describe('createInvitationErrorKey', () => {
  it.each([
    ['invalid email', 'inviteErrInvalidEmail'],
    ['email already has an account', 'inviteErrHasAccount'],
    ['an invitation for this email is open at a higher level', 'inviteErrOpenHigher'],
    ['[P0001] email already has an account', 'inviteErrHasAccount'],
    ['[42501] not authorized', 'inviteErrNotAuthorized'],
  ] as const)('maps "%s" to %s without reporting it', (message, key) => {
    expect(createInvitationErrorKey(new Error(message))).toBe(key);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([new Error('[P0001] unknown association: x'), 'not an error'])(
    'reports anything else to Sentry as a generic failure',
    (err) => {
      expect(createInvitationErrorKey(err)).toBe('adminErrGeneric');
      expect(captureException).toHaveBeenCalledTimes(1);
    },
  );
});

describe('revokeInvitationErrorKey', () => {
  it.each([
    ['[42501] not authorized', 'inviteErrRevokeNotAuthorized'],
    ['cannot revoke an invitation that is used', 'inviteErrStale'],
    ['[P0001] cannot revoke an invitation that is revoked', 'inviteErrStale'],
  ] as const)('maps "%s" to %s without reporting it', (message, key) => {
    expect(revokeInvitationErrorKey(new Error(message))).toBe(key);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([new Error('Failed to fetch'), 'not an error'])('reports anything else as generic', (err) => {
    expect(revokeInvitationErrorKey(err)).toBe('adminErrGeneric');
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
