import { useRef, useEffect, type CSSProperties } from 'react';
import { Search, X, ChevronRight, Plus, Download, Upload } from 'lucide-react';
import type { Venue } from '../venues/types';
import { filterVenues, groupByCanton } from '../venues/grouping';
import { wappenUrl } from '../../data/cantons';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';

interface SidebarProps {
  venues: Venue[];
  search: string;
  onSearch: (s: string) => void;
  expanded: Record<string, boolean>;
  onToggleCanton: (code: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isMobile: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSetSidebarOpen: (open: boolean) => void;
  onAdd: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: (file: File) => void;
}

const sbBase: CSSProperties = { display: 'flex', flexDirection: 'column', background: theme.color.bg };

const exportBtnStyle: CSSProperties = {
  flex: 1,
  border: '1px solid ' + theme.color.line,
  background: theme.color.bg,
  color: theme.color.ink,
  fontWeight: 600,
  fontSize: '11.5px',
  padding: '8px 6px',
  borderRadius: theme.radius.sm,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
};

const rowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '13px 14px',
  margin: '7px 0',
  borderRadius: theme.radius.sm,
  cursor: 'pointer',
  background: sel ? theme.color.paper : theme.color.bg,
  border: sel ? '1.5px solid ' + theme.color.accent : '1px solid ' + theme.color.line,
  boxShadow: sel ? theme.shadow : 'none',
});

