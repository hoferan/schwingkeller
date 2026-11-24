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
import { POSTER_QR_OPTIONS } from './posterLayout';
import { associationPosterSubject } from './posterSubject';
import { associationsFor } from '../associations/useAssociations';

const freiburg = () => associationPosterSubject('freiburg', [], associationsFor('de'));

describe('usePosterQr', () => {
  beforeEach(() => {
    toDataURL.mockClear();
    window.history.replaceState(null, '', '/?ctn=ZH');
  });

  it('builds the absolute Verband permalink and requests a QR for it', async () => {
    const { result } = renderHook(() => usePosterQr(freiburg()));
    expect(result.current.url).toBe('http://localhost:3000/?vb=freiburg');
    await waitFor(() => expect(result.current.dataUrl).toBe('data:image/png;base64,QR'));
    expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000/?vb=freiburg', expect.any(Object));
  });

  it('renders the QR with the options the e2e suite compares against', async () => {
    renderHook(() => usePosterQr(freiburg()));
    await waitFor(() => expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000/?vb=freiburg', POSTER_QR_OPTIONS));
    expect(POSTER_QR_OPTIONS).toEqual({ margin: 1, width: 240 });
  });

  it('leaves dataUrl null when QR generation rejects', async () => {
    toDataURL.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePosterQr(freiburg()));
    await waitFor(() => expect(toDataURL).toHaveBeenCalled());
    expect(result.current.dataUrl).toBeNull();
  });
});
