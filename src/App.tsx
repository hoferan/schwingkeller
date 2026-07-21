import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Crosshair, ArrowRight } from 'lucide-react';
import { Topbar } from './components/Topbar';
import { Modal } from './components/Modal';
import { Sidebar } from './features/sidebar/Sidebar';
import { MapView } from './features/map/MapView';
import { DetailModal } from './features/venue-detail/DetailModal';
import { EditForm } from './features/venue-edit/EditForm';
import { LoginModal } from './features/auth/LoginModal';
import { useVenues, useVenueMutations } from './features/venues/useVenues';
import { parseCSV, toCSV, toJSON, normalizeVenue } from './features/venues/importExport';
import type { Venue, VenueInput } from './features/venues/types';
import { I18nContext, useTranslation, loadLang, saveLang } from './i18n/useTranslation';
import { STR, type Lang } from './i18n/translations';
import { captureAndFormat } from './lib/sentry';
import { theme } from './theme';
import { parseCantonParam, parseVenueParam } from './lib/permalink';
import { boundsForCanton } from './data/cantonBounds';
import { useVenuePermalink } from './features/venues/useVenuePermalink';
import { PosterEditorModal } from './features/venues/PosterEditorModal';
import { shareVenueUrl } from './lib/share';
import { useGeolocation } from './features/geo/useGeolocation';
import type { SortMode } from './features/venues/grouping';

type Mode = 'd' | 't' | 'm';
const modeOf = (vw: number): Mode => (vw >= 1024 ? 'd' : vw >= 640 ? 't' : 'm');

// Strip the synthetic id and flatten the gallery into photo_urls for the
// bulk-replace RPC shape.
const toInput = (v: Venue): VenueInput & { photo_urls: string[] } => {
  const { id: _id, photos, ...rest } = v;
  void _id;
  return { ...rest, photo_urls: photos.map((p) => p.url) };
};

const download = (name: string, type: string, data: string) => {
  try {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
  } catch (err) {
    console.warn('download failed', err);
  }
};

const downloadBlob = (name: string, blob: Blob) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 120);
  } catch (err) {
    console.warn('download failed', err);
  }
};

