import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { useAuth } from './useAuth';
import { useRequestReview } from './useProfile';

// Tells a signed-in account that isn't approved why it can't edit. It needs a loaded profile:
// without one, an approved editor would see a banner flash on every page reload.
export const StatusBanner = () => {
  const { profile, isApproved } = useAuth();
  const { t } = useTranslation();
  const review = useRequestReview();

  if (!profile || isApproved) return null;

  const message =
    profile.status === 'pending'
      ? t.statusPending
      : profile.status === 'suspended'
        ? t.statusSuspended
        : t.statusRejected;
  const canRequestReview = profile.status === 'suspended' || profile.status === 'rejected';

  return (
    <div
      role="status"
      style={{
        flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px',
        padding: '8px 12px', background: theme.color.paper, color: theme.color.ink,
        borderBottom: '1px solid ' + theme.color.line, fontSize: '13px',
      }}
    >
      <span>{message}</span>
      {canRequestReview && (
        <button
          type="button"
          onClick={() => review.mutate()}
          disabled={review.isPending}
          style={{
            fontSize: '12.5px', fontWeight: 600, color: theme.color.accentInk, background: theme.color.accent,
            border: 'none', borderRadius: theme.radius.pill, cursor: 'pointer', padding: '5px 12px',
          }}
        >
          {t.requestReview}
        </button>
      )}
      {review.isError && <span style={{ color: theme.color.accent }}>{t.requestReviewFailed}</span>}
    </div>
  );
};
