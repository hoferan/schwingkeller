import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';

interface PosterPreviewModalProps {
  blob: Blob;
  cantonName: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

const imgStyle: CSSProperties = {
  display: 'block', width: '100%',
  borderRadius: `${theme.radius.sm} ${theme.radius.sm} 0 0`,
};

export const PosterPreviewModal = ({ blob, cantonName, onClose, onSave }: PosterPreviewModalProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    // Creating the object URL here (not in the render body) avoids leaking a URL from React
    // StrictMode's double-invoked render, and avoids recreating it on every re-render with the
    // same blob. The URL itself comes from an external system (the browser's Blob URL registry),
    // not from render-derived state — safe to setState here.
    const u = URL.createObjectURL(blob);
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  return (
    <Modal onClose={onClose} width={480}>
      <img src={url} alt={cantonName} style={imgStyle} />
      <div style={{ padding: '18px 22px' }}>
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700,
            fontSize: '18px', color: theme.color.ink,
          }}
        >
          {t.posterPreviewTitle}
        </div>
        <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
              fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.close}
          </button>
          <button
            onClick={() => onSave(blob)}
            style={{
              flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
              fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.saveImage}
          </button>
        </div>
      </div>
    </Modal>
  );
};
