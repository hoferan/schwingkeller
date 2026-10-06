import { useEffect, useRef, useState } from 'react';
import { X, Check, Home, Mountain, Crosshair, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { CANTONS } from '../../data/cantons';
import { plzToCanton } from '../../data/plzRanges';
import { forwardGeocode, reverseGeocode } from '../venues/geocoding';
import { useVenueMutations } from '../venues/useVenues';
import type { Venue, VenueInput } from '../venues/types';
import { theme } from '../../theme';
import { captureAndFormat } from '../../lib/sentry';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';
import { isFeatureOn } from '../../lib/features';
import { suggestAssociation } from '../associations/suggest';
import { useAssociations } from '../associations/useAssociations';

interface EditFormProps {
  initial: Venue | null;
  onClose: () => void;
  onSaved: (v: Venue, andNew: boolean) => void;
  onStartPlacing: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  onError?: (msg: string) => void;
}

// Editable copy of a Venue plus transient UI state: `cantonAuto` mirrors the prototype, and the
// association fields drive the suggestion. None of them is saved.
type Draft = Venue & {
  cantonAuto: boolean;
  associationAuto: boolean;
  // Set once the association is a deliberate choice; suggestions no longer overwrite it.
  associationManual: boolean;
  // The Verwaltungskreis geocoding last returned, for a Bernese suggestion.
  bernDistrict: string | null;
};

// An existing venue's association counts as deliberate when it differs from what its canton
// suggests: a club across a border, or any Bernese Gau, since the venue stores no district. A
// stored null counts as automatic, so the venue gets one once its location changes.
const draftOf = (venue: Venue): Draft => ({
  ...venue,
  cantonAuto: false,
  associationAuto: false,
  associationManual:
    venue.association_id !== null && venue.association_id !== suggestAssociation({ canton: venue.canton }),
  bernDistrict: null,
});

// Every change to the canton or district goes through here, so the association follows the
// location unless it was chosen deliberately.
const withLocation = (d: Draft, canton: string, bernDistrict: string | null): Draft => {
  if (d.associationManual) return { ...d, canton, bernDistrict };
  const association_id = suggestAssociation({ canton, bernDistrict });
  return { ...d, canton, bernDistrict, association_id, associationAuto: association_id !== null };
};

const blankDraft = (): Draft => ({
  id: '',
  name: '',
  canton: 'BE',
  address: '',
  lat: 46.8,
  lng: 8.2,
  indoor: true,
  outdoor: false,
  person: '',
  phone: '',
  website: '',
  photos: [],
  association_id: null,
  cantonAuto: false,
  associationAuto: false,
  associationManual: false,
  bernDistrict: null,
});

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};
const spOn: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.accent, background: theme.color.accent, color: theme.color.accentInk,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
};
const spOff: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: theme.radius.sm, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.muted,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
};

