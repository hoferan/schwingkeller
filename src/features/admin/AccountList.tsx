import type { CSSProperties } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import type { Account } from './accounts';
import { scopeLabel } from './scopeLabel';

export type AccountAction = 'approve' | 'reject' | 'changeScope' | 'suspend' | 'reactivate' | 'delete';

interface AccountListProps {
  accounts: Account[];
  isMobile: boolean;
  // The caller's own account: shown, but without actions.
  ownId: string | null;
  // The account with an action running. Its buttons wait, so nothing is sent twice.
  busyId: string | null;
  // Only a super-admin may delete someone else's account.
  canDelete: boolean;
  onAction: (action: AccountAction, account: Account) => void;
}

// What each status offers. Reject and suspend run without confirmation, because both can be undone
// here: approve_editor accepts rejected accounts, and reactivate_editor suspended ones.
const ACTIONS: Record<Account['status'], AccountAction[]> = {
  pending: ['approve', 'reject'],
  rejected: ['approve'],
  approved: ['changeScope', 'suspend'],
  suspended: ['reactivate'],
};

const STATUS_KEY = {
  pending: 'accountStatusPending',
  approved: 'accountStatusApproved',
  suspended: 'accountStatusSuspended',
  rejected: 'accountStatusRejected',
} as const;

const cell: CSSProperties = { padding: '10px 12px', borderBottom: '1px solid ' + theme.color.line, verticalAlign: 'top' };
const head: CSSProperties = {
  ...cell, textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
  color: theme.color.muted,
};
// Delete gets the red outline of the venue delete button.
const actionStyle = (kind: 'primary' | 'plain' | 'danger', busy: boolean): CSSProperties => ({
  border: kind === 'primary' ? 'none' : '1.5px solid ' + (kind === 'danger' ? theme.color.accent : theme.color.line),
  background: kind === 'primary' ? theme.color.accent : 'transparent',
  color: kind === 'primary' ? theme.color.accentInk : kind === 'danger' ? theme.color.accent : theme.color.ink,
  fontWeight: 600, fontSize: '13px', padding: '7px 12px', borderRadius: theme.radius.sm,
  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap',
});

export const AccountList = ({ accounts, isMobile, ownId, busyId, canDelete, onAction }: AccountListProps) => {
  const { t, lang } = useTranslation();
  const a = useAssociations();
  const date = new Intl.DateTimeFormat(`${lang}-CH`, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const fields = (account: Account) => {
    const scope = account.scope_association_id === null ? '' : scopeLabel(a, t, account.scope_association_id);
    return {
      requested: account.requested_association_id === null ? '–' : scopeLabel(a, t, account.requested_association_id),
      // A pending account with a scope came back through request_review_again.
      scope: account.status === 'pending' && scope !== '' ? t.accountsPrevious.replace('{scope}', scope) : scope,
      status: t[STATUS_KEY[account.status]],
      since: date.format(new Date(account.created_at)),
    };
  };

  const LABEL: Record<AccountAction, string> = {
    approve: t.approve,
    reject: t.reject,
    changeScope: t.changeScope,
    suspend: t.suspend,
    reactivate: t.reactivate,
    delete: t.delete,
  };

  const actions = (account: Account) => {
    if (account.id === ownId) return <span style={{ color: theme.color.muted, fontSize: '13px' }}>{t.accountsYou}</span>;
    const busy = busyId === account.id;
    const offered = canDelete ? [...ACTIONS[account.status], 'delete' as const] : ACTIONS[account.status];
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {offered.map((action, i) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action, account)}
            disabled={busy}
            style={actionStyle(action === 'delete' ? 'danger' : i === 0 ? 'primary' : 'plain', busy)}
          >
            {LABEL[action]}
          </button>
        ))}
      </div>
    );
  };

  if (isMobile) {
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {accounts.map((account) => {
          const f = fields(account);
          return (
            <li
              key={account.id}
              data-testid={`account-${account.email}`}
              style={{ padding: '14px 16px', borderBottom: '1px solid ' + theme.color.line, fontSize: '13.5px' }}
            >
              <div style={{ fontWeight: 700, color: theme.color.ink, overflowWrap: 'anywhere' }}>{account.email}</div>
              <div style={{ color: theme.color.muted, marginTop: '4px', lineHeight: 1.5 }}>
                {f.status} · {f.since}
                <br />
                {t.accountsRequestedShort}: {f.requested}
                {f.scope !== '' && (
                  <>
                    <br />
                    {t.accountsScope}: {f.scope}
                  </>
                )}
              </div>
              <div style={{ marginTop: '10px' }}>{actions(account)}</div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', color: theme.color.ink }}>
      <thead>
        <tr>
          <th style={head}>{t.email}</th>
          <th style={head}>{t.accountsRequested}</th>
          <th style={head}>{t.accountsScope}</th>
          <th style={head}>{t.accountsFilter}</th>
          <th style={head}>{t.accountsSince}</th>
          <th style={head}>{t.accountsActions}</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => {
          const f = fields(account);
          return (
            <tr key={account.id} data-testid={`account-${account.email}`}>
              <td style={{ ...cell, overflowWrap: 'anywhere' }}>{account.email}</td>
              <td style={cell}>{f.requested}</td>
              <td style={cell}>{f.scope}</td>
              <td style={cell}>{f.status}</td>
              <td style={cell}>{f.since}</td>
              <td style={cell}>{actions(account)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
