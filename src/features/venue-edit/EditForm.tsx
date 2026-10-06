import { useEffect, useRef, useState } from 'react';
import { X, Check, Home, Mountain, Crosshair, Search } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { CANTONS } from '../../data/cantons';
import { forwardGeocode } from '../venues/geocoding';
import { useVenueMutations } from '../venues/useVenues';
import type { Venue, VenueInput } from '../venues/types';
import { theme } from '../../theme';
import { captureAndFormat } from '../../lib/sentry';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';
import { useAssociations } from '../associations/useAssociations';

interface EditFormProps {
  initial: Venue | null;
  onClose: () => void;
  onSaved: (v: Venue, andNew: boolean) => void;
  onStartPlacing: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  onError?: (msg: string) => void;
}

// Editable copy of a Venue plus a transient UI flag mirroring the prototype's `cantonAuto`.
type Draft = Venue & { cantonAuto: boolean };

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

  const [draft, setDraft] = useState<Draft>(() =>
    initial ? { ...initial, cantonAuto: false } : blankDraft());

  // The editor's own actions are the only thing that changes the form: typing touches the address
  // alone, the search button geocodes on request, and a map pick moves the pin.
  const [searching, setSearching] = useState(false);
  const [addressNotFound, setAddressNotFound] = useState(false);
  const [associationMissing, setAssociationMissing] = useState(false);
  // The address as typed right now, so a search result for an older address can be dropped.
  const currentAddress = useRef(draft.address);
  // A blocked save focuses the field, which scrolls it into view inside the modal.
  const associationRef = useRef<HTMLSelectElement>(null);
  // Track which picked-coords payload we've already consumed.
  const lastPicked = useRef<{ lat: number; lng: number } | null>(null);

  // A map pick moves the pin and nothing else.
  useEffect(() => {
    if (!pickedCoords) return;
    const prev = lastPicked.current;
    if (prev && prev.lat === pickedCoords.lat && prev.lng === pickedCoords.lng) return;
    lastPicked.current = pickedCoords;
    const lat = +pickedCoords.lat.toFixed(5);
    const lng = +pickedCoords.lng.toFixed(5);
    setDraft((d) => ({ ...d, lat, lng }));
  }, [pickedCoords]);

  const searchAddress = async () => {
    const address = draft.address;
    setAddressNotFound(false);
    setSearching(true);
    let res: Awaited<ReturnType<typeof forwardGeocode>> = null;
    try {
      res = await forwardGeocode(address);
    } finally {
      setSearching(false);
    }
    if (currentAddress.current !== address) return;
    if (!res) {
      setAddressNotFound(true);
      return;
    }
    setDraft((d) => ({
      ...d,
      lat: res.lat,
      lng: res.lng,
      ...(res.canton ? { canton: res.canton, cantonAuto: true } : {}),
    }));
  };

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    currentAddress.current = val;
    setAddressNotFound(false);
    setDraft((d) => ({ ...d, address: val }));
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
    if (!draft.association_id) {
      setAssociationMissing(true);
      associationRef.current?.focus();
      return;
    }
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="venue-address"
            value={draft.address}
            onChange={onAddressChange}
            placeholder={t.addressPlaceholder}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => { void searchAddress(); }}
            disabled={searching || draft.address.trim().length < 6}
            style={{
              flex: 'none', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
              background: theme.color.bg, color: theme.color.ink, fontWeight: 600, fontSize: '13px',
              padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px',
              cursor: searching ? 'default' : 'pointer',
              opacity: searching || draft.address.trim().length < 6 ? 0.5 : 1,
            }}
          >
            <Search size={14} /> {t.addressSearch}
          </button>
        </div>
        {addressNotFound && (
          <div style={{ fontSize: '11px', color: theme.color.accent, marginTop: '5px', fontWeight: 600 }}>
            {t.addressNotFound}
          </div>
        )}

        {/* canton */}
        <label htmlFor="venue-canton" style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.canton}</label>
        <select
          id="venue-canton"
          value={draft.canton}
          onChange={(e) => setDraft((d) => ({ ...d, canton: e.target.value, cantonAuto: false }))}
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
        <label htmlFor="venue-association" style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.association}</label>
        <select
          id="venue-association"
          value={draft.association_id ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setAssociationMissing(false);
            setDraft((d) => ({ ...d, association_id: value || null }));
          }}
          ref={associationRef}
          aria-invalid={associationMissing}
          aria-describedby={associationMissing ? 'venue-association-error' : undefined}
          style={{ ...inputStyle, border: '1px solid ' + (associationMissing ? theme.color.accent : theme.color.line) }}
        >
          <option value="" disabled>{t.associationPlaceholder}</option>
          {associations.childrenOf('esv').map((regional) => (
            <optgroup key={regional.id} label={associations.nameOf(regional.id)}>
              {associations.childrenOf(regional.id).map((a) => (
                <option key={a.id} value={a.id}>{associations.nameOf(a.id)}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {associationMissing && (
          <div id="venue-association-error" style={{ fontSize: '11px', color: theme.color.accent, marginTop: '5px', fontWeight: 600 }}>
            {t.associationRequired}
          </div>
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
