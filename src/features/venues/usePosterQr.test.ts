import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { toDataURL } = vi.hoisted(() => {
  const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,QR');
  return { toDataURL };
});

vi.mock('qrcode', () => ({
  default: { toDataURL },
}));

import { POSTER_QR_OPTIONS, usePosterQr } from './usePosterQr';
import { associationPosterSubject, cantonPosterSubject } from './posterSubject';
import { associationsFor } from '../associations/useAssociations';

describe('usePosterQr', () => {
  beforeEach(() => {
    toDataURL.mockClear();
    window.history.replaceState(null, '', '/?ctn=ZH');
  });

  it('builds the absolute canton permalink and requests a QR for it', async () => {
    const { result } = renderHook(() => usePosterQr(cantonPosterSubject('BE', [])));
    expect(result.current.url).toBe('http://localhost:3000/?ctn=BE');
    await waitFor(() => expect(result.current.dataUrl).toBe('data:image/png;base64,QR'));
    expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000/?ctn=BE', expect.any(Object));
  });

  it('links a Verband poster to its Verband', async () => {
    const subject = associationPosterSubject('freiburg', [], associationsFor('de'));
    const { result } = renderHook(() => usePosterQr(subject));
    expect(result.current.url).toBe('http://localhost:3000/?vb=freiburg');
    await waitFor(() => expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000/?vb=freiburg', expect.any(Object)));
  });

  it('renders the QR with the options the e2e suite compares against', async () => {
    renderHook(() => usePosterQr(cantonPosterSubject('BE', [])));
    await waitFor(() => expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000/?ctn=BE', POSTER_QR_OPTIONS));
    expect(POSTER_QR_OPTIONS).toEqual({ margin: 1, width: 240 });
  });

  it('leaves dataUrl null when QR generation rejects', async () => {
    toDataURL.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePosterQr(cantonPosterSubject('BE', [])));
    await waitFor(() => expect(toDataURL).toHaveBeenCalled());
    expect(result.current.dataUrl).toBeNull();
  });
});
