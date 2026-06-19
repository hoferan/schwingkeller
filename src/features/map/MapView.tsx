import { useEffect, useRef, type CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { Venue } from '../venues/types';
import { useTranslation } from '../../i18n/useTranslation';
import { pinHtml, popupHtml, clusterIcon } from './markers';

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
}

// GeoJSON ring helpers: leaflet wants [lat,lng], geojson stores [lng,lat].
interface GeoJSONFeatureCollection {
  features: Array<{
    geometry: { type: string; coordinates: number[][][] | number[][][][] } | null;
  }>;
}

const wrapStyle: CSSProperties = { position: 'relative', flex: 1, height: '100%' };
const mapElStyle: CSSProperties = { position: 'absolute', inset: 0 };
const overlayStyle: CSSProperties = {
  position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
  display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end',
};
const toggleWrapStyle: CSSProperties = {
  display: 'flex', background: '#f6edd9', border: '1px solid #cbb077',
  borderRadius: '9px', overflow: 'hidden', boxShadow: '0 3px 10px rgba(60,40,15,.25)',
};
const fitAllBtnStyle: CSSProperties = {
  width: '38px', height: '38px', border: '1px solid #cbb077', background: '#f6edd9',
  color: '#5a4527', borderRadius: '9px', cursor: 'pointer',
  boxShadow: '0 3px 10px rgba(60,40,15,.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const layerBtnStyle = (active: boolean): CSSProperties => ({
  border: 'none', cursor: 'pointer', fontFamily: "'Work Sans',sans-serif", fontSize: '12px',
  fontWeight: 600, padding: '7px 13px',
  background: active ? '#c0851d' : 'transparent', color: active ? '#2a1d10' : '#7a6342',
});

const cantonStyle = (): L.PathOptions => ({ color: '#9a7c45', weight: 1, fill: false, fillOpacity: 0 });

export function MapView({
  venues, selectedId, onSelect, onOpenDetail,
  baseKind, onChangeBase, placing, onPickLocation, registerFitAll,
}: MapViewProps) {
  const { t } = useTranslation();
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerGroupRef = useRef<any>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const tileRef = useRef<L.TileLayer | null>(null);
  const satRefLayers = useRef<L.TileLayer[] | null>(null);
  const maskLayerRef = useRef<L.Polygon | null>(null);
  const cantonLayerRef = useRef<L.GeoJSON | null>(null);

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
    if (satRefLayers.current) { satRefLayers.current.forEach((l) => map.removeLayer(l)); satRefLayers.current = null; }
    if (kind === 'sat') {
      tileRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, Maxar, Earthstar Geographics', maxZoom: 18 });
      tileRef.current.addTo(map); tileRef.current.bringToBack();
      satRefLayers.current = [
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
      ];
      satRefLayers.current.forEach((l) => l.addTo(map));
    } else {
      tileRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO', maxZoom: 19 });
      tileRef.current.addTo(map); tileRef.current.bringToBack();
    }
    const pane = map.getPane('tilePane'); if (pane) pane.style.filter = 'none';
  };

  const applyMaskTint = (kind: 'map' | 'sat') => {
    if (maskLayerRef.current) maskLayerRef.current.setStyle({ fillColor: kind === 'sat' ? '#0e1c12' : '#6f6553', fillOpacity: kind === 'sat' ? 0.5 : 0.6 });
    if (cantonLayerRef.current) cantonLayerRef.current.setStyle({ color: kind === 'sat' ? '#f4ead4' : '#9a7c45', weight: kind === 'sat' ? 1.2 : 1 });
  };

  const refreshMarkers = () => {
    const map = mapRef.current; const group = markerGroupRef.current;
    if (!group || !map) return;
    const sz = map.getSize ? map.getSize() : null;
    if (sz && (sz.x <= 0 || sz.y <= 0)) { window.setTimeout(refreshMarkers, 120); return; }
    group.clearLayers(); markersRef.current = {};
    venuesRef.current.forEach((v) => {
      const icon = L.divIcon({ className: '', html: pinHtml(v.id === selectedIdRef.current), iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36] });
      const m = L.marker([v.lat, v.lng], { icon }).addTo(group);
      m.bindPopup(popupHtml(v, tRef.current), { maxWidth: 240, minWidth: 222, closeButton: true });
      m.on('click', () => onSelectRef.current(v.id));
      markersRef.current[v.id] = m;
    });
  };

  const updatePins = () => {
    Object.keys(markersRef.current).forEach((id) => {
      markersRef.current[id].setIcon(L.divIcon({ className: '', html: pinHtml(id === selectedIdRef.current), iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -36] }));
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

    const init = async () => {
      try {
        const gj = (await fetch('/cantons.geojson').then((r) => r.json())) as GeoJSONFeatureCollection;
        const holes: number[][][] = [];
        gj.features.forEach((f) => {
          if (!f.geometry) return;
          if (f.geometry.type === 'Polygon') {
            (f.geometry.coordinates as number[][][]).forEach((ring) => holes.push(ring.map((c) => [c[1], c[0]])));
          } else if (f.geometry.type === 'MultiPolygon') {
            (f.geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach((ring) => holes.push(ring.map((c) => [c[1], c[0]]))));
          }
        });
        const world: number[][] = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
        maskLayerRef.current = L.polygon([world as L.LatLngExpression[], ...(holes as unknown as L.LatLngExpression[][])], { stroke: false, fillColor: '#6f6553', fillOpacity: 0.6, interactive: false }).addTo(map);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cantonLayerRef.current = L.geoJSON(gj as any, { style: cantonStyle, interactive: false }).addTo(map);
        applyMaskTint(baseKind);
      } catch (err) {
        console.warn('cantons load failed', err);
      }
    };
    void init();

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
      satRefLayers.current = null;
      maskLayerRef.current = null;
      cantonLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base layer change.
  useEffect(() => {
    if (!mapRef.current) return;
    setTile(baseKind);
    applyMaskTint(baseKind);
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

  return (
    <div style={wrapStyle}>
      <div ref={mapElRef} style={mapElStyle} />
      <div style={overlayStyle}>
        <div style={toggleWrapStyle}>
          <button onClick={() => onChangeBase('map')} style={layerBtnStyle(baseKind === 'map')}>{t.mapView}</button>
          <button onClick={() => onChangeBase('sat')} style={layerBtnStyle(baseKind === 'sat')}>{t.satView}</button>
        </div>
        <button
          onClick={() => { const map = mapRef.current; if (map) map.flyToBounds([[45.7, 5.7], [47.95, 10.65]], { padding: [24, 24], duration: 0.8 }); }}
          title={t.fitAll}
          style={fitAllBtnStyle}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4" /><path d="M20 9V5a1 1 0 0 0-1-1h-4" /><path d="M4 15v4a1 1 0 0 0 1 1h4" /><path d="M20 15v4a1 1 0 0 1-1 1h-4" /></svg>
        </button>
      </div>
    </div>
  );
}
