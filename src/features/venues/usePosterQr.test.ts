import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { toDataURL } = vi.hoisted(() => {
  const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,QR');
  return { toDataURL };
});

vi.mock('qrcode', () => ({
  default: { toDataURL },
}));

import { usePosterQr } from './usePosterQr';

describe('usePosterQr', () => {
  beforeEach(() => {
    toDataURL.mockClear();
    window.history.replaceState(null, '', '/?ctn=ZH');
  });

  it('builds the absolute canton permalink and requests a QR for it', async () => {
    const { result } = renderHook(() => usePosterQr('BE'));
    expect(result.current.url).toBe('http://localhost:3000/?ctn=BE');
    await waitFor(() => expect(result.current.dataUrl).toBe('data:image/png;base64,QR'));
    expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000/?ctn=BE', expect.any(Object));
  });

  it('leaves dataUrl null when QR generation rejects', async () => {
    toDataURL.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePosterQr('BE'));
    await waitFor(() => expect(toDataURL).toHaveBeenCalled());
    expect(result.current.dataUrl).toBeNull();
  });
});
