import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { primaryButtonStyle, secondaryButtonStyle } from '../auth/formStyles';
import type { Account } from './accounts';
import { adminErrorKey, type AdminErrorKey } from './adminError';
import { useDeleteAccount } from './useAccounts';

interface DeleteAccountDialogProps {
  account: Account;
  onClose: () => void;
  onError: (key: AdminErrorKey) => void;
}

// Asks before deleting an account, since nothing brings it back. Built like the venue delete
// confirmation in App.tsx.
export const DeleteAccountDialog = ({ account, onClose, onError }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const remove = useDeleteAccount({ onError: (err) => onError(adminErrorKey(err)) });

  const confirm = () => remove.mutate(account.id, { onSettled: onClose });

  return (
    <Modal onClose={onClose} width={340} zIndex={1500}>
      <div data-testid="delete-account-dialog" style={{ padding: '22px' }}>
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700,
            color: theme.color.ink,
          }}
        >
          {t.deleteAccountTitle}
        </div>
        <div
          style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '8px', lineHeight: 1.5, overflowWrap: 'anywhere' }}
        >
          {t.deleteAccountBody.replace('{email}', account.email)}
        </div>
        <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>{t.cancel}</button>
          <button
            type="button"
            onClick={confirm}
            disabled={remove.isPending}
            style={{ ...primaryButtonStyle, opacity: remove.isPending ? 0.5 : 1 }}
          >
            {t.delete}
          </button>
        </div>
      </div>
    </Modal>
  );
};
