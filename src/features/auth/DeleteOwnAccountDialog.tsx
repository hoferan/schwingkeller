import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { deleteOwnErrorKey, type DeleteOwnErrorKey } from './deleteOwnAccount';
import { inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle } from './formStyles';
import { useDeleteOwnAccount } from './useProfile';

interface DeleteOwnAccountDialogProps {
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}

// Asks for the password before the signed-in account deletes itself (#31). Built like the admin's
// DeleteAccountDialog, with the password as the confirmation.
export const DeleteOwnAccountDialog = ({ email, onClose, onDeleted }: DeleteOwnAccountDialogProps) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<DeleteOwnErrorKey | null>(null);
  const remove = useDeleteOwnAccount();
  const busy = remove.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || password === '') return;
    setErrorKey(null);
    remove.mutate(
      { email, password },
      { onSuccess: onDeleted, onError: (err) => setErrorKey(deleteOwnErrorKey(err)) },
    );
  };
  // Stays open until the deletion returns, so the person sees how it ended.
  const dismiss = () => {
    if (!busy) onClose();
  };

  return (
    <Modal onClose={dismiss} width={340} zIndex={1500}>
      <form data-testid="delete-own-account-dialog" onSubmit={submit} style={{ padding: '22px' }}>
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
          {t.deleteOwnBody.replace('{email}', email)}
        </div>
        <label htmlFor="delete-own-password" style={{ ...labelStyle, marginTop: '16px' }}>
          {t.deleteOwnPassword}
        </label>
        <input
          id="delete-own-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {errorKey && (
          <div role="alert" style={{ fontSize: '13px', color: theme.color.accent, marginTop: '10px', lineHeight: 1.4 }}>
            {t[errorKey]}
          </div>
        )}
        <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            style={{ ...secondaryButtonStyle, opacity: busy ? 0.5 : 1 }}
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={busy || password === ''}
            style={{ ...primaryButtonStyle, opacity: busy || password === '' ? 0.5 : 1 }}
          >
            {t.delete}
          </button>
        </div>
      </form>
    </Modal>
  );
};
