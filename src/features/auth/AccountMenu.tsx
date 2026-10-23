import { useState } from 'react';
import { Unlock, User } from 'lucide-react';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { scopeLabel } from '../admin/scopeLabel';
import { useAssociations } from '../associations/useAssociations';
import { DeleteOwnAccountDialog } from './DeleteOwnAccountDialog';
import { useAuth } from './useAuth';

interface AccountMenuProps {
  isMobile: boolean;
  // The top bar turns red for approved editors, so the button inverts with it.
  inverted: boolean;
  onAccountDeleted: () => void;
}

// The signed-in account's menu in the top bar: who is signed in, sign-out, and deleting the account
// (#31). Further account actions go into `sections` as items.
export const AccountMenu = ({ isMobile, inverted, onAccountDeleted }: AccountMenuProps) => {
  const { session, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const associations = useAssociations();
  const [deleting, setDeleting] = useState(false);
  const email = session?.user.email ?? '';
  const verband = profile ? (profile.scope_association_id ?? profile.requested_association_id) : null;
  const ink = inverted ? theme.color.accentInk : theme.color.accent;

  const sections: MenuItem[][] = [
    [{ id: 'sign-out', label: t.logout, icon: <Unlock size={13} />, onSelect: () => void signOut() }],
    [{ id: 'delete-account', label: t.deleteOwnAccount, tone: 'danger', onSelect: () => setDeleting(true) }],
  ];

  return (
    <>
      <DropdownMenu
        label={t.accountMenu}
        button={
          <>
            <span style={{ display: 'flex', alignItems: 'center' }}><User size={13} /></span>
            {!isMobile && t.accountMenu}
          </>
        }
        buttonStyle={{
          fontSize: '12.5px', fontWeight: 600, color: ink, background: 'transparent',
          border: '1.5px solid ' + ink, borderRadius: theme.radius.pill, cursor: 'pointer',
          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '6px', padding: isMobile ? '0' : '7px 13px', width: isMobile ? '38px' : 'auto',
          height: isMobile ? '38px' : 'auto',
        }}
        header={
          <div style={{ fontSize: '12.5px', color: theme.color.muted, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: theme.color.ink }}>{email}</div>
            {verband && <div>{scopeLabel(associations, t, verband)}</div>}
          </div>
        }
        sections={sections}
      />
      {deleting && (
        <DeleteOwnAccountDialog
          email={email}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            onAccountDeleted();
          }}
        />
      )}
    </>
  );
};
