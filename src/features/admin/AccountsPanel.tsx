import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { inputStyle, labelStyle } from '../auth/formStyles';
import { useAuth } from '../auth/useAuth';
import { AccountList } from './AccountList';
import type { Account, AccountFilter } from './accounts';
import { adminErrorKey, type AdminErrorKey } from './adminError';
import { ApproveDialog } from './ApproveDialog';
import { useAccounts, useRejectEditor } from './useAccounts';

const FILTERS = [
  ['pending', 'accountStatusPending'],
  ['approved', 'accountStatusApproved'],
  ['suspended', 'accountStatusSuspended'],
  ['rejected', 'accountStatusRejected'],
  ['all', 'accountStatusAll'],
] as const;

// The accounts the caller manages. RLS decides which rows come back: everyone for a super-admin,
// the accounts below their node for a Teilverband editor, and their own row in both cases.
export const AccountsPanel = ({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [filter, setFilter] = useState<AccountFilter>('pending');
  const [approving, setApproving] = useState<Account | null>(null);
  const [error, setError] = useState<AdminErrorKey | null>(null);
  const accounts = useAccounts(filter);
  const reject = useRejectEditor();

  const onReject = (account: Account) => {
    setError(null);
    reject.mutate(account.id, { onError: (err) => setError(adminErrorKey(err)) });
  };

  const header = (
    <div
      style={{
        display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '16px 18px',
        borderBottom: '1px solid ' + theme.color.line, flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700,
          color: theme.color.ink, flex: 1, alignSelf: 'center',
        }}
      >
        {t.accountsTitle}
      </div>
      <div>
        <label htmlFor="accounts-filter" style={labelStyle}>{t.accountsFilter}</label>
        <select
          id="accounts-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as AccountFilter)}
          style={{ ...inputStyle, width: 'auto', padding: '8px 11px' }}
        >
          {FILTERS.map(([value, key]) => <option key={value} value={value}>{t[key]}</option>)}
        </select>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        title={t.close}
        style={{
          border: 'none', background: 'transparent', color: theme.color.muted, cursor: 'pointer', padding: '6px',
          alignSelf: 'center', display: 'flex',
        }}
      >
        <X size={20} />
      </button>
    </div>
  );

  return (
    <>
      <Modal onClose={onClose} width={960} zIndex={1400} header={header}>
        {error && (
          <div role="alert" style={{ padding: '12px 18px', color: theme.color.accent, fontSize: '13px' }}>
            {t[error]}
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
            rejectingId={reject.isPending ? (reject.variables ?? null) : null}
            onApprove={(account) => {
              setError(null);
              setApproving(account);
            }}
            onReject={onReject}
          />
        )}
      </Modal>
      {approving && <ApproveDialog account={approving} onClose={() => setApproving(null)} onError={setError} />}
    </>
  );
};
