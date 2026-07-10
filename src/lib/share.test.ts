import { describe, it, expect, vi } from 'vitest';
import { shareVenueUrl } from './share';

describe('shareVenueUrl', () => {
  it('uses the Web Share API when available and returns "shared"', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copy = vi.fn();
    const result = await shareVenueUrl('Schwingkeller Bern', 'https://example.test/?venue=v1', { share, copy });
    expect(share).toHaveBeenCalledWith({ title: 'Schwingkeller Bern', url: 'https://example.test/?venue=v1' });
    expect(copy).not.toHaveBeenCalled();
    expect(result).toBe('shared');
  });

  it('returns "cancelled" when the user dismisses the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const copy = vi.fn();
    const result = await shareVenueUrl('Schwingkeller Bern', 'https://example.test/?venue=v1', { share, copy });
    expect(result).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });

  it('rethrows a real share failure', async () => {
    const share = vi.fn().mockRejectedValue(new Error('boom'));
    const copy = vi.fn();
    await expect(shareVenueUrl('x', 'https://example.test', { share, copy })).rejects.toThrow('boom');
  });

  it('falls back to clipboard copy when the Web Share API is unavailable, returning "copied"', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    const result = await shareVenueUrl('Schwingkeller Bern', 'https://example.test/?venue=v1', { copy });
    expect(copy).toHaveBeenCalledWith('https://example.test/?venue=v1');
    expect(result).toBe('copied');
  });

  it('rethrows a clipboard failure', async () => {
    const copy = vi.fn().mockRejectedValue(new Error('denied'));
    await expect(shareVenueUrl('x', 'https://example.test', { copy })).rejects.toThrow('denied');
  });
});
