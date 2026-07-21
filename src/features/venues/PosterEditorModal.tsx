import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { boundsForCanton } from '../../data/cantonBounds';
import { createTileLayer, TILE_ATTRIBUTION, TILE_MAX_ZOOM, type BaseKind } from '../map/tileLayers';
import { generateCantonPosterBlob } from './cantonPoster';
import { venueBoundsForCanton, CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';
import { POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin } from './posterLayout';
import { usePosterQr } from './usePosterQr';
import type { Venue } from './types';

interface PosterEditorModalProps {
  code: string;
  venues: Venue[];
  initialBaseKind: BaseKind;
  unitLabel: string;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => void;
  onError?: (err: unknown) => void;
}

// The live preview map is locked to a power-of-2 fraction of POSTER_SIZE (1080): 540 on wider
// screens, 270 on small ones. That makes the export zoom exactly previewZoom + log2(1080/size)
// — an INTEGER (1 or 2) — so the off-screen capture uses whole-number Leaflet zoom levels. Whole
// zooms are what the tile-capture assumes; a fractional zoom makes Leaflet CSS-scale the tile pane,
// which the capture can't reproduce (misframed export + missing-tile black bars).
const previewSizeFor = (w: number): number => (w >= 700 ? 540 : 270);

const DEFAULT_FIT_PADDING = 20; // px, matches the flat padding the canton-bounds fallback has always used

// Default framing for the live editor map: fit tightly to the canton's own venues (not the whole
// canton outline) so exported labels aren't shrunk by empty terrain, while keeping a sensible view
// for cantons with very few or tightly-clustered venues. Shared by the mount effect and the "Reset
// framing" button so both apply identical logic.
const applyDefaultFraming = (
  map: L.Map,
  code: string,
  venues: Venue[],
  previewSize: number,
  showHeader: boolean,
  showFooter: boolean,
): void => {
  const cantonVenues = venues.filter((v) => v.canton === code);

  if (cantonVenues.length === 0) {
    const bounds = boundsForCanton(code);
    if (bounds) map.fitBounds(bounds, { padding: [DEFAULT_FIT_PADDING, DEFAULT_FIT_PADDING] });
    return;
  }

  if (cantonVenues.length === 1) {
    const [only] = cantonVenues;
    map.setView([only.lat, only.lng], CANTON_POSTER_MAX_DEFAULT_ZOOM);
    return;
  }

  const venueBounds = venueBoundsForCanton(code, venues);
  if (!venueBounds) return;
  const scale = previewSize / POSTER_SIZE;
  const topPad = DEFAULT_FIT_PADDING + (showHeader ? PL.headerH * scale : 0);
  const bottomPad = DEFAULT_FIT_PADDING + (showFooter ? PL.footerH * scale : 0);
  map.fitBounds(venueBounds, {
    paddingTopLeft: [DEFAULT_FIT_PADDING, topPad],
    paddingBottomRight: [DEFAULT_FIT_PADDING, bottomPad],
  });
  if (map.getZoom() > CANTON_POSTER_MAX_DEFAULT_ZOOM) {
    map.setZoom(CANTON_POSTER_MAX_DEFAULT_ZOOM);
  }
};

export const PosterEditorModal = ({
  code, venues, initialBaseKind, unitLabel, onClose, onSave, onError,
}: PosterEditorModalProps) => {
  const { t } = useTranslation();
  const canton = cantonByCode(code);
  const cantonVenues = venues.filter((v) => v.canton === code);
  // Frozen at mount (lazy initial state) — the map is created once at this size.
  const [previewSize] = useState(() => previewSizeFor(typeof window !== 'undefined' ? window.innerWidth : 1024));
  // Integer zoom gap between the preview and the 1080² export (1 for 540, 2 for 270).
  const deltaZoom = Math.log2(POSTER_SIZE / previewSize);
  // Cap the preview zoom so previewZoom + deltaZoom can never exceed the base layer's max zoom —
  // otherwise the export map would clamp to the max and silently show more area than the preview.
  const maxPreviewZoom = (kind: BaseKind): number => TILE_MAX_ZOOM[kind] - deltaZoom;

  const [baseKind, setBaseKind] = useState<BaseKind>(initialBaseKind);
  const [title, setTitle] = useState<string>(canton?.name ?? code);
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [busy, setBusy] = useState(false);

  const { dataUrl: qrDataUrl } = usePosterQr(code);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const didMountBaseKindRef = useRef(false);

  // Create the live editor map once.
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;
    // zoomControl:false — the header/footer chrome span the full width top and bottom, so any
    // on-map corner control would collide with them. Zoom lives in the controls panel instead
    // (the map still zooms via scroll/pinch).
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: false, maxZoom: maxPreviewZoom(baseKind) });
    mapRef.current = map;
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
    applyDefaultFraming(map, code, venues, previewSize, showHeader, showFooter);

    // Pins scaled from the same geometry as the canvas drawPin, so preview pins match the export.
    const p = previewPin(previewSize);
    const pinIcon = L.divIcon({
      className: '',
      iconSize: [p.d, p.d],
      html: `<div style="width:${p.d}px;height:${p.d}px;border-radius:50%;background:${theme.color.accent};border:${p.ring}px solid ${theme.color.bg};box-sizing:border-box;display:flex;align-items:center;justify-content:center;"><span style="width:${p.dot}px;height:${p.dot}px;border-radius:50%;background:${theme.color.bg};display:block;"></span></div>`,
    });
    const pins = L.layerGroup().addTo(map);
    cantonVenues.forEach((v) => {
      L.marker([v.lat, v.lng], { icon: pinIcon }).addTo(pins);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the base layer live when toggled. Skip the initial mount — the create-map effect above
  // already builds the first tile layer, so re-running here on mount would rebuild it redundantly.
  useEffect(() => {
    if (!didMountBaseKindRef.current) {
      didMountBaseKindRef.current = true;
      return;
    }
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
    // Satellite (max 18) caps lower than street (19); re-clamp so the export never over-zooms.
    map.setMaxZoom(maxPreviewZoom(baseKind));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKind]);

  const resetFraming = () => {
    const map = mapRef.current;
    if (!map) return;
    applyDefaultFraming(map, code, venues, previewSize, showHeader, showFooter);
  };

  const download = async () => {
    const map = mapRef.current;
    if (!map) {
      onError?.(new Error('[NO_MAP] Poster editor map is not ready.'));
      return;
    }
    // Frame the 1080² export on exactly the area the (square, power-of-2-sized) preview shows: the
    // canvas is POSTER_SIZE/previewSize× wider, so bump the zoom by that log2 (an integer). Math.round
    // defends the integer invariant even if Leaflet's zoomSnap is ever changed to a fractional value.
    const c = map.getCenter();
    const view = {
      center: [c.lat, c.lng] as [number, number],
      zoom: Math.round(map.getZoom() + deltaZoom),
    };
    setBusy(true);
    try {
      const { blob, filename } = await generateCantonPosterBlob(code, venues, {
        baseKind,
        view,
        unitLabel,
        title,
        showHeader,
        showFooter,
        qrDataUrl: showQr ? qrDataUrl : null,
      });
      onSave(blob, filename);
    } catch (err) {
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  // The chrome is sized in cqw (percent of the preview square's width) from the SAME POSTER_LAYOUT
  // numbers the canvas exporter uses, so the preview is a scaled replica of the PNG. zIndex 800
  // keeps it above Leaflet's tile/marker panes (≤700) but below its controls (1000); pointerEvents
  // none lets map drag/zoom pass through.
  const band: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0, background: 'rgba(17,17,17,0.72)',
    color: theme.color.bg, zIndex: 800, pointerEvents: 'none', display: 'flex', alignItems: 'center',
  };
  const fieldLabel: React.CSSProperties = {
    fontSize: '11.5px', letterSpacing: '.07em', textTransform: 'uppercase',
    color: theme.color.muted, fontWeight: 700, fontFamily: theme.font.display,
  };

  const toggle = (key: string, text: string, checked: boolean, set: (v: boolean) => void) => (
    <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', cursor: 'pointer', fontSize: '14.5px', color: theme.color.ink, fontWeight: 500 }}>
      <span>{text}</span>
      <span style={{ position: 'relative', width: '46px', height: '28px', borderRadius: '999px', background: checked ? theme.color.accent : theme.color.line, transition: 'background .18s ease', flex: 'none' }}>
        <input type="checkbox" aria-label={text} checked={checked} onChange={(e) => set(e.target.checked)}
          style={{ position: 'absolute', inset: 0, margin: 0, opacity: 0, cursor: 'pointer' }} />
        <span style={{ position: 'absolute', top: '3px', left: checked ? '21px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.35)', transition: 'left .18s ease' }} />
      </span>
    </label>
  );

  return (
    <Modal onClose={onClose} width={previewSize + 340}>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700, fontSize: '18px', color: theme.color.ink }}>
          {t.posterEditorTitle}: {canton?.name ?? code}
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          {/* Live editor square, fixed at a power-of-2 fraction of 1080 so the export is an
              integer zoom step away (exact framing, no fractional-zoom tile gaps). containerType
              makes the chrome's cqw units resolve against this square so it scales like the export;
              justifyContent:center on the row keeps it centered when the controls wrap below. */}
          <div style={{ position: 'relative', width: previewSize, height: previewSize, flex: '0 0 auto', borderRadius: theme.radius.sm, overflow: 'hidden', border: '1px solid ' + theme.color.line, containerType: 'inline-size' }}>
            <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />
            {showHeader && (
              <div style={{ ...band, top: 0, height: cqw(PL.headerH), gap: cqw(PL.wappenGap), paddingLeft: cqw(PL.padX), paddingRight: cqw(PL.padX) }}>
                <img src={wappenUrl(code)} alt="" style={{ width: cqw(PL.wappenW), height: cqw(PL.wappenH), objectFit: 'contain', flex: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: cqw(PL.titleGap), minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font.display, fontWeight: 700, textTransform: 'uppercase', fontSize: cqw(PL.titleFont), lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || canton?.name}
                  </div>
                  <span style={{ alignSelf: 'flex-start', fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk, background: theme.color.accent, fontSize: cqw(PL.pillFont), height: cqw(PL.pillH), lineHeight: cqw(PL.pillH), padding: `0 ${cqw(PL.pillPadX)}`, borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {cantonVenues.length} {unitLabel}
                  </span>
                </div>
              </div>
            )}
            {showQr && qrDataUrl && (
              <img src={qrDataUrl} alt="QR" style={{ position: 'absolute', right: cqw(PL.qrMargin), bottom: cqw(PL.qrMargin + PL.footerH), width: cqw(PL.qrSize), height: cqw(PL.qrSize), background: theme.color.bg, padding: cqw(PL.qrPad), borderRadius: '3px', zIndex: 800, pointerEvents: 'none' }} />
            )}
            {showFooter ? (
              <div style={{ ...band, bottom: 0, height: cqw(PL.footerH), justifyContent: 'space-between', paddingLeft: cqw(PL.appNameX), paddingRight: cqw(PL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: cqw(PL.appNameFont), whiteSpace: 'nowrap' }}>Schwingkeller Schweiz</span>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(PL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            ) : (
              <div style={{ ...band, bottom: 0, height: cqw(PL.minAttribStripH), background: 'rgba(17,17,17,0.55)', justifyContent: 'flex-end', paddingRight: cqw(PL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(PL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={fieldLabel}>{t.posterTitleLabel}</span>
              <input aria-label={t.posterTitleLabel} value={title} onChange={(e) => setTitle(e.target.value)}
                style={{ padding: '10px 12px', border: '1.5px solid ' + theme.color.line, borderRadius: theme.radius.sm, fontSize: '14.5px', color: theme.color.ink, background: theme.color.bg, fontFamily: theme.font.body }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={fieldLabel}>{t.posterBaseLabel}</span>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.paper, borderRadius: '999px', padding: '4px', gap: '2px' }}>
                {(['map', 'sat'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={baseKind === k} onClick={() => setBaseKind(k)}
                    style={{ border: 'none', borderRadius: '999px', padding: '7px 18px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease', background: baseKind === k ? theme.color.bg : 'transparent', color: baseKind === k ? theme.color.ink : theme.color.muted, boxShadow: baseKind === k ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
                    {k === 'map' ? t.mapView : t.satView}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
              {toggle('footer', t.posterToggleFooter, showFooter, setShowFooter)}
              {toggle('qr', t.posterToggleQr, showQr, setShowQr)}
            </div>

            <button type="button" onClick={resetFraming}
              style={{ alignSelf: 'flex-start', padding: '6px 0', border: 'none', background: 'transparent', color: theme.color.accent, fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}>
              {t.posterResetFraming}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '11px', marginTop: '22px' }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, fontWeight: 600, fontSize: '14px', padding: '13px', borderRadius: theme.radius.sm, cursor: 'pointer' }}>
            {t.close}
          </button>
          <button type="button" onClick={() => { void download(); }} disabled={busy}
            style={{ flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk, fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: theme.radius.sm, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {t.posterDownload}
          </button>
        </div>
      </div>
    </Modal>
  );
};
