import { Modal } from '../../components/Modal';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../../i18n/useTranslation';
import { wappenUrl } from '../../data/cantons';
import type { Venue } from '../venues/types';

interface DetailModalProps {
  venue: Venue;
  onClose: () => void;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const contactIcon: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: '9px', background: '#ecdcb6',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
  color: '#7a5e2e', flex: 'none',
};
const contactLabel: React.CSSProperties = {
  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#b09a6e',
};
const contactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0', textDecoration: 'none',
};
const tag: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: '#5a4a2a', background: '#ead8aa',
  padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px',
};

export const DetailModal = ({ venue, onClose, onNavigate, onEdit, onDelete }: DetailModalProps) => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();

  const wappen = wappenUrl(venue.canton);
  const phoneUrl = 'tel:' + venue.phone.replace(/\s/g, '');
  const websiteUrl = 'https://' + venue.website.replace(/^https?:\/\//, '');

  return (
    <Modal onClose={onClose}>
      <div
        style={{
          position: 'relative', height: '194px', background: '#d8c79c',
          borderRadius: '16px 16px 0 0', overflow: 'hidden',
        }}
      >
        {venue.photo_url ? (
          <img
            src={venue.photo_url}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg,#d8c79c 0 12px,#cdbb8c 12px 24px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace', fontSize: '11px', letterSpacing: '.12em', color: '#7a6342',
                background: 'rgba(248,239,219,.88)', padding: '6px 11px', borderRadius: '5px',
              }}
            >
              FOTO · {venue.name}
            </span>
          </div>
        )}
        <div
          style={{
            position: 'absolute', top: '11px', right: '11px', width: '36px', height: '44px',
            background: 'rgba(246,237,217,.92)', borderRadius: '6px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          }}
        >
          {wappen && (
            <img src={wappen} alt="" style={{ width: '26px', height: '32px', objectFit: 'contain' }} />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '11px', left: '11px', width: '32px', height: '32px',
            borderRadius: '50%', border: 'none', background: 'rgba(42,29,16,.62)', color: '#f4ead4',
            fontSize: '17px', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <div
          style={{
            fontFamily: "'Bitter',serif", fontSize: '21px', fontWeight: 800,
            color: '#2e2013', lineHeight: 1.18,
          }}
        >
          {venue.name}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '5px',
            color: '#9a8460', fontSize: '13px',
          }}
        >
          <span style={{ marginTop: '1px' }}>⌖</span>
          <span>{venue.address}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {venue.indoor && <span style={tag}>⌂ {t.indoor}</span>}
          {venue.outdoor && <span style={tag}>⛰ {t.outdoor}</span>}
        </div>
        <div style={{ height: '1px', background: '#e3d3ad', margin: '18px 0 14px' }}></div>
        <div
          style={{
            fontFamily: "'Bitter',serif", fontSize: '11px', letterSpacing: '.14em',
            textTransform: 'uppercase', color: '#9a7c45', fontWeight: 700, marginBottom: '4px',
          }}
        >
          {t.contact}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0' }}>
          <span style={contactIcon}>◉</span>
          <div>
            <div style={contactLabel}>{t.person}</div>
            <div style={{ fontSize: '14px', color: '#3a2a18', fontWeight: 600 }}>{venue.person}</div>
          </div>
        </div>
        {venue.phone && (
          <a href={phoneUrl} style={contactRow}>
            <span style={contactIcon}>✆</span>
            <div>
              <div style={contactLabel}>{t.phone}</div>
              <div style={{ fontSize: '14px', color: '#2a6f6a', fontWeight: 600 }}>{venue.phone}</div>
            </div>
          </a>
        )}
        {venue.website && (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={contactRow}>
            <span style={{ ...contactIcon, fontSize: '14px' }}>⊕</span>
            <div>
              <div style={contactLabel}>{t.website}</div>
              <div style={{ fontSize: '14px', color: '#2a6f6a', fontWeight: 600 }}>{venue.website}</div>
            </div>
          </a>
        )}
        <button
          onClick={onNavigate}
          style={{
            marginTop: '16px', width: '100%', border: 'none', cursor: 'pointer',
            background: '#2e2013', color: '#f4ead4', fontWeight: 600, fontSize: '14px',
            padding: '13px', borderRadius: '11px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}
        >
          {t.navigate} ↗
        </button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={onEdit}
              style={{
                flex: 1, border: '1.5px solid #c9a85e', background: '#fbf6ea', color: '#5a4527',
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px',
                cursor: 'pointer',
              }}
            >
              {t.edit}
            </button>
            <button
              onClick={onDelete}
              style={{
                flex: 1, border: '1.5px solid #cf9a8a', background: '#f8ece8', color: '#a3402c',
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: '11px',
                cursor: 'pointer',
              }}
            >
              {t.delete}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
