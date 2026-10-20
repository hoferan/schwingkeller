import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';

interface ModalProps {
  onClose: () => void;
  width?: number;
  children: ReactNode;
  zIndex?: number;
  // Optional parts that stay in place while the children scroll between them, so the scrollbar
  // runs only beside the scrolling part.
  header?: ReactNode;
  footer?: ReactNode;
  // Edge to edge and full height, for long lists on a phone. `width` is ignored then.
  fullScreen?: boolean;
}

const cardStyle = (width: number, fullScreen: boolean): CSSProperties =>
  fullScreen
    ? { background: theme.color.bg, width: '100%', height: '100dvh', borderRadius: 0, animation: 'popIn .26s ease' }
    : {
        background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92dvh', animation: 'popIn .26s ease',
      };

export const Modal = ({ onClose, width = 440, children, zIndex = 1300, header, footer, fullScreen = false }: ModalProps) => {
  const framed = header !== undefined || footer !== undefined;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: fullScreen ? 0 : 16,
        animation: 'fadeIn .2s ease',
      }}
    >
      {framed ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ ...cardStyle(width, fullScreen), display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {header}
          <div className="sk-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {children}
          </div>
          {footer}
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className="sk-scroll"
          style={{ ...cardStyle(width, fullScreen), overflow: 'auto' }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
