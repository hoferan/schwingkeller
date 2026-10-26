import { Users } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { isFeatureOn } from '../../lib/features';
import { theme } from '../../theme';
import { useAuth } from '../auth/useAuth';
import { usePendingCount } from './useAccounts';

interface AccountsEntryProps {
  onOpen: () => void;
  isMobile: boolean;
  // The top bar turns red for approved editors, so the button inverts with it.
  inverted: boolean;
}

// The top-bar button to the people panel. Every approved editor gets it, for the invitations. Only
// accounts that manage others see the number of requests waiting, and only they ask the database
// for it.
export const AccountsEntry = (props: AccountsEntryProps) => {
  const { isApproved, canManageAccounts } = useAuth();
  if (!isApproved || !isFeatureOn('editors')) return null;
  return canManageAccounts ? <PendingEntryButton {...props} /> : <EntryButton {...props} pending={0} />;
};

const PendingEntryButton = (props: AccountsEntryProps) => {
  const { data: pending = 0 } = usePendingCount();
  return <EntryButton {...props} pending={pending} />;
};

const EntryButton = ({ onOpen, isMobile, inverted, pending }: AccountsEntryProps & { pending: number }) => {
  const { t } = useTranslation();
  const { canManageAccounts } = useAuth();
  const title = canManageAccounts ? t.accountsTitle : t.invitationsTitle;
  const ink = inverted ? theme.color.accentInk : theme.color.accent;
  const pendingText = t.accountsPendingCount.replace('{n}', String(pending));

  return (
    <button
      onClick={onOpen}
      type="button"
      title={title}
      aria-label={title}
      aria-describedby={pending > 0 ? 'accounts-pending' : undefined}
      style={{
        position: 'relative', fontSize: '12.5px', fontWeight: 600, color: ink, background: 'transparent',
        border: '1.5px solid ' + ink, borderRadius: theme.radius.pill, cursor: 'pointer', flex: 'none',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '6px', padding: isMobile ? '0' : '7px 13px', width: isMobile ? '38px' : 'auto',
        height: isMobile ? '38px' : 'auto',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}><Users size={13} /></span>
      {!isMobile && title}
      {pending > 0 && (
        <span
          style={{
            position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 5px',
            borderRadius: theme.radius.pill, background: inverted ? theme.color.accentInk : theme.color.accent,
            color: inverted ? theme.color.accent : theme.color.accentInk, fontSize: '11px', fontWeight: 700,
            lineHeight: '18px', textAlign: 'center', boxSizing: 'border-box',
          }}
        >
          <span aria-hidden="true">{pending}</span>
          <span id="accounts-pending" hidden>{pendingText}</span>
        </span>
      )}
    </button>
  );
};
