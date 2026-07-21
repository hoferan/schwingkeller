import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { boundsForCanton } from '../../data/cantonBounds';
import { createTileLayer, TILE_ATTRIBUTION, TILE_MAX_ZOOM, type BaseKind } from '../map/tileLayers';
import { generateCantonPosterBlob } from './cantonPoster';
import { computeChromeLayout, CHROME_STYLE_COLORS, type ChromeLayoutResult } from './posterCanvas';
import { venueBoundsForCanton, CANTON_POSTER_MAX_DEFAULT_ZOOM } from './posterFraming';
import {
  POSTER_SIZE, POSTER_LAYOUT as PL, cqw, previewPin, posterHeightFor, chromeLayoutFor,
  type PosterAspectRatio, type ChromePosition, type ChromeStyle, type ChromeSize, type QrCorner,
} from './posterLayout';
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
// framing" button so both apply identical logic. Padding derives from computeChromeLayout's
// per-edge occupancy so it stays correct wherever the bands are positioned and at either size.
const applyDefaultFraming = (
  map: L.Map,
  code: string,
  venues: Venue[],
  previewSize: number,
  chrome: ChromeLayoutResult,
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
  const topPad = DEFAULT_FIT_PADDING + chrome.topOccupied * scale;
  const bottomPad = DEFAULT_FIT_PADDING + chrome.bottomOccupied * scale;
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
  const [aspectRatio, setAspectRatio] = useState<PosterAspectRatio>('square');
  const [headerPosition, setHeaderPosition] = useState<ChromePosition>('top');
  const [footerPosition, setFooterPosition] = useState<ChromePosition>('bottom');
  const [chromeStyle, setChromeStyle] = useState<ChromeStyle>('solid');
  const [chromeSize, setChromeSize] = useState<ChromeSize>('normal');
  const [qrCorner, setQrCorner] = useState<QrCorner>('bottom-right');
  const [busy, setBusy] = useState(false);

  const { dataUrl: qrDataUrl } = usePosterQr(code);

  // Chrome geometry for the current selections — the same pure functions the canvas exporter
  // uses, so the preview stays an exact scaled replica and the venue-fit framing pads for the
  // edges the bands actually occupy. Computed against the currently selected aspect ratio's
  // height so bottom-anchored bands land correctly in portrait mode too.
  const CL = chromeLayoutFor(chromeSize);
  const chrome = computeChromeLayout({
    showHeader, showFooter, headerPosition, footerPosition, chromeSize,
    posterHeight: posterHeightFor(aspectRatio),
  });

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const didMountBaseKindRef = useRef(false);
  const didMountAspectRatioRef = useRef(false);

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
    applyDefaultFraming(map, code, venues, previewSize, chrome);

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

  // Resize the live map's container when the aspect ratio changes; skip the initial mount (the
  // create-map effect already sizes the container for the initial 'square' aspectRatio). Leaflet
  // requires invalidateSize() after any container resize to keep its internal size cache correct.
  // Per the design, this only resizes the container — it never re-fits or re-centers the view.
  useEffect(() => {
    if (!didMountAspectRatioRef.current) {
      didMountAspectRatioRef.current = true;
      return;
    }
    mapRef.current?.invalidateSize();
  }, [aspectRatio]);

  const resetFraming = () => {
    const map = mapRef.current;
    if (!map) return;
    applyDefaultFraming(map, code, venues, previewSize, chrome);
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
        aspectRatio,
        headerPosition,
        footerPosition,
        chromeStyle,
        chromeSize,
        qrCorner,
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
  const chromeColors = CHROME_STYLE_COLORS[chromeStyle];
  const bandTextStyle: React.CSSProperties = {
    color: chromeColors.text,
    textShadow: chromeColors.shadow ? '0 1px 4px rgba(0,0,0,0.6)' : 'none',
  };

  const band: React.CSSProperties = {
    position: 'absolute', left: 0, right: 0,
    zIndex: 800, pointerEvents: 'none', display: 'flex', alignItems: 'center',
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

  const segmented = <T extends string>(
    key: string, label: string, options: readonly T[], value: T, set: (v: T) => void, labelFor: (v: T) => string,
  ) => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <span style={fieldLabel}>{label}</span>
      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: theme.color.paper, borderRadius: '999px', padding: '4px', gap: '2px', flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <button key={opt} type="button" aria-pressed={value === opt} onClick={() => set(opt)}
            style={{ border: 'none', borderRadius: '999px', padding: '7px 14px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s ease', background: value === opt ? theme.color.bg : 'transparent', color: value === opt ? theme.color.ink : theme.color.muted, boxShadow: value === opt ? '0 1px 3px rgba(0,0,0,.18)' : 'none' }}>
            {labelFor(opt)}
          </button>
        ))}
      </div>
    </div>
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
          <div data-testid="poster-preview-square" style={{ position: 'relative', width: previewSize, height: previewSize * (posterHeightFor(aspectRatio) / POSTER_SIZE), flex: '0 0 auto', borderRadius: theme.radius.sm, overflow: 'hidden', border: '1px solid ' + theme.color.line, containerType: 'inline-size' }}>
            <div ref={mapElRef} style={{ position: 'absolute', inset: 0 }} />
            {showHeader && chrome.headerY !== null && (
              <div data-testid="poster-preview-header" style={{ ...band, top: cqw(chrome.headerY), height: cqw(CL.headerH), background: chromeColors.fill ?? 'transparent', ...bandTextStyle, gap: cqw(CL.wappenGap), paddingLeft: cqw(CL.padX), paddingRight: cqw(CL.padX) }}>
                <img src={wappenUrl(code)} alt="" style={{ width: cqw(CL.wappenW), height: cqw(CL.wappenH), objectFit: 'contain', flex: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: cqw(CL.titleGap), minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font.display, fontWeight: 700, textTransform: 'uppercase', fontSize: cqw(CL.titleFont), lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || canton?.name}
                  </div>
                  <span style={{ alignSelf: 'flex-start', fontFamily: theme.font.display, fontWeight: 700, color: theme.color.accentInk, background: theme.color.accent, fontSize: cqw(CL.pillFont), height: cqw(CL.pillH), lineHeight: cqw(CL.pillH), padding: `0 ${cqw(CL.pillPadX)}`, borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {cantonVenues.length} {unitLabel}
                  </span>
                </div>
              </div>
            )}
            {showQr && qrDataUrl && (() => {
              const isTop = qrCorner.startsWith('top');
              const isLeft = qrCorner.endsWith('left');
              const bottomOccupied = chrome.bottomOccupied + (!showFooter ? PL.minAttribStripH : 0);
              const occupied = isTop ? chrome.topOccupied : bottomOccupied;
              return (
                <img src={qrDataUrl} alt="QR" style={{
                  position: 'absolute',
                  [isLeft ? 'left' : 'right']: cqw(CL.qrMargin),
                  [isTop ? 'top' : 'bottom']: cqw(occupied + CL.qrMargin),
                  width: cqw(CL.qrSize), height: cqw(CL.qrSize), background: theme.color.bg,
                  padding: cqw(CL.qrPad), borderRadius: '3px', zIndex: 800, pointerEvents: 'none',
                } as React.CSSProperties} />
              );
            })()}
            {showFooter && chrome.footerY !== null ? (
              <div data-testid="poster-preview-footer" style={{ ...band, top: cqw(chrome.footerY), height: cqw(CL.footerH), background: chromeColors.fill ?? 'transparent', ...bandTextStyle, justifyContent: 'space-between', paddingLeft: cqw(CL.appNameX), paddingRight: cqw(CL.attribMarginX) }}>
                <span style={{ fontFamily: theme.font.display, fontWeight: 600, fontSize: cqw(CL.appNameFont), whiteSpace: 'nowrap' }}>Schwingkeller Schweiz</span>
                <span style={{ fontFamily: theme.font.body, fontWeight: 400, fontSize: cqw(CL.attribFont), whiteSpace: 'nowrap' }}>{TILE_ATTRIBUTION[baseKind]}</span>
              </div>
            ) : (
              <div style={{ ...band, bottom: 0, height: cqw(PL.minAttribStripH), background: 'rgba(17,17,17,0.55)', color: theme.color.bg, justifyContent: 'flex-end', paddingRight: cqw(PL.attribMarginX) }}>
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

            {segmented('base', t.posterBaseLabel, ['map', 'sat'] as const, baseKind, setBaseKind,
              (k) => (k === 'map' ? t.mapView : t.satView))}

            {segmented('format', t.posterFormatLabel, ['square', 'portrait'] as const, aspectRatio, setAspectRatio,
              (r) => (r === 'square' ? t.posterFormatSquare : t.posterFormatPortrait))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {toggle('header', t.posterToggleHeader, showHeader, setShowHeader)}
              {segmented('headerPos', t.posterHeaderPositionLabel, ['top', 'bottom'] as const, headerPosition, setHeaderPosition,
                (p) => (p === 'top' ? t.posterPositionTop : t.posterPositionBottom))}
              {toggle('footer', t.posterToggleFooter, showFooter, setShowFooter)}
              {segmented('footerPos', t.posterFooterPositionLabel, ['top', 'bottom'] as const, footerPosition, setFooterPosition,
                (p) => (p === 'top' ? t.posterPositionTop : t.posterPositionBottom))}
              {toggle('qr', t.posterToggleQr, showQr, setShowQr)}
              {segmented('qrCorner', t.posterQrCornerLabel,
                ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const, qrCorner, setQrCorner,
                (c) => ({
                  'top-left': t.posterQrCornerTopLeft, 'top-right': t.posterQrCornerTopRight,
                  'bottom-left': t.posterQrCornerBottomLeft, 'bottom-right': t.posterQrCornerBottomRight,
                }[c]))}
            </div>

            {segmented('style', t.posterStyleLabel, ['solid', 'transparent', 'light'] as const, chromeStyle, setChromeStyle,
              (s) => ({ solid: t.posterStyleSolid, transparent: t.posterStyleTransparent, light: t.posterStyleLight }[s]))}

            {segmented('size', t.posterSizeLabel, ['normal', 'compact'] as const, chromeSize, setChromeSize,
              (s) => (s === 'normal' ? t.posterSizeNormal : t.posterSizeCompact))}

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
