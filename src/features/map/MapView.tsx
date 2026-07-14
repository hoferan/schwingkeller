import { useEffect, useRef, useState, type CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { Maximize, LocateFixed } from 'lucide-react';
import type { Venue } from '../venues/types';
import { useTranslation } from '../../i18n/useTranslation';
import { pinHtml, popupHtml, clusterIcon, userPinHtml } from './markers';
import type { LatLng } from '../venues/distance';
import type { GeoStatus } from '../geo/useGeolocation';
import { theme } from '../../theme';

interface MapViewProps {
  venues: Venue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
  baseKind: 'map' | 'sat';
  onChangeBase: (k: 'map' | 'sat') => void;
  placing: boolean;
  onPickLocation: (lat: number, lng: number) => void;
  registerFitAll?: (fn: () => void) => void;
  initialFocusBounds?: [[number, number], [number, number]] | null;
  userPosition: LatLng | null;
  geoStatus: GeoStatus;
  onRequestLocation: () => void;
}

const wrapStyle: CSSProperties = { position: 'relative', flex: 1, height: '100%' };
const mapElStyle: CSSProperties = { position: 'absolute', inset: 0 };
const overlayStyle: CSSProperties = {
  position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
};
// Mirrors Leaflet's own .leaflet-bar control look (leaflet/dist/leaflet.css), not the app's
// soft-card theme tokens — the goal here is to blend in with the native zoom control.
//
// The border and background-clip are deliberately NOT hardcoded here. Leaflet's real rule is
// `.leaflet-touch .leaflet-bar { background-clip: padding-box; border: 2px solid #0003; }` —
// the padding-box clip means the translucent border is painted over whatever's BEHIND the
// control (the map), not over the control's own background. A border-only mirror (matching
// width/style/color but leaving background-clip at its `border-box` default) still renders
// wrong: our white background would paint straight through to the outer edge, so the same
// translucent color blends with opaque white instead of the map, reading visibly darker (see
// issues #8 and #21 — the second of which survived an earlier border-only fix because
// background-clip wasn't part of what was compared). So both are read at runtime from the real
// native zoom control via getComputedStyle (see the map-init effect below) and passed into
// fitAllWrapStyle, so the two controls match by construction — regardless of Leaflet version,
// browser rendering, or device pixel ratio.
const nativeCtrlStyle: CSSProperties = {
  background: '#fff', borderRadius: '4px', overflow: 'hidden',
};
// Matches the Topbar's DE/FR/IT language-switcher pill construction exactly, for visual consistency.
const baseToggleWrapStyle: CSSProperties = {
  display: 'flex', gap: '2px', background: theme.color.paper,
  padding: '4px', borderRadius: theme.radius.pill, flex: 'none',
};
const baseToggleBtnStyle = (active: boolean): CSSProperties => ({
  background: active ? theme.color.accent : 'transparent',
  color: active ? theme.color.accentInk : theme.color.muted,
  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
  lineHeight: '1', padding: '6px 10px', borderRadius: theme.radius.pill,
});
// Defaults before the real zoom-control is measured (see the mount effect):
// - top/size: 10px (Leaflet's own top-control margin) + 26px (default non-touch zoom-control
//   height) + 10px (gap).
// - border/backgroundClip: today's best-known values, used only until the real control's
//   computed style loads.
const FIT_ALL_DEFAULT_TOP = 46;
const FIT_ALL_DEFAULT_SIZE = 30;
const FIT_ALL_DEFAULT_BORDER = '2px solid rgba(0,0,0,.2)';
const FIT_ALL_DEFAULT_BG_CLIP = 'padding-box';
const fitAllWrapStyle = (top: number, size: number, border: string, backgroundClip: string): CSSProperties => ({
  ...nativeCtrlStyle, position: 'absolute', left: '10px', top: `${top}px`,
  width: `${size}px`, height: `${size}px`, border, backgroundClip, zIndex: 1000,
});
const fitAllBtnStyle: CSSProperties = {
  width: '100%', height: '100%', border: 'none', background: 'transparent',
  color: theme.color.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export function MapView({
  venues, selectedId, onSelect, onOpenDetail,
  baseKind, onChangeBase, placing, onPickLocation, registerFitAll, initialFocusBounds,
  userPosition, geoStatus, onRequestLocation,
}: MapViewProps) {
  const { t } = useTranslation();
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerGroupRef = useRef<any>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const tileRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [fitAllTop, setFitAllTop] = useState(FIT_ALL_DEFAULT_TOP);
  const [fitAllSize, setFitAllSize] = useState(FIT_ALL_DEFAULT_SIZE);
  const [fitAllBorder, setFitAllBorder] = useState(FIT_ALL_DEFAULT_BORDER);
  const [fitAllBgClip, setFitAllBgClip] = useState(FIT_ALL_DEFAULT_BG_CLIP);
  const appliedInitialFocusRef = useRef(false);

  // Latest-value refs so the imperative map callbacks (bound once) see fresh props.
  const venuesRef = useRef(venues);
  const selectedIdRef = useRef(selectedId);
  const placingRef = useRef(placing);
  const onSelectRef = useRef(onSelect);
  const onOpenDetailRef = useRef(onOpenDetail);
  const onPickLocationRef = useRef(onPickLocation);
  const tRef = useRef(t);
  useEffect(() => {
    venuesRef.current = venues;
    selectedIdRef.current = selectedId;
    placingRef.current = placing;
    onSelectRef.current = onSelect;
    onOpenDetailRef.current = onOpenDetail;
    onPickLocationRef.current = onPickLocation;
    tRef.current = t;
  });

  const setTile = (kind: 'map' | 'sat') => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    if (kind === 'sat') {
      tileRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 18 });
      tileRef.current.addTo(map); tileRef.current.bringToBack();
    } else {
      tileRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 });
      tileRef.current.addTo(map); tileRef.current.bringToBack();
    }
    const pane = map.getPane('tilePane'); if (pane) pane.style.filter = 'none';
  };

  const refreshMarkers = () => {
    const map = mapRef.current; const group = markerGroupRef.current;
    if (!group || !map) return;
    const sz = map.getSize ? map.getSize() : null;
    if (sz && (sz.x <= 0 || sz.y <= 0)) { window.setTimeout(refreshMarkers, 120); return; }
    group.clearLayers(); markersRef.current = {};
    venuesRef.current.forEach((v) => {
      const icon = L.divIcon({ className: '', html: pinHtml(v.id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] });
      const m = L.marker([v.lat, v.lng], { icon }).addTo(group);
      m.bindPopup(popupHtml(v, tRef.current), { maxWidth: 240, minWidth: 222, closeButton: true });
      m.on('click', () => onSelectRef.current(v.id));
      markersRef.current[v.id] = m;
    });
  };

  const updatePins = () => {
    Object.keys(markersRef.current).forEach((id) => {
      markersRef.current[id].setIcon(L.divIcon({ className: '', html: pinHtml(id === selectedIdRef.current), iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -20] }));
    });
  };

  const focusVenue = (id: string) => {
    const map = mapRef.current; const m = markersRef.current[id];
    if (!m || !map) return;
    const mx = map.getMaxZoom ? map.getMaxZoom() : 17;
    const z = Math.min(mx, Math.max(map.getZoom() + 4, 16));
    map.flyTo(m.getLatLng(), z, { duration: 0.8 });
    window.setTimeout(() => { const mm = markersRef.current[id]; if (mm) mm.openPopup(); }, 880);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onClusterClick = (a: any) => {
    const map = mapRef.current;
    const cluster = a.layer || a.propagatedFrom;
    if (!cluster || !map) return;
    const mx = map.getMaxZoom ? map.getMaxZoom() : 17;
    let pts: number[][] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pts = (cluster.getAllChildMarkers ? cluster.getAllChildMarkers() : []).map((m: any) => { const ll = m.getLatLng(); return [ll.lat, ll.lng]; }).filter((p: number[]) => isFinite(p[0]) && isFinite(p[1]));
    } catch { /* ignore */ }
    if (pts.length > 1) {
      const spread = pts.some((p) => Math.abs(p[0] - pts[0][0]) > 1e-5 || Math.abs(p[1] - pts[0][1]) > 1e-5);
      if (spread) { map.flyToBounds(pts as L.LatLngBoundsExpression, { padding: [60, 60], maxZoom: 16, duration: 0.6 }); return; }
      if (cluster.spiderfy) { map.setView(pts[0] as L.LatLngExpression, Math.min(mx, map.getZoom() + 2), { animate: true }); window.setTimeout(() => { try { cluster.spiderfy(); } catch { /* ignore */ } }, 420); return; }
    }
    let ll: L.LatLng | undefined; try { ll = cluster.getLatLng(); } catch { /* ignore */ }
    map.flyTo(ll ? [ll.lat, ll.lng] : map.getCenter(), Math.min(mx, map.getZoom() + 3), { duration: 0.6 });
  };

  const onMapClick = (e: L.LeafletMouseEvent) => {
    if (!placingRef.current) return;
    const lat = +e.latlng.lat.toFixed(5);
    const lng = +e.latlng.lng.toFixed(5);
    onPickLocationRef.current(lat, lng);
  };

  const onPopupOpen = (e: L.PopupEvent) => {
    const el = e.popup.getElement(); if (!el) return;
    const b = el.querySelector('[data-detail]') as HTMLElement | null;
    if (b) b.onclick = () => { const id = b.getAttribute('data-detail'); if (id) onOpenDetailRef.current(id); };
  };

  // Mount: create the map once.
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true, attributionControl: false, minZoom: 7, maxZoom: 17 }).setView([46.82, 8.23], 8);
    mapRef.current = map;
    L.control.attribution({ prefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' }).addTo(map);
    setTile(baseKind);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Lany = L as any;
    markerGroupRef.current = Lany.markerClusterGroup
      ? Lany.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true, zoomToBoundsOnClick: false, disableClusteringAtZoom: 16, removeOutsideVisibleBounds: false, animate: false, iconCreateFunction: clusterIcon(L) })
      : L.layerGroup();
    if (markerGroupRef.current.on) markerGroupRef.current.on('clusterclick', onClusterClick);
    map.on('popupopen', onPopupOpen);
    map.on('click', onMapClick);

    map.whenReady(() => {
      if (!mapRef.current) return;
      map.invalidateSize();
      const zoomEl = map.zoomControl.getContainer();
      if (zoomEl) {
        setFitAllTop(10 + zoomEl.offsetHeight + 10);
        setFitAllSize(zoomEl.offsetWidth);
        const zoomStyle = getComputedStyle(zoomEl);
        setFitAllBorder(`${zoomStyle.borderWidth} ${zoomStyle.borderStyle} ${zoomStyle.borderColor}`);
        setFitAllBgClip(zoomStyle.backgroundClip);
      }
      window.setTimeout(() => {
        if (!mapRef.current || !markerGroupRef.current) return;
        map.invalidateSize();
        if (!map.hasLayer(markerGroupRef.current)) markerGroupRef.current.addTo(map);
        refreshMarkers();
      }, 160);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerGroupRef.current = null;
      markersRef.current = {};
      tileRef.current = null;
      appliedInitialFocusRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base layer change.
  useEffect(() => {
    if (!mapRef.current) return;
    setTile(baseKind);
  }, [baseKind]);

  // Venue list change → rebuild markers.
  useEffect(() => {
    if (!mapRef.current) return;
    refreshMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, t]);

  // Selection change → recolor pins and focus.
  useEffect(() => {
    if (!mapRef.current) return;
    updatePins();
    if (selectedId) focusVenue(selectedId);
  }, [selectedId]);

  // Crosshair cursor while placing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getContainer()) return;
    map.getContainer().style.cursor = placing ? 'crosshair' : '';
  }, [placing]);

  // Expose fit-all-bounds.
  useEffect(() => {
    if (!registerFitAll) return;
    registerFitAll(() => {
      const map = mapRef.current;
      if (map) map.flyToBounds([[45.7, 5.7], [47.95, 10.65]], { padding: [24, 24], duration: 0.8 });
    });
  }, [registerFitAll]);

  // Apply the initial canton-focus bounds once, the first time they're
  // available (venues load async, but these bounds don't depend on venues —
  // they can arrive as early as the first render). Never re-fires, so a
  // later re-render can't re-snap the view while the user is browsing.
  // Deferred via whenReady: calling flyToBounds before Leaflet's internal
  // load state is established throws inside Leaflet's own animation code
  // (TypeError reading '_leaflet_pos') and silently aborts the fly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialFocusBounds || appliedInitialFocusRef.current) return;
    map.whenReady(() => {
      if (!mapRef.current || appliedInitialFocusRef.current) return;
      appliedInitialFocusRef.current = true;
      mapRef.current.flyToBounds(initialFocusBounds, { padding: [40, 40], maxZoom: 15, duration: 0.8 });
    });
  }, [initialFocusBounds]);

  // User position → drop / move the "you are here" marker and gently center on it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
    const pos = userPosition;
    if (!pos) return;
    const icon = L.divIcon({ className: '', html: userPinHtml(), iconSize: [22, 22], iconAnchor: [11, 11] });
    userMarkerRef.current = L.marker([pos.lat, pos.lng], { icon, interactive: false, keyboard: false, title: tRef.current.youAreHere }).addTo(map);
    map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
  }, [userPosition]);

  return (
    <div style={wrapStyle}>
      <div ref={mapElRef} style={mapElStyle} />
      <div style={overlayStyle}>
        <div style={baseToggleWrapStyle}>
          <button onClick={() => onChangeBase('map')} style={baseToggleBtnStyle(baseKind === 'map')}>
            {t.mapView}
          </button>
          <button onClick={() => onChangeBase('sat')} style={baseToggleBtnStyle(baseKind === 'sat')}>
            {t.satView}
          </button>
        </div>
      </div>
      <div style={fitAllWrapStyle(fitAllTop, fitAllSize, fitAllBorder, fitAllBgClip)}>
        <button
          className="sk-native-ctrl-btn"
          onClick={() => { const map = mapRef.current; if (map) map.flyToBounds([[45.7, 5.7], [47.95, 10.65]], { padding: [24, 24], duration: 0.8 }); }}
          title={t.fitAll}
          style={fitAllBtnStyle}
        >
          <Maximize size={18} />
        </button>
      </div>
      {geoStatus !== 'unsupported' && (
        <div style={{ ...nativeCtrlStyle, position: 'absolute', left: '10px', top: `${fitAllTop + fitAllSize + 10}px`, width: `${fitAllSize}px`, height: `${fitAllSize}px`, border: fitAllBorder, backgroundClip: fitAllBgClip, zIndex: 1000 }}>
          <button
            className="sk-native-ctrl-btn"
            onClick={onRequestLocation}
            title={t.useMyLocation}
            aria-label={t.useMyLocation}
            style={{ ...fitAllBtnStyle, color: geoStatus === 'denied' || geoStatus === 'error' ? theme.color.muted : theme.color.ink }}
          >
            <LocateFixed size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
