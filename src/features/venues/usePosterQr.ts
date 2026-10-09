import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { PosterSubject } from './posterSubject';

export interface PosterQr {
  url: string;
  dataUrl: string | null;
}

export const usePosterQr = (subject: PosterSubject): PosterQr => {
  const url = subject.permalink(typeof window !== 'undefined' ? window.location.href : '');
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then((d) => { if (active) setDataUrl(d); })
      .catch(() => { if (active) setDataUrl(null); });
    return () => { active = false; };
  }, [url]);

  return { url, dataUrl };
};
