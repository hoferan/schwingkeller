import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/react', () => ({ captureException }));

import { adminErrorKey } from './adminError';

beforeEach(() => captureException.mockReset());

describe('adminErrorKey', () => {
  it.each([
    ['[42501] not authorized', 'adminErrNotAuthorized'],
    ['[P0001] cannot approve an account that is approved', 'adminErrStale'],
    ['[P0001] cannot reject an account that is rejected', 'adminErrStale'],
    ['[P0001] cannot remove the last super-admin', 'adminErrLastSuperAdmin'],
    ['[P0001] cannot delete the last super-admin', 'adminErrLastSuperAdmin'],
    ['[P0001] cannot suspend an account that is suspended', 'adminErrStale'],
    ['[P0002] account not found', 'adminErrStale'],
  ] as const)('maps "%s" to %s without reporting it', (message, key) => {
    expect(adminErrorKey(new Error(message))).toBe(key);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([new Error('[P0001] unknown association: x'), new Error('Failed to fetch'), 'not an error'])(
    'reports anything else to Sentry as a generic failure',
    (err) => {
      expect(adminErrorKey(err)).toBe('adminErrGeneric');
      expect(captureException).toHaveBeenCalledWith(err);
    },
  );
});
