import { useRef, type CSSProperties } from 'react';
import type { Venue } from '../venues/types';
import { filterVenues, groupByCanton } from '../venues/grouping';
import { wappenUrl } from '../../data/cantons';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

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
  onAdd: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: (file: File) => void;
}

const sbBase: CSSProperties = { display: 'flex', flexDirection: 'column', background: '#f6edd9' };

const rowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '9px 10px 9px 12px',
  margin: '3px 0',
  borderRadius: '0 8px 8px 0',
  cursor: 'pointer',
  borderLeft: sel ? '2px solid #c0851d' : '2px solid #e6d3a3',
  background: sel ? '#fbf6ea' : 'transparent',
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
  onAdd,
  onExportJSON,
  onExportCSV,
  onImport,
}: SidebarProps) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

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
        borderTop: '1px solid #ddc9a0',
        borderRadius: '18px 18px 0 0',
        boxShadow: '0 -8px 30px rgba(40,26,10,.28)',
        transition: 'height .32s cubic-bezier(.4,0,.2,1)',
      }
    : { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid #ddc9a0' };

  return (
    <div style={sidebarStyle}>
      {isMobile && (
        <div
          onClick={onToggleSidebar}
          style={{
            padding: '9px 0 5px',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          <div style={{ width: '44px', height: '5px', borderRadius: '3px', background: '#d3bd8c' }} />
        </div>
      )}

      <div style={{ padding: '15px 15px 11px', flex: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#fff',
            border: '1px solid #e0cfa6',
            borderRadius: '24px',
            padding: '11px 16px',
          }}
        >
          <span style={{ color: '#bca673', fontSize: '15px' }}>⌕</span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t.search}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: '#3a2a18',
              width: '100%',
              minWidth: 0,
            }}
          />
          {hasSearch && (
            <button
              onClick={() => onSearch('')}
              aria-label="clear"
              style={{
                border: 'none',
                background: '#ece0c6',
                color: '#7a6342',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
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
              background: '#2e2013',
              color: '#f4ead4',
              fontWeight: 600,
              fontSize: '13px',
              padding: '10px',
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>＋</span>
            {t.add}
          </button>
          <div style={{ display: 'flex', gap: '7px' }}>
            <button
              onClick={onExportJSON}
              style={{
                flex: 1,
                border: '1px solid #d8c089',
                background: '#fbf6ea',
                color: '#5a4527',
                fontWeight: 600,
                fontSize: '11.5px',
                padding: '8px 6px',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ⤓ JSON
            </button>
            <button
              onClick={onExportCSV}
              style={{
                flex: 1,
                border: '1px solid #d8c089',
                background: '#fbf6ea',
                color: '#5a4527',
                fontWeight: 600,
                fontSize: '11.5px',
                padding: '8px 6px',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ⤓ CSV
            </button>
            <label
              style={{
                flex: 1,
                border: '1px solid #d8c089',
                background: '#fbf6ea',
                color: '#5a4527',
                fontWeight: 600,
                fontSize: '11.5px',
                padding: '8px 6px',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              ⤒ {t.import}
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
            fontFamily: "'Bitter',serif",
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#9a7c45',
            fontWeight: 700,
          }}
        >
          {t.byCanton}
        </span>
        <span style={{ fontSize: '11px', color: '#b09a6e' }}>{totalText}</span>
      </div>

      <div className="sk-scroll" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '0 14px 22px' }}>
        {groups.map((group) => {
          const exp = searching || !!expanded[group.code];
          return (
            <div key={group.code} style={{ borderBottom: '1px solid #e6d3a3' }}>
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
                    fontFamily: "'Bitter',serif",
                    fontWeight: 700,
                    color: '#2e2013',
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
                    color: '#7a5618',
                    background: '#ecd7a0',
                    padding: '2px 9px',
                    borderRadius: '20px',
                  }}
                >
                  {group.count}
                </span>
                <span style={{ color: '#b59a63', fontSize: '11px', width: '12px', textAlign: 'center' }}>
                  {exp ? '▾' : '▸'}
                </span>
              </div>
              {exp && (
                <div style={{ padding: '1px 0 9px' }}>
                  {group.venues.map((v) => (
                    <div key={v.id} onClick={() => onSelect(v.id)} style={rowStyle(v.id === selectedId)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#3a2a18',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {v.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: '#a08a64',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {townOf(v.address)}
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', color: '#c0851d', flex: 'none' }}>›</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {noResults && (
          <div style={{ padding: '34px 12px', textAlign: 'center', color: '#a08a64', fontSize: '13px' }}>
            {t.noResults}
          </div>
        )}
      </div>
    </div>
  );
};
