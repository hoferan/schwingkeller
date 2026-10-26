import { useEffect, useMemo, useState } from 'react';
import { useMutationState } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { captureAndFormat } from '../../lib/sentry';
import { theme } from '../../theme';
import { useAuth } from '../auth/useAuth';
import { AccountList, type AccountAction } from './AccountList';
import type { Account, AccountFilter } from './accounts';
import { adminErrorKey, type AdminErrorKey } from './adminError';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ScopeDialog } from './ScopeDialog';
import { rowActionKey, useAccounts, useReactivateEditor, useRejectEditor, useSuspendEditor } from './useAccounts';

interface AccountsViewProps {
  filter: AccountFilter;
  isMobile: boolean;
  onError: (key: AdminErrorKey | null) => void;
}

// The accounts the caller manages. RLS decides which rows come back: everyone for a super-admin,
// the accounts below their node for a Teilverband editor, and their own row in both cases.
export const AccountsView = ({ filter, isMobile, onError: setError }: AccountsViewProps) => {
  const { t } = useTranslation();
  const { session, isSuperAdmin } = useAuth();
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'change' | 'delete'; account: Account } | null>(null);
  const accounts = useAccounts(filter);
  const onError = (err: unknown) => setError(adminErrorKey(err));
  const reject = useRejectEditor({ onError });
  const suspend = useSuspendEditor({ onError });
  const reactivate = useReactivateEditor({ onError });
  // Every row with an action running, the delete dialog's included. Their buttons wait meanwhile.
  const pending = useMutationState({
    filters: { mutationKey: rowActionKey, status: 'pending' },
    select: (m) => m.state.variables as string,
  });
  const busyIds = useMemo(() => new Set(pending), [pending]);

  useEffect(() => {
    if (accounts.error) captureAndFormat(accounts.error, 'account list fetch failed');
  }, [accounts.error]);

  const onAction = (action: AccountAction, account: Account) => {
    setError(null);
    switch (action) {
      case 'approve':
        return setDialog({ kind: 'approve', account });
      case 'changeScope':
        return setDialog({ kind: 'change', account });
      case 'delete':
        return setDialog({ kind: 'delete', account });
      case 'reject':
        return reject.mutate(account.id);
      case 'suspend':
        return suspend.mutate(account.id);
      case 'reactivate':
        return reactivate.mutate(account.id);
    }
  };

  return (
    <>
      {accounts.isError && (
        <div role="alert" style={{ padding: '12px 18px', color: theme.color.accent, fontSize: '13px' }}>
          {t.accountsLoadFailed}
        </div>
      )}
      {accounts.data && accounts.data.length === 0 && (
        <div style={{ padding: '22px 18px', color: theme.color.muted, fontSize: '13.5px' }}>{t.accountsEmpty}</div>
      )}
      {accounts.data && accounts.data.length > 0 && (
        <AccountList
          accounts={accounts.data}
          isMobile={isMobile}
          ownId={session?.user.id ?? null}
          busyIds={busyIds}
          canDelete={isSuperAdmin}
          onAction={onAction}
        />
      )}
      {dialog && dialog.kind !== 'delete' && (
        <ScopeDialog account={dialog.account} mode={dialog.kind} onClose={() => setDialog(null)} onError={setError} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteAccountDialog account={dialog.account} onClose={() => setDialog(null)} onError={setError} />
      )}
    </>
  );
};
