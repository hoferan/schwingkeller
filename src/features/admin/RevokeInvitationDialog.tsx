import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import { primaryButtonStyle, secondaryButtonStyle } from '../auth/formStyles';
import type { Invitation } from './invitations';
import { revokeInvitationErrorKey, type RevokeInvitationErrorKey } from './invitationError';
import { scopeLabel } from './scopeLabel';
import { useRevokeInvitation } from './useInvitations';

interface RevokeInvitationDialogProps {
  invitation: Invitation;
  onClose: () => void;
  onError: (key: RevokeInvitationErrorKey | null) => void;
}

// Asks before revoking an invitation someone else created. Built like DeleteAccountDialog.
export const RevokeInvitationDialog = ({ invitation, onClose, onError }: RevokeInvitationDialogProps) => {
  const { t } = useTranslation();
  const a = useAssociations();
  const revoke = useRevokeInvitation({ onError: (err) => onError(revokeInvitationErrorKey(err)) });

  const confirm = () => {
    onError(null);
    revoke.mutate(invitation.id, { onSettled: onClose });
  };
  // Stays open until the call returns, so the editor sees how it ended.
  const dismiss = () => {
    if (!revoke.isPending) onClose();
  };

  return (
    <Modal onClose={dismiss} width={340} zIndex={1500}>
      <div data-testid="revoke-invitation-dialog" style={{ padding: '22px' }}>
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700,
            color: theme.color.ink,
          }}
        >
          {t.revokeInvitationTitle}
        </div>
        <div style={{ fontSize: '13.5px', color: theme.color.ink, marginTop: '8px', fontWeight: 600, overflowWrap: 'anywhere' }}>
          {invitation.email} · {scopeLabel(a, t, invitation.association_id)}
        </div>
        <div style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '8px', lineHeight: 1.5 }}>
          {t.revokeInvitationBody}
        </div>
        <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={dismiss}
            disabled={revoke.isPending}
            style={{ ...secondaryButtonStyle, opacity: revoke.isPending ? 0.5 : 1 }}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={revoke.isPending}
            style={{ ...primaryButtonStyle, opacity: revoke.isPending ? 0.5 : 1 }}
          >
            {t.invitationRevoke}
          </button>
        </div>
      </div>
    </Modal>
  );
};
