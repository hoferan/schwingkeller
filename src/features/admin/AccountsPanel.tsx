import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { inputStyle, labelStyle } from '../auth/formStyles';
import { useAuth } from '../auth/useAuth';
import type { AccountFilter } from './accounts';
import { AccountsTabs } from './AccountsTabs';
import { AccountsView } from './AccountsView';
import type { AdminErrorKey } from './adminError';
import { CreateInvitationDialog } from './CreateInvitationDialog';
import type { RevokeInvitationErrorKey } from './invitationError';
import { InvitationsView } from './InvitationsView';
import { actionStyle, visuallyHidden } from './listStyles';
import { TAB_PANEL_ID, tabId, type PanelTab } from './panelTabs';

const FILTERS = [
  ['pending', 'accountStatusPending'],
  ['approved', 'accountStatusApproved'],
  ['suspended', 'accountStatusSuspended'],
  ['rejected', 'accountStatusRejected'],
  ['all', 'accountStatusAll'],
] as const;

const TITLE_ID = 'accounts-panel-title';

// People management for approved editors. Editors with nodes below them get two tabs, accounts and
// invitations; the others only the invitations.
export const AccountsPanel = ({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) => {
  const { t } = useTranslation();
  const { canManageAccounts } = useAuth();
  const [chosen, setChosen] = useState<PanelTab>('accounts');
  const tab: PanelTab = canManageAccounts ? chosen : 'invitations';
  const [filter, setFilter] = useState<AccountFilter>('pending');
  const [error, setError] = useState<AdminErrorKey | RevokeInvitationErrorKey | null>(null);
  const [creating, setCreating] = useState<{ initial?: { email: string; scope: string } } | null>(null);

  const select = (next: PanelTab) => {
    if (next !== tab) setError(null);
    setChosen(next);
  };

  // Two rows: title, "+ Einladen" and close, then the tabs and the filter. They stay put while the
  // list scrolls under them, and so does a refusal, which may be for a row far down the list. The
  // second row wraps the filter onto its own line when it doesn't fit beside the tabs.
  const header = (
    <>
      <div style={{ borderBottom: '1px solid ' + theme.color.line }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: isMobile ? '6px 6px 6px 16px' : '12px 12px 12px 18px',
          }}
        >
          <div
            id={TITLE_ID}
            style={{
              fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700,
              color: theme.color.ink, flex: 1, minWidth: 0,
            }}
          >
            {canManageAccounts ? t.accountsTitle : t.invitationsTitle}
          </div>
          <button
            type="button"
            onClick={() => setCreating({})}
            style={{
              ...actionStyle('primary', false), display: 'flex', alignItems: 'center', gap: '6px', flex: 'none',
              minHeight: '36px',
            }}
          >
            <Plus size={15} />
            {t.invite}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
            style={{
              border: 'none', background: 'transparent', color: theme.color.muted, cursor: 'pointer', padding: 0,
              width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', flex: 'none', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>
        {canManageAccounts && (
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '16px', minHeight: '44px',
              padding: isMobile ? '0 12px 0 16px' : '0 18px',
            }}
          >
            <AccountsTabs tab={tab} onSelect={select} />
            {tab === 'accounts' && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                {/* Read by screen readers, not shown: on a phone the select's value says what it filters. */}
                <label htmlFor="accounts-filter" style={isMobile ? visuallyHidden : { ...labelStyle, marginBottom: 0 }}>
                  {t.accountsFilter}
                </label>
                <select
                  id="accounts-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as AccountFilter)}
                  style={{ ...inputStyle, width: 'auto', padding: '8px 11px' }}
                >
                  {FILTERS.map(([value, key]) => <option key={value} value={value}>{t[key]}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 18px', color: theme.color.accent, fontSize: '13px',
            borderBottom: '1px solid ' + theme.color.line,
          }}
        >
          {t[error]}
        </div>
      )}
    </>
  );

  const view =
    tab === 'accounts' ? (
      <AccountsView filter={filter} isMobile={isMobile} onError={setError} />
    ) : (
      <InvitationsView isMobile={isMobile} onError={setError} onReinvite={(initial) => setCreating({ initial })} />
    );

  return (
    <>
      <Modal
        onClose={onClose}
        width={960}
        zIndex={1400}
        header={header}
        fullScreen={isMobile}
        labelledBy={TITLE_ID}
      >
        {canManageAccounts ? (
          <div role="tabpanel" id={TAB_PANEL_ID} aria-labelledby={tabId(tab)}>
            {view}
          </div>
        ) : (
          view
        )}
      </Modal>
      {creating && <CreateInvitationDialog initial={creating.initial} onClose={() => setCreating(null)} />}
    </>
  );
};
