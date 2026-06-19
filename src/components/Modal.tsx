import type { ReactNode } from 'react';

interface ModalProps { onClose: () => void; width?: number; children: ReactNode; zIndex?: number }

export const Modal = ({ onClose, width = 440, children, zIndex = 1300 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(30,20,10,.52)', zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'fadeIn .2s ease',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="sk-scroll"
      style={{
        background: '#f6edd9', borderRadius: 16, width, maxWidth: '100%', maxHeight: '92vh',
        overflow: 'auto', boxShadow: '0 26px 64px rgba(30,20,10,.5)', animation: 'popIn .26s ease',
      }}
    >
      {children}
    </div>
  </div>
);
