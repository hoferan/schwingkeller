import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Crosshair } from 'lucide-react';
import { Topbar } from './components/Topbar';
import { Modal } from './components/Modal';
import { Sidebar } from './features/sidebar/Sidebar';
import { MapView } from './features/map/MapView';
import { DetailModal } from './features/venue-detail/DetailModal';
import { EditForm } from './features/venue-edit/EditForm';
import { LoginModal } from './features/auth/LoginModal';
import { useVenues, useVenueMutations } from './features/venues/useVenues';
import type { Venue } from './features/venues/types';
import { I18nContext, useTranslation, loadLang, saveLang } from './i18n/useTranslation';
import { STR, type Lang } from './i18n/translations';
import { captureAndFormat } from './lib/sentry';
import { theme } from './theme';
import { associationForCanton, parseAssociationParam, parseCantonParam, parseVenueParam } from './lib/permalink';
import { boundsForCanton } from './data/cantonBounds';
import { useVenuePermalink } from './features/venues/useVenuePermalink';
import { PosterEditorModal } from './features/venues/PosterEditorModal';
import { shareVenueUrl } from './lib/share';
import { useGeolocation } from './features/geo/useGeolocation';
import type { SortMode } from './features/venues/grouping';
import { useAssociations } from './features/associations/useAssociations';
import { UNASSIGNED_KEY } from './features/sidebar/AssociationGroups';
import { boundsForAssociation, expandedKeysFor } from './features/associations/focus';
import { isFeatureOn } from './lib/features';

type Mode = 'd' | 't' | 'm';
const modeOf = (vw: number): Mode => (vw >= 1024 ? 'd' : vw >= 640 ? 't' : 'm');

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
  // Parsed once at startup. ?venue= takes precedence over the others. With the verband flag on, a
  // ?ctn= link lands on its Verband or Teilverband instead of the canton. See src/lib/permalink.ts
  // and docs/adr/0007-url-parameters-without-a-router.md.
  const [venueParam] = useState<string | null>(() => parseVenueParam(window.location.search));
  const [ctnParam] = useState<string | null>(() =>
    venueParam || isFeatureOn('verband') ? null : parseCantonParam(window.location.search),
  );
  const [vbParam] = useState<string | null>(() => {
    if (venueParam || !isFeatureOn('verband')) return null;
    const search = window.location.search;
    const code = parseCantonParam(search);
    return parseAssociationParam(search) ?? (code ? associationForCanton(code) : null);
  });
  const [search, setSearch] = useState('');
  // Keyed by canton code or association id. With the verband flag on, the Teilverbände and the
  // admin group start open and the Verbände closed, and a ?vb= permalink opens its own. No canton
  // starts open; a ?ctn= permalink opens its own.
  const associations = useAssociations();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const open = isFeatureOn('verband')
      ? [...associations.childrenOf('esv').map((a) => a.id), UNASSIGNED_KEY]
      : [];
    if (ctnParam) open.push(ctnParam);
    if (vbParam) open.push(...expandedKeysFor(vbParam, associations));
    return Object.fromEntries(open.map((key) => [key, true]));
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [baseKind, setBaseKind] = useState<'map' | 'sat'>('map');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    isFeatureOn('verband') ? 'association' : 'canton',
  );
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
  // A canton's box is known at once. A Verband is framed to its venues, so its box waits for them;
  // MapView flies to the first bounds it gets and ignores later ones.
  const initialFocusBounds = useMemo(() => {
    if (ctnParam) return boundsForCanton(ctnParam);
    if (vbParam && venuesLoaded) return boundsForAssociation(vbParam, venues, associations);
    return null;
  }, [ctnParam, vbParam, venuesLoaded, venues, associations]);

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

  const toggleGroup = (key: string) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

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
          onToggleGroup={toggleGroup}
          selectedId={selectedId}
          onSelect={selectVenue}
          isMobile={isMobile}
          isTablet={isTablet}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onSetSidebarOpen={setSidebarOpen}
          onAdd={openAdd}
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
            isMobile={isMobile}
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


      {/* Transient status toast */}
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
