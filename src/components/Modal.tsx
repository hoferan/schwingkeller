import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
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
  // The id of the element that names the dialog, usually its title.
  labelledBy?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const cardStyle = (width: number, fullScreen: boolean): CSSProperties =>
  fullScreen
    ? { background: theme.color.bg, width: '100%', height: '100dvh', borderRadius: 0, animation: 'popIn .26s ease' }
    : {
        background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92dvh', animation: 'popIn .26s ease',
      };

export const Modal = ({
  onClose, width = 440, children, zIndex = 1300, header, footer, fullScreen = false, labelledBy,
}: ModalProps) => {
  const framed = header !== undefined || footer !== undefined;
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus goes into the dialog when it opens, unless a child already took it (autoFocus), and back
  // to where it was when the dialog closes.
  useEffect(() => {
    const before = document.activeElement;
    const card = cardRef.current;
    if (card && !card.contains(document.activeElement)) card.focus();
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);

  // Escape does what a click on the backdrop does. Tab and Shift+Tab wrap around inside the dialog,
  // so the page behind it can't be reached. Handled here rather than on the document, so that only
  // the topmost of two nested dialogs reacts.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !cardRef.current) return;
    const focusable = [...cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const dialogProps = {
    ref: cardRef,
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': labelledBy,
    tabIndex: -1,
    onKeyDown,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  } as const;
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
          {...dialogProps}
          style={{
            ...cardStyle(width, fullScreen), display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none',
          }}
        >
          {header}
          <div className="sk-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {children}
          </div>
          {footer}
        </div>
      ) : (
        <div
          {...dialogProps}
          className="sk-scroll"
          style={{ ...cardStyle(width, fullScreen), overflow: 'auto', outline: 'none' }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