const chevronBadgeStyle = (sel: boolean): CSSProperties => ({
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  background: sel ? theme.color.bg : theme.color.paper,
  color: theme.color.accent,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// "town" line: drop the street part of the address, fall back to full address.
const townOf = (address: string): string =>
  address.split(',').slice(1).join(',').trim() || address;

export const Sidebar = ({
  venues,
  search,
  onSearch,
  expanded,
  onToggleCanton,
  selectedId,
  onSelect,
  isMobile,
  sidebarOpen,
  onToggleSidebar,
  onSetSidebarOpen,
  onAdd,
  onExportJSON,
  onExportCSV,
  onImport,
}: SidebarProps) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    if (startY === null) return;
    // Suppress the synthetic compat click that follows a touch tap, which would otherwise double-fire onToggleSidebar via the header's onClick.
    e.preventDefault();
    const deltaY = e.changedTouches[0].clientY - startY;
    if (Math.abs(deltaY) < 10) {
      onToggleSidebar();
    } else if (deltaY <= -30) {
      onSetSidebarOpen(true);
    } else if (deltaY >= 30) {
      onSetSidebarOpen(false);
    }
  };

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onSetSidebarOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMobile, sidebarOpen, onSetSidebarOpen]);

  const list = filterVenues(venues, search);
  const groups = groupByCanton(list);
  const searching = search.trim() !== '';
  const hasSearch = search.trim() !== '';
  const noResults = list.length === 0;
  const totalText = `${list.length} ${t.unitTotal}`;

  // Mobile: bottom drawer (height toggles). Desktop/tablet: fixed-width column.
  const sidebarStyle: CSSProperties = isMobile
    ? {
        ...sbBase,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: sidebarOpen ? '80vh' : '108px',
        zIndex: 1200,
        borderTop: '1px solid ' + theme.color.line,
        borderRadius: theme.radius.sm + ' ' + theme.radius.sm + ' 0 0',
        boxShadow: theme.shadow,
        transition: 'height .32s cubic-bezier(.4,0,.2,1)',
      }
    : { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid ' + theme.color.line };

  return (
    <div ref={rootRef} style={sidebarStyle}>
      <div
        data-testid="sidebar-header"
        onClick={isMobile ? onToggleSidebar : undefined}
        onTouchStart={isMobile ? handleHeaderTouchStart : undefined}
        onTouchEnd={isMobile ? handleHeaderTouchEnd : undefined}
        style={{ cursor: isMobile ? 'pointer' : 'default' }}
      >
        {isMobile && (
          <div
            style={{
              padding: '14px 0 12px',
              display: 'flex',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <div style={{ width: '56px', height: '6px', borderRadius: theme.radius.pill, background: theme.color.ink }} />
          </div>
        )}

        <div
          style={{
            background: theme.color.ink, padding: '18px 15px', display: 'flex',
            flexDirection: 'column', gap: '10px', flex: 'none',
          }}
        >
          <span
            style={{
              fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700,
              color: theme.color.bg, fontSize: '19px', lineHeight: 1.15,
            }}
          >
            {t.searchTitle}
          </span>
          <span
            style={{
              display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.accent,
              color: theme.color.accentInk, fontFamily: theme.font.display, textTransform: 'uppercase',
              fontWeight: 700, fontSize: '12px', padding: '6px 14px', borderRadius: theme.radius.pill,
            }}
          >
            {totalText}
          </span>
        </div>
      </div>

      <div style={{ padding: '15px 15px 11px', flex: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: theme.color.bg,
            border: '1px solid ' + theme.color.line,
            borderRadius: theme.radius.sm,
            padding: '11px 16px',
          }}
        >
          <Search size={16} color={theme.color.muted} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t.search}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: theme.color.ink,
              width: '100%',
              minWidth: 0,
            }}
          />
          {hasSearch && (
            <button
              onClick={() => onSearch('')}
              aria-label="clear"
              style={{
                border: '1px solid ' + theme.color.line,
                background: theme.color.bg,
                color: theme.color.ink,
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                cursor: 'pointer',
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div
          style={{
            padding: '0 15px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flex: 'none',
          }}
        >
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              border: 'none',
              background: theme.color.accent,
              color: theme.color.accentInk,
              fontWeight: 600,
              fontSize: '13px',
              padding: '10px',
              borderRadius: theme.radius.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
            <Plus size={16} />
            {t.add}
          </button>
          <div style={{ display: 'flex', gap: '7px' }}>
            <button onClick={onExportJSON} style={exportBtnStyle}>
              <Download size={13} /> JSON
            </button>
            <button onClick={onExportCSV} style={exportBtnStyle}>
              <Download size={13} /> CSV
            </button>
            <label style={exportBtnStyle}>
              <Upload size={13} /> {t.import}
              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px 9px',
          flex: 'none',
        }}
      >
        <span
          style={{
            fontFamily: theme.font.display,
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.color.muted,
            fontWeight: 700,
          }}
        >
          {t.byCanton}
        </span>
        <span style={{ fontSize: '11px', color: theme.color.muted }}>{totalText}</span>
      </div>

      <div className="sk-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '0 14px 22px' }}>
        {groups.map((group) => {
          const exp = searching || !!expanded[group.code];
          return (
            <div key={group.code} style={{ borderBottom: '1px solid ' + theme.color.line }}>
              <div
                onClick={() => onToggleCanton(group.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 2px',
                  cursor: 'pointer',
                }}
              >
                <img
                  src={wappenUrl(group.code)}
                  alt=""
                  style={{
                    width: '21px',
                    height: '26px',
                    objectFit: 'contain',
                    flex: 'none',
                    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.25))',
                  }}
                />
                <span
                  style={{
                    fontFamily: theme.font.display,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: theme.color.ink,
                    fontSize: '15.5px',
                    flex: 1,
                  }}
                >
                  {group.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: theme.color.accentInk,
                    background: theme.color.ink,
                    padding: '2px 9px',
                    borderRadius: theme.radius.pill,
                  }}
                >
                  {group.count}
                </span>
                <span style={{ color: theme.color.ink, width: '12px', display: 'flex', justifyContent: 'center' }}>
                  <ChevronRight
                    size={12}
                    style={{ transform: exp ? 'rotate(90deg)' : 'none', transition: 'transform .2s ease' }}
                  />
                </span>
              </div>
              {exp && (
                <div style={{ padding: '1px 0 9px' }}>
                  {group.venues.map((v) => {
                    const sel = v.id === selectedId;
                    return (
                      <div key={v.id} onClick={() => onSelect(v.id)} style={rowStyle(sel)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: theme.color.ink,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {v.name}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: theme.color.muted,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {townOf(v.address)}
                          </div>
                        </div>
                        <span style={chevronBadgeStyle(sel)}><ChevronRight size={14} /></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {noResults && (
          <div style={{ padding: '34px 12px', textAlign: 'center', color: theme.color.muted, fontSize: '13px' }}>
            {t.noResults}
          </div>
        )}
      </div>
    </div>
  );
};