export const EditForm = ({ initial, onClose, onSaved, onStartPlacing, pickedCoords, onError }: EditFormProps) => {
  const { t } = useTranslation();
  const { create, update, syncPhotos } = useVenueMutations();
  const associations = useAssociations();
  const showAssociation = isFeatureOn('verband');

  const [draft, setDraft] = useState<Draft>(() =>
    initial ? draftOf(initial) : blankDraft());

  // Debounce timer for forward geocoding (prototype `_geoT`).
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which picked-coords payload we've already consumed.
  const lastPicked = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => () => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
  }, []);

  // Apply a reverse-geocode result, backfilling the address and canton from the picked coordinates.
  const applyReverse = async (lat: number, lng: number) => {
    const res = await reverseGeocode(lat, lng);
    if (!res) return;
    setDraft((d) => {
      const next = { ...d, address: res.address };
      return res.canton ? { ...withLocation(next, res.canton, res.bernDistrict), cantonAuto: true } : next;
    });
  };

  // When the map delivers a new picked coordinate, update draft + backfill address/canton.
  useEffect(() => {
    if (!pickedCoords) return;
    const prev = lastPicked.current;
    if (prev && prev.lat === pickedCoords.lat && prev.lng === pickedCoords.lng) return;
    lastPicked.current = pickedCoords;
    const lat = +pickedCoords.lat.toFixed(5);
    const lng = +pickedCoords.lng.toFixed(5);
    setDraft((d) => ({ ...d, lat, lng }));
    void applyReverse(lat, lng);
  }, [pickedCoords]);

  const runForwardGeocode = async (address: string) => {
    const res = await forwardGeocode(address);
    if (!res) return;
    setDraft((d) => {
      // Ignore stale results if the address has since changed.
      if (d.address !== address) return d;
      const next = { ...d, lat: res.lat, lng: res.lng };
      return res.canton ? { ...withLocation(next, res.canton, res.bernDistrict), cantonAuto: true } : next;
    });
  };

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const c = plzToCanton(val);
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(() => { void runForwardGeocode(val); }, 900);
    setDraft((d) => {
      const next = { ...d, address: val };
      // The postcode gives no district; keep the last one while the canton stays the same.
      return c ? { ...withLocation(next, c, c === d.canton ? d.bernDistrict : null), cantonAuto: true } : next;
    });
  };

  const buildInput = (): VenueInput => ({
    name: draft.name,
    canton: draft.canton,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    indoor: draft.indoor,
    outdoor: draft.outdoor,
    person: draft.person,
    phone: draft.phone,
    website: draft.website,
    association_id: draft.association_id,
  });

  const save = async (andNew: boolean) => {
    if (!draft.name.trim()) return;
    try {
      const input = buildInput();
      const saved = initial
        ? await update.mutateAsync({ id: initial.id, input })
        : await create.mutateAsync(input);
      await syncPhotos.mutateAsync({ venueId: saved.id, original: initial?.photos ?? [], draft: draft.photos });
      onSaved(saved, andNew);
    } catch (err) {
      onError?.(captureAndFormat(err, t.saveError));
    }
  };

  const editTitle = initial ? t.editTitle : t.newTitle;
  const editingCoords = Number(draft.lat).toFixed(4) + ', ' + Number(draft.lng).toFixed(4);
  const saving = create.isPending || update.isPending;

  return (
    <Modal onClose={onClose} width={480}>
      <div
        style={{
          position: 'sticky', top: 0, background: theme.color.bg, borderBottom: '1px solid ' + theme.color.line,
          padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
        }}
      >
        <span style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '17px', fontWeight: 700, color: theme.color.ink }}>
          {editTitle}
        </span>
        <button
          onClick={onClose}
          aria-label={t.close}
          style={{
            border: 'none', background: 'transparent', color: theme.color.ink, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: '16px 18px 18px' }}>
        {/* photo */}
        <label style={{ ...labelStyle, marginBottom: '7px' }}>{t.photo}</label>
        <div style={{ marginBottom: '16px' }}>
          <PhotoGalleryEditor
            photos={draft.photos}
            onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
            onError={onError}
          />
        </div>

        {/* name */}
        <label htmlFor="venue-name" style={labelStyle}>{t.name}</label>
        <input
          id="venue-name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={inputStyle}
        />

        {/* address */}
        <label htmlFor="venue-address" style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.address}</label>
        <input
          id="venue-address"
          value={draft.address}
          onChange={onAddressChange}
          placeholder={t.addressPlaceholder}
          style={inputStyle}
        />

        {/* canton */}
        <label htmlFor="venue-canton" style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.canton}</label>
        <select
          id="venue-canton"
          value={draft.canton}
          onChange={(e) => setDraft((d) => ({ ...withLocation(d, e.target.value, null), cantonAuto: false }))}
          style={inputStyle}
        >
          {CANTONS.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        {draft.cantonAuto && (
          <div
            style={{
              fontSize: '11px', color: theme.color.ink, marginTop: '5px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Check size={12} /> {t.cantonAuto}
          </div>
        )}

        {/* association */}
        {showAssociation && (
          <>
            <label htmlFor="venue-association" style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.association}</label>
            <select
              id="venue-association"
              value={draft.association_id ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setDraft((d) => ({ ...d, association_id: value || null, associationManual: true, associationAuto: false }));
              }}
              style={inputStyle}
            >
              <option value="">{t.associationNone}</option>
              {associations.childrenOf('esv').map((regional) => (
                <optgroup key={regional.id} label={associations.nameOf(regional.id)}>
                  {associations.childrenOf(regional.id).map((a) => (
                    <option key={a.id} value={a.id}>{associations.nameOf(a.id)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {draft.associationAuto && (
              <div
                style={{
                  fontSize: '11px', color: theme.color.ink, marginTop: '5px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Check size={12} /> {t.associationAuto}
              </div>
            )}
          </>
        )}

        {/* spaces */}
        <label style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.space}</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setDraft((d) => ({ ...d, indoor: !d.indoor }))}
            style={draft.indoor ? spOn : spOff}
          >
            <Home size={14} /> {t.indoor}
          </button>
          <button
            onClick={() => setDraft((d) => ({ ...d, outdoor: !d.outdoor }))}
            style={draft.outdoor ? spOn : spOff}
          >
            <Mountain size={14} /> {t.outdoor}
          </button>
        </div>

        {/* location */}
        <label style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.location}</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1, background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
              padding: '11px 13px', fontSize: '13px', color: theme.color.ink, fontFamily: 'monospace',
            }}
          >
            {editingCoords}
          </div>
          <button
            onClick={onStartPlacing}
            style={{
              border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink, fontWeight: 600,
              fontSize: '13px', padding: '11px 14px', borderRadius: theme.radius.sm, cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Crosshair size={14} /> {t.pickOnMap}
          </button>
        </div>
        <div
          style={{
            fontSize: '11px', color: theme.color.muted, marginTop: '5px',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          <ArrowUpDown size={12} /> {t.locSync}
        </div>

        {/* contact */}
        <label style={{ ...labelStyle, margin: '16px 0 6px' }}>{t.contact}</label>
        <input
          value={draft.person}
          onChange={(e) => setDraft((d) => ({ ...d, person: e.target.value }))}
          placeholder={t.person}
          style={inputStyle}
        />
        <div style={{ height: '9px' }}></div>
        <input
          value={draft.phone}
          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          placeholder={t.phone}
          style={inputStyle}
        />
        <div style={{ height: '9px' }}></div>
        <input
          value={draft.website}
          onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
          placeholder={t.website}
          style={inputStyle}
        />
      </div>

      <div
        style={{
          position: 'sticky', bottom: 0, background: theme.color.bg, borderTop: '1px solid ' + theme.color.line,
          padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: '9px',
        }}
      >
        <button
          onClick={() => { void save(false); }}
          disabled={saving}
          style={{
            width: '100%', border: 'none', background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600,
            fontSize: '14px', padding: '12px', borderRadius: theme.radius.sm, cursor: 'pointer',
          }}
        >
          {t.saveClose}
        </button>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: 'transparent', color: theme.color.ink,
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>
          <button
            onClick={() => { void save(true); }}
            disabled={saving}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm, cursor: 'pointer',
            }}
          >
            {t.saveNew}
          </button>
        </div>
      </div>
    </Modal>
  );
};
