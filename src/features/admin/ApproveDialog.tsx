import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import { inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle } from '../auth/formStyles';
import { useAuth } from '../auth/useAuth';
import type { Account } from './accounts';
import { adminErrorKey, type AdminErrorKey } from './adminError';
import { scopeLabel } from './scopeLabel';
import { defaultScopeFor, grantableScopes, type ScopeOption } from './scopeOptions';
import { useApprovedScopes, useApproveEditor } from './useAccounts';

interface ApproveDialogProps {
  account: Account;
  onClose: () => void;
  onError: (key: AdminErrorKey) => void;
}

// Approves a pending account with a scope the caller may grant. A native select for now; #128
// replaces it with a tree picker.
export const ApproveDialog = ({ account, onClose, onError }: ApproveDialogProps) => {
  const { t } = useTranslation();
  const a = useAssociations();
  const { scope: callerScope } = useAuth();
  const approved = useApprovedScopes();
  const approve = useApproveEditor();
  const options = grantableScopes(a, callerScope ?? '', approved.data ?? []);
  const [scope, setScope] = useState<string>(() => defaultScopeFor(account, options) ?? '');

  // Counts only once they've loaded, so a picker never claims a Verband has no editors yet.
  const optionText = (o: ScopeOption) => {
    if (!approved.data) return o.name;
    const below = o.below === null ? '' : ` · ${t.scopeBelow.replace('{n}', String(o.below))}`;
    return `${o.name} · ${o.direct}${below}`;
  };

  const confirm = () => {
    approve.mutate(
      { targetId: account.id, scope },
      {
        onSuccess: onClose,
        onError: (err) => {
          onError(adminErrorKey(err));
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} width={400} zIndex={1500}>
      <div style={{ padding: '22px' }}>
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700,
            color: theme.color.ink,
          }}
        >
          {t.approveTitle}
        </div>
        <div style={{ fontSize: '13.5px', color: theme.color.muted, marginTop: '6px', overflowWrap: 'anywhere' }}>
          {account.email}
        </div>
        <label htmlFor="approve-scope" style={{ ...labelStyle, margin: '16px 0 6px' }}>{t.accountsScope}</label>
        <select id="approve-scope" value={scope} onChange={(e) => setScope(e.target.value)} style={inputStyle}>
          <option value="">{t.associationPlaceholder}</option>
          {options.top && <option value={options.top.id}>{optionText(options.top)}</option>}
          {options.groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => <option key={o.id} value={o.id}>{optionText(o)}</option>)}
            </optgroup>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>{t.cancel}</button>
          <button
            type="button"
            onClick={confirm}
            disabled={scope === '' || approve.isPending}
            style={{ ...primaryButtonStyle, opacity: scope === '' || approve.isPending ? 0.5 : 1 }}
          >
            {scope === '' ? t.approve : t.approveAs.replace('{scope}', scopeLabel(a, t, scope))}
          </button>
        </div>
      </div>
    </Modal>
  );
};
