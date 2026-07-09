import type { ReactNode } from 'react';
import { theme } from '../theme';

interface ModalProps { onClose: () => void; width?: number; children: ReactNode; zIndex?: number }

export const Modal = ({ onClose, width = 440, children, zIndex = 1300 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'fadeIn .2s ease',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="sk-scroll"
      style={{
        background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92dvh', overflow: 'auto', animation: 'popIn .26s ease',
      }}
    >
      {children}
    </div>
  </div>
);