function AppShell() {
  const { t } = useTranslation();
  const { data: venues = [], isSuccess: venuesLoaded } = useVenues();
  const m = useVenueMutations();

  // Responsive width tracking.
  const [vw, setVw] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const mode = modeOf(vw);
  const isMobile = mode === 'm';
  const isTablet = mode === 't';

  // Cross-cutting UI state.
  // Parsed once at startup. ?venue= takes precedence over ?ctn= — see
  // docs/superpowers/specs/2026-07-10-venue-permalink-share-design.md.
  const [venueParam] = useState<string | null>(() => parseVenueParam(window.location.search));
  const [ctnParam] = useState<string | null>(() =>
    venueParam ? null : parseCantonParam(window.location.search),
  );
  const [search, setSearch] = useState('');
  // No canton expanded by default — only a ?ctn= permalink pre-expands its canton.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    ctnParam ? { [ctnParam]: true } : {},
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [baseKind, setBaseKind] = useState<'map' | 'sat'>('map');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('canton');
  const geo = useGeolocation();

  // Edit-form state. `editOpen` controls whether the form should exist at all;
  // `editInitial` holds the Venue being edited (null = new). While `placing`
  // is true the form is hidden but its state is preserved (editOpen stays true).
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Venue | null>(null);
  // Bumped at the start of every NEW edit session so the <EditForm> remounts and
  // re-initializes its draft from `initial`. NOT bumped on the placing flow, which
  // must preserve the draft across a map pick.
  const [editSession, setEditSession] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Import confirmation (staged file) + transient status toast.
  const [pendingImport, setPendingImport] = useState<
    { count: number; inputs: (VenueInput & { photo_urls: string[] })[] } | null
  >(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [posterEditorCode, setPosterEditorCode] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const showFlash = (kind: 'ok' | 'err', text: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setFlash({ kind, text });
    flashTimer.current = window.setTimeout(() => setFlash(null), 4500);
  };
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  useEffect(() => {
    // Toast reacts to a status change reported by the browser's geolocation callback (an
    // external system), not to render-derived state — safe to setState here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (geo.status === 'denied') showFlash('err', t.locationDenied);
    else if (geo.status === 'error') showFlash('err', t.locationError);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.status]);

  const detailVenue = detailId ? venues.find((v) => v.id === detailId) ?? null : null;
  const initialFocusBounds = ctnParam ? boundsForCanton(ctnParam) : null;

  // ---- layout styles (prototype renderVals ~624-631) ----
  const mainStyle: CSSProperties = { position: 'relative', flex: '1 1 auto', display: 'flex', minHeight: 0 };
  const mapWrapStyle: CSSProperties = { position: 'relative', flex: '1 1 auto', minWidth: 0, minHeight: 0 };

  // ---- handlers ----
  const selectVenue = (id: string) => { setSelectedId(id); setSidebarOpen(false); };
  const openDetail = (id: string) => { setDetailId(id); setSelectedId(id); };
  const closeDetail = () => setDetailId(null);

  useVenuePermalink({ venueParam, venues, venuesLoaded, detailId, openDetail, setExpanded });

  const navigate = () => {
    if (detailVenue) {
      window.open(
        'https://www.google.com/maps/dir/?api=1&destination=' + detailVenue.lat + ',' + detailVenue.lng,
        '_blank',
      );
    }
  };

  const shareVenue = async () => {
    if (!detailVenue) return;
    try {
      const outcome = await shareVenueUrl(detailVenue.name, window.location.href, {
        share: navigator.share ? (data) => navigator.share(data) : undefined,
        copy: (text) => navigator.clipboard.writeText(text),
      });
      if (outcome === 'copied') showFlash('ok', t.linkCopied);
    } catch (err) {
      showFlash('err', captureAndFormat(err, t.shareFailed));
    }
  };

  const openEdit = () => {
    if (!detailVenue) return;
    setEditInitial(detailVenue);
    setEditOpen(true);
    setEditSession((n) => n + 1);
    setPickedCoords(null);
    setPlacing(false);
    setDetailId(null);
  };
  const openAdd = () => {
    setEditInitial(null);
    setEditOpen(true);
    setEditSession((n) => n + 1);
    setPickedCoords(null);
    setPlacing(false);
    setDetailId(null);
    setSidebarOpen(false);
  };
  const closeEdit = () => {
    setEditOpen(false);
    setEditInitial(null);
    setPlacing(false);
    setPickedCoords(null);
  };

  const onSaved = (saved: Venue, andNew: boolean) => {
    setSelectedId(saved.id);
    if (andNew) {
      // Re-open a fresh blank form.
      setEditInitial(null);
      setEditOpen(true);
      setEditSession((n) => n + 1);
      setPickedCoords(null);
      setPlacing(false);
    } else {
      closeEdit();
    }
  };

  // Placing state-machine: hide the form (placing=true) but keep editOpen so the
  // form's draft survives; when a point is picked, deliver new pickedCoords and reshow.
  const startPlacing = () => setPlacing(true);
  const cancelPlacing = () => setPlacing(false);
  const onPickLocation = (lat: number, lng: number) => {
    setPickedCoords({ lat, lng });
    setPlacing(false);
  };

  const askDelete = () => { if (detailVenue) setConfirmId(detailVenue.id); };
  const cancelDelete = () => setConfirmId(null);
  const confirmDelete = async () => {
    if (!confirmId) return;
    try {
      await m.remove.mutateAsync(confirmId);
      // Success: clear the selection/detail for the now-deleted venue.
      setDetailId(null);
      setSelectedId(null);
    } catch (err) {
      // Failure: keep the venue selected/open; only report and close the dialog.
      showFlash('err', captureAndFormat(err, t.deleteError));
    } finally {
      setConfirmId(null);
    }
  };

  const openPosterEditor = (code: string) => setPosterEditorCode(code);
  const closePosterEditor = () => setPosterEditorCode(null);
  const savePoster = (blob: Blob, filename: string) => {
    downloadBlob(filename, blob);
    closePosterEditor();
  };

  const toggleCanton = (code: string) =>
    setExpanded((e) => ({ ...e, [code]: !e[code] }));

  // ---- import / export ----
  const onExportJSON = () => download('schwingkeller.json', 'application/json', toJSON(venues));
  const onExportCSV = () => download('schwingkeller.csv', 'text/csv;charset=utf-8', toCSV(venues));

  // Parse + validate the file, then STAGE it for an explicit confirmation
  // (the import replaces all venues, so it must not run silently).
  const onImport = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const txt = String(r.result);
        const trimmed = txt.trim();
        const isCsv = file.name.toLowerCase().endsWith('.csv') || (trimmed[0] !== '[' && trimmed[0] !== '{');
        let rows: Record<string, unknown>[];
        if (isCsv) {
          rows = parseCSV(txt);
        } else {
          const j = JSON.parse(txt);
          rows = Array.isArray(j) ? j : (j.venues ?? []);
        }
        if (!Array.isArray(rows) || rows.length === 0) {
          showFlash('err', t.importEmpty);
          return;
        }
        const inputs = rows.map((row, i) => toInput(normalizeVenue(row, i)));
        setPendingImport({ count: inputs.length, inputs });
      } catch {
        showFlash('err', t.importFailed);
      }
    };
    r.readAsText(file);
  };

  const cancelImport = () => setPendingImport(null);
  const runImport = async () => {
    if (!pendingImport) return;
    const { count, inputs } = pendingImport;
    setPendingImport(null);
    try {
      await m.replaceAll.mutateAsync(inputs);
      setDetailId(null);
      setSelectedId(null);
      setSearch('');
      showFlash('ok', t.importDone + ' (' + count + ')');
    } catch (err) {
      showFlash('err', captureAndFormat(err, t.importFailed));
    }
  };

  // Keep EditForm mounted whenever editOpen, even while placing, so its internal
  // draft (pre-pick edits) survives. While placing we visually hide it and remove
  // it from layout (display:none) so the map underneath is clickable for the pick.
  const showEditForm = editOpen;

  return (
    <div
      style={{
        height: '100dvh', display: 'flex', flexDirection: 'column', background: theme.color.bg,
        overflow: 'hidden', fontFamily: theme.font.body,
      }}
    >
      <Topbar onOpenLogin={() => setShowLogin(true)} isMobile={isMobile} />

      <div style={mainStyle}>
        <Sidebar
          venues={venues}
          search={search}
          onSearch={setSearch}
          expanded={expanded}
          onToggleCanton={toggleCanton}
          selectedId={selectedId}
          onSelect={selectVenue}
          isMobile={isMobile}
          isTablet={isTablet}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onSetSidebarOpen={setSidebarOpen}
          onAdd={openAdd}
          onExportJSON={onExportJSON}
          onExportCSV={onExportCSV}
          onImport={onImport}
          sortMode={sortMode}
          onSortMode={setSortMode}
          userPosition={geo.position}
          geoStatus={geo.status}
          onRequestLocation={geo.request}
          onGeneratePoster={openPosterEditor}
        />

        <div style={mapWrapStyle}>
          <MapView
            venues={venues}
            selectedId={selectedId}
            onSelect={selectVenue}
            onOpenDetail={openDetail}
            baseKind={baseKind}
            onChangeBase={setBaseKind}
            placing={placing}
            onPickLocation={onPickLocation}
            initialFocusBounds={initialFocusBounds}
            userPosition={geo.position}
            geoStatus={geo.status}
            onRequestLocation={geo.request}
          />
        </div>
      </div>

      {detailVenue && (
        <DetailModal
          venue={detailVenue}
          onClose={closeDetail}
          onNavigate={navigate}
          onShare={() => { void shareVenue(); }}
          onEdit={openEdit}
          onDelete={askDelete}
        />
      )}

      {showEditForm && (
        <div style={{ display: placing ? 'none' : 'contents' }}>
          <EditForm
            key={editSession}
            initial={editInitial}
            onClose={closeEdit}
            onSaved={onSaved}
            onStartPlacing={startPlacing}
            pickedCoords={pickedCoords}
            onError={(msg) => showFlash('err', msg)}
          />
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {posterEditorCode && (
        <PosterEditorModal
          code={posterEditorCode}
          venues={venues}
          initialBaseKind={baseKind}
          unitLabel={t.unitTotal}
          onClose={closePosterEditor}
          onSave={savePoster}
          onError={(err) => showFlash('err', captureAndFormat(err, t.posterGenerateFailed))}
        />
      )}

      {/* Placing banner */}
      {placing && (
        <div
          style={{
            position: 'fixed', top: '74px', left: '50%', transform: 'translateX(-50%)', zIndex: 1700,
            background: theme.color.ink, color: theme.color.bg, padding: '12px 16px', borderRadius: theme.radius.sm,
            boxShadow: theme.shadow, display: 'flex', gap: '14px', alignItems: 'center',
            maxWidth: 'calc(100% - 32px)', animation: 'popIn .24s ease',
          }}
        >
          <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Crosshair size={14} /> {t.pickHint}
          </span>
          <button
            onClick={cancelPlacing}
            style={{
              border: '1px solid ' + theme.color.bg, background: 'transparent', color: theme.color.bg, fontWeight: 600,
              fontSize: '12.5px', padding: '6px 12px', borderRadius: theme.radius.sm, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t.cancel}
          </button>
        </div>
      )}

      {/* Delete confirm */}
      {confirmId && (
        <Modal onClose={cancelDelete} width={340} zIndex={1600}>
          <div style={{ padding: '22px' }}>
            <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700, color: theme.color.ink }}>
              {t.deleteTitle}
            </div>
            <div style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '8px', lineHeight: 1.5 }}>
              {t.deleteBody}
            </div>
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelDelete}
                style={{
                  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void confirmDelete(); }}
                style={{
                  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.confirmDelete}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import confirm — import replaces ALL venues, so require explicit confirmation. */}
      {pendingImport && (
        <Modal onClose={cancelImport} width={360} zIndex={1600}>
          <div style={{ padding: '22px' }}>
            <div style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700, color: theme.color.ink }}>
              {t.importTitle}
            </div>
            <div style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '8px', lineHeight: 1.5 }}>
              {t.importBody}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ flex: 1, background: theme.color.paper, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '9px 11px', color: theme.color.ink }}>
                <div style={{ opacity: 0.7 }}>{t.importExisting}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: theme.font.display }}>{venues.length}</div>
              </div>
              <div style={{ color: theme.color.accent, flex: 'none', display: 'flex', alignItems: 'center' }}>
                <ArrowRight size={18} />
              </div>
              <div style={{ flex: 1, background: theme.color.paper, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '9px 11px', color: theme.color.ink }}>
                <div style={{ opacity: 0.7 }}>{t.import}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: theme.font.display }}>{pendingImport.count}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
              <button
                onClick={cancelImport}
                style={{
                  flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { void runImport(); }}
                style={{
                  flex: 1, border: 'none', background: theme.color.accent, color: theme.color.accentInk,
                  fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
                }}
              >
                {t.importReplace}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transient status toast (import result, etc.) */}
      {flash && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: '22px', left: '50%', transform: 'translateX(-50%)', zIndex: 1800,
            background: flash.kind === 'ok' ? theme.color.ink : theme.color.accent, color: theme.color.bg,
            padding: '12px 18px', borderRadius: theme.radius.sm, boxShadow: theme.shadow,
            fontSize: '13.5px', fontWeight: 600, maxWidth: 'calc(100% - 32px)', textAlign: 'center',
            animation: 'popIn .24s ease',
          }}
        >
          {flash.text}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(() => loadLang());
  const setLang = (l: Lang) => { setLangState(l); saveLang(l); };

  return (
    <I18nContext.Provider value={{ lang, t: STR[lang] as typeof STR.de, setLang }}>
      <AppShell />
    </I18nContext.Provider>
  );
}
