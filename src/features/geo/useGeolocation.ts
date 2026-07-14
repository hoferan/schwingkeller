import { useCallback, useState } from 'react';
import type { LatLng } from '../venues/distance';

export type GeoStatus = 'unsupported' | 'idle' | 'prompting' | 'granted' | 'denied' | 'error';

export interface GeoState {
  status: GeoStatus;
  position: LatLng | null;
  request: () => void;
}

const supported = (): boolean =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator && !!navigator.geolocation;

export const useGeolocation = (): GeoState => {
  const [status, setStatus] = useState<GeoStatus>(() => (supported() ? 'idle' : 'unsupported'));
  const [position, setPosition] = useState<LatLng | null>(null);

  const request = useCallback(() => {
    if (!supported()) {
      setStatus('unsupported');
      return;
    }
    setStatus('prompting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('granted');
      },
      (err) => setStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  return { status, position, request };
};
