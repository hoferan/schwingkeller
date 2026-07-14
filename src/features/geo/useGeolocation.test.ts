import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

afterEach(() => vi.unstubAllGlobals());

const stubGeo = (impl: Partial<Geolocation>) =>
  vi.stubGlobal('navigator', { geolocation: impl });

describe('useGeolocation', () => {
  it('reports unsupported when the API is absent', () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('unsupported');
  });

  it('does not request a position on mount', () => {
    const getCurrentPosition = vi.fn();
    stubGeo({ getCurrentPosition });
    renderHook(() => useGeolocation());
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('transitions to granted with a position on success', () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 46.9, longitude: 7.4 } } as GeolocationPosition),
    );
    stubGeo({ getCurrentPosition });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.status).toBe('granted');
    expect(result.current.position).toEqual({ lat: 46.9, lng: 7.4 });
  });

  it('transitions to denied on permission error (code 1)', () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, err?: PositionErrorCallback) =>
      err?.({ code: 1 } as GeolocationPositionError),
    );
    stubGeo({ getCurrentPosition });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.status).toBe('denied');
  });

  it('transitions to error on non-permission failure', () => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, err?: PositionErrorCallback) =>
      err?.({ code: 3 } as GeolocationPositionError),
    );
    stubGeo({ getCurrentPosition });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.status).toBe('error');
  });
});
