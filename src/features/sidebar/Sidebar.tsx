import { useRef, useEffect, useState, type CSSProperties } from 'react';
import { Search, X, ChevronRight, ChevronLeft, Plus, Download, Upload, Home, Mountain } from 'lucide-react';
import type { Venue } from '../venues/types';
import { filterVenues, groupByCanton, flatSorted, type SortMode, type Facets } from '../venues/grouping';
import { haversineKm, formatDistance, type LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';
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
  isTablet: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSetSidebarOpen: (open: boolean) => void;
  onAdd: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: (file: File) => void;
  sortMode: SortMode;
  onSortMode: (m: SortMode) => void;
  userPosition: LatLng | null;
  geoStatus: GeoStatus;
  onRequestLocation: () => void;
}

const sbBase: CSSProperties = { display: 'flex', flexDirection: 'column', background: theme.color.bg };
// Handle zone (8px+4px+8px = 20px) + header block (18px padding top/bottom = 36px, + 19px/1.15
// title line ≈ 21.85px, + 10px gap, + 12px/"normal" count-pill line + 12px padding ≈ 26.4px)
// ≈ 114px, rounded up to 116px so the whole handle+header block never clips (issue #8: the old
// 108px value was shorter than the actual rendered block, so the header's bottom edge was cut off).
const PEEK_HEIGHT = 116;
// Matches the desktop sidebar's fixed column width — the tablet/landscape overlay panel uses the
// same width, just slid off-screen via `left` instead of removed from flow (issue #8).
const TABLET_PANEL_WIDTH = 344;

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

