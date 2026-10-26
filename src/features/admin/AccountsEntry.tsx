import { Users } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { isFeatureOn } from '../../lib/features';
import { theme } from '../../theme';
import { useAuth } from '../auth/useAuth';
import { badgeStyle, pendingCountText } from './listStyles';
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
  const { t } = useTranslation();
  const { isApproved, canManageAccounts } = useAuth();
  if (!isApproved || !isFeatureOn('editors')) return null;
  const title = canManageAccounts ? t.accountsTitle : t.invitationsTitle;
  return canManageAccounts ? (
    <PendingEntryButton {...props} title={title} />
  ) : (
    <EntryButton {...props} title={title} pending={0} />
  );
};

type EntryProps = AccountsEntryProps & { title: string };

const PendingEntryButton = (props: EntryProps) => {
  const { data: pending = 0 } = usePendingCount();
  return <EntryButton {...props} pending={pending} />;
};

const EntryButton = ({ onOpen, isMobile, inverted, title, pending }: EntryProps & { pending: number }) => {
  const { t } = useTranslation();
  const ink = inverted ? theme.color.accentInk : theme.color.accent;
  const pendingText = pendingCountText(t.accountsPendingCount, pending);

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
            ...badgeStyle, position: 'absolute', top: '-6px', right: '-6px',
            background: inverted ? theme.color.accentInk : theme.color.accent,
            color: inverted ? theme.color.accent : theme.color.accentInk,
          }}
        >
          <span aria-hidden="true">{pending}</span>
          <span id="accounts-pending" hidden>{pendingText}</span>
        </span>
      )}
    </button>
  );
};
