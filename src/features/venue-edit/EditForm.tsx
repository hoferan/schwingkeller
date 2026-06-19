import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { CANTONS } from '../../data/cantons';
import { plzToCanton } from '../../data/plzRanges';
import { forwardGeocode, reverseGeocode } from '../venues/geocoding';
import { uploadPhoto } from '../venues/api';
import { useVenueMutations } from '../venues/useVenues';
import type { Venue, VenueInput } from '../venues/types';

interface EditFormProps {
  initial: Venue | null;
  onClose: () => void;
  onSaved: (v: Venue, andNew: boolean) => void;
  onStartPlacing: () => void;
  pickedCoords: { lat: number; lng: number } | null;
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
  photo_url: null,
  cantonAuto: false,
});

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0cfa6', borderRadius: '9px', padding: '11px 13px',
  fontSize: '14px', color: '#3a2a18', background: '#fff', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#9a7c45', marginBottom: '6px',
};
const spOn: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: '9px', border: '1.5px solid #c0851d', background: '#f3e2b6', color: '#5a4527',
};
const spOff: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', padding: '11px',
  borderRadius: '9px', border: '1.5px solid #e0cfa6', background: '#fff', color: '#a8916c',
};

export const EditForm = ({ initial, onClose, onSaved, onStartPlacing, pickedCoords }: EditFormProps) => {
  const { t } = useTranslation();
  const { create, update } = useVenueMutations();

  const [draft, setDraft] = useState<Draft>(() =>
    initial ? { ...initial, cantonAuto: false } : blankDraft());

  // Debounce timer for forward geocoding (prototype `_geoT`).
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against the reverse->forward geocode loop (prototype `_syncSkip`):
  // when address is set programmatically from a reverse geocode, skip the next forward geocode.
  const syncSkip = useRef(false);
  // Track which picked-coords payload we've already consumed.
  const lastPicked = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => () => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
  }, []);

  // Apply a reverse-geocode result, setting syncSkip so the address change does not re-trigger forward geocode.
  const applyReverse = async (lat: number, lng: number) => {
    const res = await reverseGeocode(lat, lng);
    if (!res) return;
    syncSkip.current = true;
    setDraft((d) => ({
      ...d,
      address: res.address,
      ...(res.canton ? { canton: res.canton, cantonAuto: true } : {}),
    }));
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
    if (syncSkip.current) { syncSkip.current = false; return; }
    const res = await forwardGeocode(address);
    if (!res) return;
    setDraft((d) => {
      // Ignore stale results if the address has since changed.
      if (d.address !== address) return d;
      return { ...d, lat: res.lat, lng: res.lng, ...(res.canton ? { canton: res.canton, cantonAuto: true } : {}) };
    });
  };

  const onAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const c = plzToCanton(val);
    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(() => { void runForwardGeocode(val); }, 900);
    setDraft((d) => ({
      ...d,
      address: val,
      ...(c ? { canton: c, cantonAuto: true } : {}),
    }));
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadPhoto(f);
      setDraft((d) => ({ ...d, photo_url: url }));
    } catch (err) {
      // Keep prior value; surface the failure non-fatally.
      alert('Upload fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      e.target.value = '';
    }
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
    photo_url: draft.photo_url,
  });

  const save = async (andNew: boolean) => {
    if (!draft.name.trim()) return;
    try {
      const input = buildInput();
      const saved = initial
        ? await update.mutateAsync({ id: initial.id, input })
        : await create.mutateAsync(input);
      onSaved(saved, andNew);
    } catch (err) {
      alert('Speichern fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const editTitle = initial ? t.editTitle : t.newTitle;
  const editingCoords = Number(draft.lat).toFixed(4) + ', ' + Number(draft.lng).toFixed(4);
  const saving = create.isPending || update.isPending;

  return (
    <Modal onClose={onClose} width={480}>
      <div
        style={{
          position: 'sticky', top: 0, background: '#f0e4c4', borderBottom: '1px solid #ddc99a',
          padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
        }}
      >
        <span style={{ fontFamily: "'Bitter',serif", fontSize: '17px', fontWeight: 800, color: '#2e2013' }}>
          {editTitle}
        </span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', color: '#9a7c45', fontSize: '19px', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '16px 18px 18px' }}>
        {/* photo */}
        <label style={{ ...labelStyle, marginBottom: '7px' }}>{t.photo}</label>
        <label
          style={{
            display: 'block', height: '128px', borderRadius: '11px', overflow: 'hidden', cursor: 'pointer',
            border: '1.5px dashed #c9a85e', position: 'relative', marginBottom: '16px',
          }}
        >
          {draft.photo_url ? (
            <img
              src={draft.photo_url}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'repeating-linear-gradient(45deg,#ece0c6 0 11px,#e3d4b2 11px 22px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', color: '#9a7c45',
              }}
            >
              <span style={{ fontSize: '22px' }}>⬆</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{t.upload}</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
        </label>

        {/* name */}
        <label style={labelStyle}>{t.name}</label>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={inputStyle}
        />

        {/* address */}
        <label style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.address}</label>
        <input
          value={draft.address}
          onChange={onAddressChange}
          placeholder={t.addressPlaceholder}
          style={inputStyle}
        />

        {/* canton */}
        <label style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.canton}</label>
        <select
          value={draft.canton}
          onChange={(e) => setDraft((d) => ({ ...d, canton: e.target.value, cantonAuto: false }))}
          style={inputStyle}
        >
          {CANTONS.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        {draft.cantonAuto && (
          <div style={{ fontSize: '11px', color: '#6f8a4e', marginTop: '5px', fontWeight: 600 }}>
            ✓ {t.cantonAuto}
          </div>
        )}

        {/* spaces */}
        <label style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.space}</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setDraft((d) => ({ ...d, indoor: !d.indoor }))}
            style={draft.indoor ? spOn : spOff}
          >
            ⌂ {t.indoor}
          </button>
          <button
            onClick={() => setDraft((d) => ({ ...d, outdoor: !d.outdoor }))}
            style={draft.outdoor ? spOn : spOff}
          >
            ⛰ {t.outdoor}
          </button>
        </div>

        {/* location */}
        <label style={{ ...labelStyle, margin: '14px 0 6px' }}>{t.location}</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              flex: 1, background: '#fff', border: '1px solid #e0cfa6', borderRadius: '9px',
              padding: '11px 13px', fontSize: '13px', color: '#7a6342', fontFamily: 'monospace',
            }}
          >
            {editingCoords}
          </div>
          <button
            onClick={onStartPlacing}
            style={{
              border: '1.5px solid #c9a85e', background: '#fbf6ea', color: '#5a4527', fontWeight: 600,
              fontSize: '13px', padding: '11px 14px', borderRadius: '9px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⌖ {t.pickOnMap}
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#a08a64', marginTop: '5px' }}>↕ {t.locSync}</div>

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
          position: 'sticky', bottom: 0, background: '#f0e4c4', borderTop: '1px solid #ddc99a',
          padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: '9px',
        }}
      >
        <button
          onClick={() => { void save(false); }}
          disabled={saving}
          style={{
            width: '100%', border: 'none', background: '#2e2013', color: '#f4ead4', fontWeight: 600,
            fontSize: '14px', padding: '12px', borderRadius: '11px', cursor: 'pointer',
          }}
        >
          {t.saveClose}
        </button>
        <div style={{ display: 'flex', gap: '9px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, border: '1.5px solid #c9a85e', background: 'transparent', color: '#5a4527',
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px', cursor: 'pointer',
            }}
          >
            {t.cancel}
          </button>
          <button
            onClick={() => { void save(true); }}
            disabled={saving}
            style={{
              flex: 1, border: '1.5px solid #b3892f', background: '#fbf0d4', color: '#7a5618',
              fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px', cursor: 'pointer',
            }}
          >
            {t.saveNew}
          </button>
        </div>
      </div>
    </Modal>
  );
};
