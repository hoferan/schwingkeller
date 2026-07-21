import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { withCantonParam } from '../../lib/permalink';

export interface PosterQr {
  url: string;
  dataUrl: string | null;
}

export const usePosterQr = (code: string): PosterQr => {
  const url = withCantonParam(
    typeof window !== 'undefined' ? window.location.href : '',
    code,
  );
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
