import { X, MapPin, Home, Mountain, User, Phone, Globe, ExternalLink, Share2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../../i18n/useTranslation';
import { wappenUrl } from '../../data/cantons';
import { isFeatureOn } from '../../lib/features';
import { RegionalBadge } from '../associations/AssociationMark';
import { useAssociations } from '../associations/useAssociations';
import type { Venue } from '../venues/types';
import { theme } from '../../theme';
import { PhotoGallery } from './PhotoGallery';

interface DetailModalProps {
  venue: Venue;
  onClose: () => void;
  onNavigate: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const contactIcon: React.CSSProperties = {
  width: '32px', height: '32px', borderRadius: theme.radius.sm, background: theme.color.paper,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
  color: theme.color.ink, flex: 'none',
};
const contactLabel: React.CSSProperties = {
  fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: theme.color.muted,
};
const contactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0', textDecoration: 'none',
};
// Over a photo the close button is dark so it reads on any image; on the white header it is light.
const closeButton = (overPhoto: boolean): React.CSSProperties => ({
  width: '32px', height: '32px', borderRadius: '50%', border: 'none', flex: 'none', cursor: 'pointer',
  background: overPhoto ? 'rgba(17,17,17,.7)' : theme.color.paper,
  color: overPhoto ? theme.color.bg : theme.color.ink,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
const tag: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: theme.color.ink, background: theme.color.paper,
  border: '1px solid ' + theme.color.line, padding: '6px 12px', borderRadius: theme.radius.pill,
  display: 'flex', alignItems: 'center', gap: '6px',
};

export const DetailModal = ({ venue, onClose, onNavigate, onShare, onEdit, onDelete }: DetailModalProps) => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const associations = useAssociations();
  const association = isFeatureOn('verband') ? venue.association_id : null;

  const wappen = wappenUrl(venue.canton);
  const phoneUrl = 'tel:' + venue.phone.replace(/\s/g, '');
  const websiteUrl = 'https://' + venue.website.replace(/^https?:\/\//, '');
  const hasPhotos = venue.photos.length > 0;
  const hasContact = !!(venue.person || venue.phone || venue.website);
  const regionalId = association ? associations.regionalOf(association)?.id : undefined;
  const close = (
    <button onClick={onClose} aria-label={t.close} style={closeButton(hasPhotos)}>
      <X size={16} />
    </button>
  );

  return (
    <Modal onClose={onClose}>
      {hasPhotos && (
        <div
          data-testid="venue-photos"
          style={{ position: 'relative', height: '194px', background: theme.color.paper, overflow: 'hidden' }}
        >
          <PhotoGallery photos={venue.photos} />
          <div style={{ position: 'absolute', top: '11px', right: '11px', zIndex: 1 }}>{close}</div>
        </div>
      )}
      <div style={{ padding: '18px 20px 20px' }} data-testid="venue-detail">
        <div data-testid="venue-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {wappen && (
            <img
              src={wappen}
              alt=""
              style={{
                width: '26px', height: '32px', objectFit: 'contain', flex: 'none', marginTop: '1px',
                filter: theme.armsOutline,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '21px', fontWeight: 700,
                color: theme.color.ink, lineHeight: 1.18, overflowWrap: 'anywhere',
              }}
            >
              {venue.name}
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '7px', marginTop: '5px',
                color: theme.color.muted, fontSize: '13px',
              }}
            >
              <span style={{ marginTop: '1px', display: 'flex' }}><MapPin size={13} /></span>
              <span>{venue.address}</span>
            </div>
            {association && regionalId && (
              <div
                data-testid="venue-association"
                style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '6px', color: theme.color.muted, fontSize: '13px' }}
              >
                <RegionalBadge id={regionalId} title={associations.nameOf(regionalId)} />
                <span>{associations.nameOf(association)}</span>
              </div>
            )}
          </div>
          {!hasPhotos && close}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          {venue.indoor && <span style={tag}><Home size={13} /> {t.indoor}</span>}
          {venue.outdoor && <span style={tag}><Mountain size={13} /> {t.outdoor}</span>}
        </div>
        {hasContact && (
          <>
            <div style={{ height: '1px', background: theme.color.line, margin: '18px 0 14px' }}></div>
            <div
              style={{
                fontFamily: theme.font.display, fontSize: '11px', letterSpacing: '.14em',
                textTransform: 'uppercase', color: theme.color.muted, fontWeight: 700, marginBottom: '4px',
              }}
            >
              {t.contact}
            </div>
            {venue.person && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 0' }}>
                <span style={contactIcon}><User size={16} /></span>
                <div>
                  <div style={contactLabel}>{t.person}</div>
                  <div style={{ fontSize: '14px', color: theme.color.ink, fontWeight: 600 }}>{venue.person}</div>
                </div>
              </div>
            )}
            {venue.phone && (
              <a href={phoneUrl} style={contactRow}>
                <span style={contactIcon}><Phone size={16} /></span>
                <div>
                  <div style={contactLabel}>{t.phone}</div>
                  <div style={{ fontSize: '14px', color: theme.color.accent, fontWeight: 600 }}>{venue.phone}</div>
                </div>
              </a>
            )}
            {venue.website && (
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={contactRow}>
                <span style={contactIcon}><Globe size={15} /></span>
                <div>
                  <div style={contactLabel}>{t.website}</div>
                  <div style={{ fontSize: '14px', color: theme.color.accent, fontWeight: 600 }}>{venue.website}</div>
                </div>
              </a>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            onClick={onNavigate}
            style={{
              flex: 2, border: 'none', cursor: 'pointer',
              background: theme.color.accent, color: theme.color.accentInk, fontWeight: 600, fontSize: '14px',
              padding: '13px', borderRadius: theme.radius.sm, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
            }}
          >
            {t.navigate} <ExternalLink size={15} />
          </button>
          <button
            onClick={onShare}
            style={{
              flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
              fontWeight: 600, fontSize: '14px', padding: '13px', borderRadius: theme.radius.sm, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {t.share} <Share2 size={15} />
          </button>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={onEdit}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.line, background: theme.color.bg, color: theme.color.ink,
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm,
                cursor: 'pointer',
              }}
            >
              {t.edit}
            </button>
            <button
              onClick={onDelete}
              style={{
                flex: 1, border: '1.5px solid ' + theme.color.accent, background: theme.color.bg, color: theme.color.accent,
                fontWeight: 600, fontSize: '13.5px', padding: '11px', borderRadius: theme.radius.sm,
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
