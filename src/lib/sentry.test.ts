import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import * as SentryMod from '@sentry/react';
import { extractCode, captureAndFormat } from './sentry';

beforeEach(() => { vi.clearAllMocks(); });

describe('extractCode', () => {
  it('extracts the code from a [CODE] prefixed message', () => {
    expect(extractCode(new Error('[42883] function not found'))).toBe('42883');
  });
  it('extracts alphanumeric codes', () => {
    expect(extractCode(new Error('[PGRST202] undefined function'))).toBe('PGRST202');
  });
  it('returns null when no [CODE] prefix', () => {
    expect(extractCode(new Error('plain message'))).toBeNull();
  });
  it('returns null for non-Error values', () => {
    expect(extractCode('a string')).toBeNull();
    expect(extractCode(null)).toBeNull();
  });
});

describe('captureAndFormat', () => {
  it('calls Sentry.captureException with the error', () => {
    const err = new Error('[42883] boom');
    captureAndFormat(err, 'Import fehlgeschlagen');
    expect(SentryMod.captureException).toHaveBeenCalledWith(err);
  });
  it('returns fallback with code appended when code is present', () => {
    const result = captureAndFormat(new Error('[42883] boom'), 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen [42883]');
  });
  it('returns fallback only when no code in message', () => {
    const result = captureAndFormat(new Error('plain boom'), 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen');
  });
  it('handles non-Error values without throwing', () => {
    const result = captureAndFormat('a string', 'Import fehlgeschlagen');
    expect(result).toBe('Import fehlgeschlagen');
  });
});
