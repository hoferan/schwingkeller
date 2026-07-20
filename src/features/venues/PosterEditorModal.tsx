import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { boundsForCanton } from '../../data/cantonBounds';
import { createTileLayer, TILE_ATTRIBUTION, type BaseKind } from '../map/tileLayers';
import { pinHtml } from '../map/markers';
import { generateCantonPosterBlob } from './cantonPoster';
import { POSTER_SIZE, POSTER_LAYOUT as PL, cqw } from './posterLayout';
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

const PREVIEW_SIZE = 460;

export const PosterEditorModal = ({
  code, venues, initialBaseKind, unitLabel, onClose, onSave, onError,
}: PosterEditorModalProps) => {
  const { t } = useTranslation();
  const canton = cantonByCode(code);
  const cantonVenues = venues.filter((v) => v.canton === code);

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
    const bounds = boundsForCanton(code);
    // zoomControl:false — the header/footer chrome span the full width top and bottom, so any
    // on-map corner control would collide with them. Zoom lives in the controls panel instead
    // (the map still zooms via scroll/pinch).
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: false });
    mapRef.current = map;
    tileRef.current = createTileLayer(baseKind, 'anonymous');
    tileRef.current.addTo(map);
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });

    const pins = L.layerGroup().addTo(map);
    cantonVenues.forEach((v) => {
      L.marker([v.lat, v.lng], { icon: L.divIcon({ className: '', html: pinHtml(false), iconSize: [28, 28] }) })
        .addTo(pins);
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
  }, [baseKind]);

  const resetFraming = () => {
    const map = mapRef.current;
    const bounds = boundsForCanton(code);
    if (map && bounds) map.fitBounds(bounds, { padding: [20, 20] });
  };

  const download = async () => {
    const map = mapRef.current;
    const el = mapElRef.current;
    if (!map || !el) return;
    map.invalidateSize({ animate: false });
    // Frame the 1080² export on exactly the area the square preview shows. The canvas is far wider
    // in pixels than the on-screen preview, so bump the zoom by log2(POSTER_SIZE / previewWidth):
    // more pixels at a higher zoom cover the identical ground area (raw center+zoom would show ~2×).
    const previewPx = el.clientWidth || PREVIEW_SIZE;
    const c = map.getCenter();
    const view = {
      center: [c.lat, c.lng] as [number, number],
      zoom: map.getZoom() + Math.log2(POSTER_SIZE / previewPx),
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

  const label: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: theme.color.ink };
  // The chrome is sized in cqw (percent of the preview square's width) from the SAME POSTER_LAYOUT
  // numbers the canvas exporter uses, so the preview is a scaled replica of the PNG. zIndex 800
  // keeps it above Leaflet's tile/marker panes (≤700) but below its controls (1000); pointerEvents
  // none lets map drag/zoom pass through.
  const band: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0, background: 'rgba(17,17,17,0.72)',
    color: theme.color.bg, zIndex: 800, pointerEvents: 'none', display: 'flex', alignItems: 'center',
  };

  return (
    <Modal onClose={onClose} width={PREVIEW_SIZE + 300}>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontWeight: 700, fontSize: '18px', color: theme.color.ink }}>
          {t.posterEditorTitle}: {canton?.name ?? code}
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          {/* Live editor square with DOM chrome overlays. aspectRatio keeps it 1:1 as the width
              shrinks on narrow screens; containerType makes cqw resolve against this square so the
              chrome scales exactly like the export; justifyContent:center on the row keeps the
              square centered (no lopsided gap) when the controls wrap below. */}
          <div style={{ position: 'relative', width: PREVIEW_SIZE, maxWidth: '100%', aspectRatio: '1 / 1', flex: '0 1 auto', borderRadius: theme.radius.sm, overflow: 'hidden', border: '1px solid ' + theme.color.line, containerType: 'inline-size' }}>
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
          <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={label}>
              {t.posterTitleLabel}
              <input aria-label={t.posterTitleLabel} value={title} onChange={(e) => setTitle(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1.5px solid ' + theme.color.line, borderRadius: theme.radius.sm }} />
            </label>

            <div style={label}>
              {t.posterBaseLabel}
              <button onClick={() => setBaseKind('map')} aria-pressed={baseKind === 'map'}
                style={{ padding: '6px 10px', borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: baseKind === 'map' ? theme.color.ink : 'transparent', color: baseKind === 'map' ? theme.color.bg : theme.color.ink, cursor: 'pointer' }}>
                {t.mapView}
              </button>
              <button onClick={() => setBaseKind('sat')} aria-pressed={baseKind === 'sat'}
                style={{ padding: '6px 10px', borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: baseKind === 'sat' ? theme.color.ink : 'transparent', color: baseKind === 'sat' ? theme.color.bg : theme.color.ink, cursor: 'pointer' }}>
                {t.satView}
              </button>
            </div>

            <div style={label}>
              {t.posterZoom}
              <button type="button" aria-label={t.posterZoomOut} onClick={() => mapRef.current?.zoomOut()}
                style={{ width: 32, height: 32, borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                −
              </button>
              <button type="button" aria-label={t.posterZoomIn} onClick={() => mapRef.current?.zoomIn()}
                style={{ width: 32, height: 32, borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                +
              </button>
            </div>

            <label style={label}>
              <input type="checkbox" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} />
              {t.posterToggleHeader}
            </label>
            <label style={label}>
              <input type="checkbox" checked={showFooter} onChange={(e) => setShowFooter(e.target.checked)} />
              {t.posterToggleFooter}
            </label>
            <label style={label}>
              <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
              {t.posterToggleQr}
            </label>

            <button onClick={resetFraming}
              style={{ alignSelf: 'flex-start', padding: '8px 12px', border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: '13px' }}>
              {t.posterResetFraming}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
          <button onClick={onClose}
            style={{ flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink, fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer' }}>
            {t.close}
          </button>
          <button onClick={() => { void download(); }} disabled={busy}
            style={{ flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {t.posterDownload}
          </button>
        </div>
      </div>
    </Modal>
  );
};
