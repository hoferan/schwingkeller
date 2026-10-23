import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { theme } from '../theme';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  onSelect: () => void;
}

export interface DropdownMenuProps {
  // The button's accessible name.
  label: string;
  // What the button shows.
  button: ReactNode;
  // The caller styles the button, so it can follow the top bar's colours.
  buttonStyle: CSSProperties;
  // Information above the items. It can't be focused or chosen.
  header?: ReactNode;
  // Item groups in order, with a line between them.
  sections: MenuItem[][];
}

const itemStyle = (tone: MenuItem['tone']): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
  border: 'none', background: 'transparent', cursor: 'pointer', padding: '11px 14px',
  fontSize: '14px', fontWeight: 600, color: tone === 'danger' ? theme.color.accent : theme.color.ink,
});

// A button that opens a list of actions, following the WAI-ARIA menu button pattern: arrow keys,
// Home and End move between items, Escape closes and returns to the button. Callers pass the items
// as data, so a new entry is one more item rather than new markup.
export const DropdownMenu = ({ label, button, buttonStyle, header, sections }: DropdownMenuProps) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const headerId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const items = sections.flat();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    // In the capture phase, because Leaflet's controls and popups stop pointer events from bubbling.
    // Pointer events cover touch as well.
    const onPointerDown = (e: Event) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (item: MenuItem) => {
    close();
    item.onSelect();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const last = items.length - 1;
    const target =
      e.key === 'ArrowDown' ? (current + 1) % items.length
        : e.key === 'ArrowUp' ? (current - 1 + items.length) % items.length
          : e.key === 'Home' ? 0
            : e.key === 'End' ? last
              : null;
    if (target !== null) {
      e.preventDefault();
      itemRefs.current[target]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  let index = 0;
  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 'none' }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        style={buttonStyle}
      >
        {button}
      </button>
      {open && (
        <div
          onKeyDown={onKeyDown}
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 230, maxWidth: 'calc(100vw - 24px)',
            background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
            boxShadow: theme.shadow, overflow: 'hidden', zIndex: 1200,
          }}
        >
          {header && (
            <div id={headerId} style={{ padding: '12px 14px', borderBottom: '1px solid ' + theme.color.line }}>
              {header}
            </div>
          )}
          <div id={menuId} role="menu" aria-label={label} aria-describedby={header ? headerId : undefined}>
            {sections.map((section, s) => (
              <Fragment key={s}>
                {s > 0 && <div role="separator" style={{ borderTop: '1px solid ' + theme.color.line }} />}
                {section.map((item) => {
                  const i = index++;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => { itemRefs.current[i] = el; }}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => choose(item)}
                      style={itemStyle(item.tone)}
                    >
                      {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                      {item.label}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
