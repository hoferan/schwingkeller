import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { PosterSubject } from './posterSubject';

// The e2e suite renders its expected QR code with the same options and compares the pixels.
export const POSTER_QR_OPTIONS = { margin: 1, width: 240 } as const;

export interface PosterQr {
  url: string;
  dataUrl: string | null;
}

export const usePosterQr = (subject: PosterSubject): PosterQr => {
  const url = subject.permalink(typeof window !== 'undefined' ? window.location.href : '');
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, POSTER_QR_OPTIONS)
      .then((d) => { if (active) setDataUrl(d); })
      .catch(() => { if (active) setDataUrl(null); });
    return () => { active = false; };
  }, [url]);

  return { url, dataUrl };
};