const distanceBadgeStyle: CSSProperties = {
  flex: 'none',
  fontSize: '11px',
  fontWeight: 700,
  color: theme.color.accentInk,
  background: theme.color.ink,
  padding: '2px 9px',
  borderRadius: theme.radius.pill,
  whiteSpace: 'nowrap',
};

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
  isTablet,
  sidebarOpen,
  onToggleSidebar,
  onSetSidebarOpen,
  onAdd,
  onExportJSON,
  onExportCSV,
  onImport,
  sortMode,
  onSortMode,
  userPosition,
  geoStatus,
  onRequestLocation,
}: SidebarProps) => {
  const { t, lang } = useTranslation();
  const { isAdmin } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef<number | null>(null);
  const dragHeightRef = useRef<number | null>(null);
  const openHeightPxRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startedOnHeaderRef = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  // Tablet/landscape panel's horizontal drag state — same model as the mobile sheet's vertical
  // drag above, just re-oriented to `left`/clientX instead of `height`/clientY (issue #8).
  const touchStartXRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragXRef = useRef<number | null>(null);
  const tabletDraggingRef = useRef(false);
  const startedOnDragZoneRef = useRef(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [facets, setFacets] = useState<Facets>({ indoor: false, outdoor: false });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.touches[0].clientY;
    openHeightPxRef.current = window.innerHeight * 0.8;
    dragStartHeightRef.current = sidebarOpen ? openHeightPxRef.current : PEEK_HEIGHT;
    startedOnHeaderRef.current = !!(headerRef.current && headerRef.current.contains(e.target as Node));
    isDraggingRef.current = false;
    dragHeightRef.current = null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const wasDragging = isDraggingRef.current;
    touchStartYRef.current = null;
    isDraggingRef.current = false;
    if (startY === null) return;

    if (!wasDragging) {
      // Never became a drag — either a pass-through list scroll, or too small to classify.
      if (startedOnHeaderRef.current) {
        const deltaY = e.changedTouches[0].clientY - startY;
        if (Math.abs(deltaY) < 10) {
          // Suppress the synthetic compat click that follows a touch tap, which would otherwise
          // double-fire onToggleSidebar via the header's onClick.
          e.preventDefault();
          onToggleSidebar();
        }
      }
      return;
    }

    // Snap relative to how far the drag travelled from its OWN starting point, not the sheet's
    // absolute midpoint — the peek-to-open range is large (~500px+), so an absolute-midpoint snap
    // would require a much heavier drag than the old ±30px swipe to ever flip state.
    // Read the ref, not the `dragHeight` state: the state is written from a native touchmove
    // listener and may not have flushed to a re-render yet by the time touchend fires, so it can
    // be one or more moves stale relative to the finger's actual final position.
    const finalHeight = dragHeightRef.current ?? dragStartHeightRef.current!;
    const range = openHeightPxRef.current - PEEK_HEIGHT;
    const travelled = finalHeight - dragStartHeightRef.current!;
    setDragHeight(null);
    dragHeightRef.current = null;
    if (travelled > range * 0.25) {
      onSetSidebarOpen(true);
    } else if (travelled < -range * 0.25) {
      onSetSidebarOpen(false);
    } else {
      onSetSidebarOpen(sidebarOpen);
    }
  };

  // The browser can interrupt a touch mid-gesture (edge-swipe navigation, incoming call), firing
  // touchcancel instead of touchend. Reset the gesture refs so the sheet animates back to its
  // current sidebarOpen state instead of freezing at whatever height the last touchmove left it —
  // no snap decision here, since the gesture was aborted rather than released.
  const handleTouchCancel = () => {
    touchStartYRef.current = null;
    isDraggingRef.current = false;
    dragHeightRef.current = null;
    setDragHeight(null);
  };

  const handleTabletTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0].clientX;
    dragStartXRef.current = sidebarOpen ? 0 : -TABLET_PANEL_WIDTH;
    startedOnDragZoneRef.current = !!(
      (headerRef.current && headerRef.current.contains(e.target as Node)) ||
      (tabRef.current && tabRef.current.contains(e.target as Node))
    );
    tabletDraggingRef.current = false;
    dragXRef.current = null;
  };

  const handleTabletTouchEnd = () => {
    const wasDragging = tabletDraggingRef.current;
    touchStartXRef.current = null;
    tabletDraggingRef.current = false;
    startedOnDragZoneRef.current = false;
    // A non-dragging touch on the tab is a real tap — the tab's own onClick handles that. A
    // non-dragging touch on the header (no click target there) is simply ignored, same as mobile
    // ignores a non-header, non-dragging touch.
    if (!wasDragging) return;

    const finalX = dragXRef.current ?? dragStartXRef.current!;
    const travelled = finalX - dragStartXRef.current!;
    setDragX(null);
    dragXRef.current = null;
    if (travelled > TABLET_PANEL_WIDTH * 0.25) {
      onSetSidebarOpen(true);
    } else if (travelled < -TABLET_PANEL_WIDTH * 0.25) {
      onSetSidebarOpen(false);
    } else {
      onSetSidebarOpen(sidebarOpen);
    }
  };

  const handleTabletTouchCancel = () => {
    touchStartXRef.current = null;
    tabletDraggingRef.current = false;
    startedOnDragZoneRef.current = false;
    dragXRef.current = null;
    setDragX(null);
  };

  // Native (non-passive) listener for the same reason the mobile drag effect below uses one:
  // JSX's onTouchMove is passive by default, which silently no-ops preventDefault().
  useEffect(() => {
    if (!isTablet) return;
    const root = rootRef.current;
    if (!root) return;

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartXRef.current === null || !startedOnDragZoneRef.current) return;
      const deltaX = e.touches[0].clientX - touchStartXRef.current;

      if (!tabletDraggingRef.current) {
        if (Math.abs(deltaX) <= 8) return; // sub-slop jitter — still a potential tap
        tabletDraggingRef.current = true;
      }

      e.preventDefault();
      const newX = dragStartXRef.current! + deltaX;
      const clamped = Math.min(0, Math.max(-TABLET_PANEL_WIDTH, newX));
      dragXRef.current = clamped;
      setDragX(clamped);
    };

    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => root.removeEventListener('touchmove', onTouchMove);
  }, [isTablet]);

  // Continuous drag tracking. Attached natively (not as a JSX onTouchMove prop) because React
  // registers JSX touchmove listeners as passive by default, which silently makes
  // preventDefault() inside them a no-op — blocking native scroll while dragging requires the
  // { passive: false } form, which JSX doesn't expose.
  useEffect(() => {
    if (!isMobile) return;
    const root = rootRef.current;
    if (!root) return;

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const deltaY = e.touches[0].clientY - touchStartYRef.current;

      if (!isDraggingRef.current) {
        if (startedOnHeaderRef.current || !sidebarOpen) {
          if (Math.abs(deltaY) <= 8) return; // sub-slop jitter — still a potential tap, don't classify yet
          isDraggingRef.current = true;
        } else {
          const list = listRef.current;
          const atTop = !list || list.scrollTop <= 0;
          if (atTop && deltaY > 5) {
            isDraggingRef.current = true;
          } else {
            return;
          }
        }
      }

      e.preventDefault();
      const newHeight = dragStartHeightRef.current! - deltaY;
      const clamped = Math.min(openHeightPxRef.current, Math.max(PEEK_HEIGHT, newHeight));
      dragHeightRef.current = clamped;
      setDragHeight(clamped);
    };

    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => root.removeEventListener('touchmove', onTouchMove);
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!(isMobile || isTablet) || !sidebarOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onSetSidebarOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMobile, isTablet, sidebarOpen, onSetSidebarOpen]);

  const list = filterVenues(venues, search, facets);
  const searching = search.trim() !== '';
  const filtering = searching || facets.indoor || facets.outdoor;
  const groups = groupByCanton(list, !filtering);
  const hasSearch = search.trim() !== '';
  const noResults = filtering && list.length === 0;
  const totalText = `${list.length} ${t.unitTotal}`;
  const flat = sortMode !== 'canton';
  const flatList = flat ? flatSorted(list, sortMode, userPosition) : [];
  const sectionLabel = sortMode === 'name' ? t.byName : sortMode === 'distance' ? t.byDistance : t.byCanton;

  // Mobile: bottom drawer, free-dragged while dragHeight is set, snapped to peek/open otherwise.
  // Desktop/tablet: fixed-width column.
  const sidebarStyle: CSSProperties = isMobile
    ? {
        ...sbBase,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: dragHeight !== null ? `${dragHeight}px` : sidebarOpen ? '80vh' : `${PEEK_HEIGHT}px`,
        zIndex: 1200,
        borderTop: '1px solid ' + theme.color.line,
        borderRadius: theme.radius.sm + ' ' + theme.radius.sm + ' 0 0',
        boxShadow: theme.shadow,
        transition: dragHeight !== null ? 'none' : 'height .32s cubic-bezier(.4,0,.2,1)',
      }
    : isTablet
    ? {
        ...sbBase,
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${dragX !== null ? dragX : sidebarOpen ? 0 : -TABLET_PANEL_WIDTH}px`,
        width: `${TABLET_PANEL_WIDTH}px`,
        zIndex: 1200,
        borderRight: '1px solid ' + theme.color.line,
        boxShadow: theme.shadow,
        transition: dragX !== null ? 'none' : 'left .28s cubic-bezier(.4,0,.2,1)',
      }
    : { ...sbBase, width: '344px', flex: 'none', minHeight: 0, borderRight: '1px solid ' + theme.color.line };

  return (
    <div
      ref={rootRef}
      data-testid="sidebar-root"
      style={sidebarStyle}
      onTouchStart={isMobile ? handleTouchStart : isTablet ? handleTabletTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : isTablet ? handleTabletTouchEnd : undefined}
      onTouchCancel={isMobile ? handleTouchCancel : isTablet ? handleTabletTouchCancel : undefined}
    >
      {isTablet && (
        <button
          ref={tabRef}
          type="button"
          data-testid="sidebar-tablet-tab"
          onClick={onToggleSidebar}
          title={sidebarOpen ? t.collapseSidebar : t.expandSidebar}
          aria-label={sidebarOpen ? t.collapseSidebar : t.expandSidebar}
          style={{
            position: 'absolute', top: '50%', left: `${TABLET_PANEL_WIDTH}px`, transform: 'translateY(-50%)',
            width: '28px', height: '56px', border: 'none',
            borderRadius: '0 ' + theme.radius.sm + ' ' + theme.radius.sm + ' 0',
            background: theme.color.bg, boxShadow: theme.shadow, color: theme.color.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1200,
          }}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      )}
      <div
        ref={headerRef}
        data-testid="sidebar-header"
        onClick={isMobile ? onToggleSidebar : undefined}
        style={{ cursor: isMobile ? 'pointer' : 'default' }}
      >
        {isMobile && (
          <div
            style={{
              padding: '8px 0 8px',
              display: 'flex',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <div style={{ width: '40px', height: '4px', borderRadius: theme.radius.pill, background: theme.color.ink }} />
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

      <div style={{ padding: '0 15px 11px', flex: 'none', display: 'flex', gap: '8px' }}>
        {([
          { key: 'indoor', label: t.indoor, Icon: Home },
          { key: 'outdoor', label: t.outdoor, Icon: Mountain },
        ] satisfies { key: keyof Facets; label: string; Icon: typeof Home }[]).map(({ key, label, Icon }) => {
          const active = facets[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFacets((f) => ({ ...f, [key]: !f[key] }))}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: '1px solid ' + (active ? theme.color.accent : theme.color.line),
                background: active ? theme.color.accent : theme.color.bg,
                color: active ? theme.color.accentInk : theme.color.ink,
                fontWeight: 600,
                fontSize: '12.5px',
                padding: '9px 8px',
                borderRadius: theme.radius.sm,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} aria-hidden /> {label}
            </button>
          );
        })}
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

      <div style={{ padding: '0 15px 10px', flex: 'none' }} role="radiogroup" aria-label={t.sortBy}>
        <div style={{ display: 'flex', gap: '2px', background: theme.color.paper, padding: '4px', borderRadius: theme.radius.pill }}>
          {([['canton', t.sortCanton], ['name', t.sortName], ['distance', t.sortDistance]] as const)
            .filter(([mode]) => !(mode === 'distance' && geoStatus === 'unsupported'))
            .map(([mode, label]) => {
              const active = sortMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={mode === 'distance' ? t.useMyLocation : undefined}
                  onClick={() => {
                    onSortMode(mode);
                    if (mode === 'distance' && !userPosition) onRequestLocation();
                  }}
                  style={{
                    flex: 1, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    lineHeight: '1', padding: '7px 8px', borderRadius: theme.radius.pill,
                    background: active ? theme.color.accent : 'transparent',
                    color: active ? theme.color.accentInk : theme.color.muted,
                  }}
                >
                  {label}
                </button>
              );
            })}
        </div>
      </div>

      <div style={{ padding: '0 18px 9px', flex: 'none' }}>
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
          {sectionLabel}
        </span>
      </div>

      <div
        ref={listRef}
        data-testid="sidebar-list"
        className="sk-scroll"
        style={{ flex: '1 1 auto', overflowY: 'auto', padding: '0 14px 22px' }}
      >
        {!flat && groups.map((group) => {
          const exp = filtering || !!expanded[group.code];
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
                  {group.venues.length === 0 ? (
                    <div
                      style={{
                        padding: '10px 12px 14px',
                        color: theme.color.muted,
                        fontSize: '12.5px',
                        lineHeight: 1.5,
                      }}
                    >
                      {t.cantonEmpty}
                    </div>
                  ) : (
                    group.venues.map((v) => {
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
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
        {flat &&
          flatList.map((v) => {
            const sel = v.id === selectedId;
            return (
              <div key={v.id} onClick={() => onSelect(v.id)} style={rowStyle(sel)}>
                <img
                  src={wappenUrl(v.canton)}
                  alt=""
                  style={{ width: '16px', height: '20px', objectFit: 'contain', flex: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.25))' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: theme.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {townOf(v.address)}
                  </div>
                </div>
                {sortMode === 'distance' && userPosition && (
                  <span style={distanceBadgeStyle}>{formatDistance(haversineKm(userPosition, v), lang)}</span>
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
