import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import { inputStyle, labelStyle, primaryButtonStyle, secondaryButtonStyle } from '../auth/formStyles';
import { useAuth } from '../auth/useAuth';
import type { Account } from './accounts';
import { adminErrorKey, type AdminErrorKey } from './adminError';
import { defaultScopeFor, grantableBoard, grantableScopes, optionIds, type ScopeOption } from './scopeOptions';
import { useApprovedScopes, useApproveEditor, useSetEditorScope } from './useAccounts';

interface ScopeDialogProps {
  account: Account;
  // Approve a pending or rejected account, or change the scope of an approved one.
  mode: 'approve' | 'change';
  onClose: () => void;
  onError: (key: AdminErrorKey) => void;
}

// Picks a scope the caller may grant, to approve an account or to move an editor. A native select
// for now; #128 replaces it with a tree picker.
export const ScopeDialog = ({ account, mode, onClose, onError }: ScopeDialogProps) => {
  const { t } = useTranslation();
  const a = useAssociations();
  const { scope: callerScope } = useAuth();
  const approved = useApprovedScopes();
  const approve = useApproveEditor();
  const change = useSetEditorScope();
  const mutation = mode === 'approve' ? approve : change;
  const options = grantableScopes(a, callerScope ?? '', approved.data ?? []);
  const current = account.scope_association_id;
  const [scope, setScope] = useState<string>(() =>
    mode === 'approve'
      ? (defaultScopeFor(account, grantableBoard(a, callerScope ?? '')) ?? '')
      : current !== null && optionIds(options).includes(current) ? current : '',
  );
  // Moving an editor to the scope it already has would change nothing.
  const blocked = scope === '' || (mode === 'change' && scope === current) || mutation.isPending;

  // Counts only once they've loaded, so a picker never claims a Verband has no editors yet.
  const optionText = (o: ScopeOption) => {
    if (!approved.data) return o.name;
    const below = o.below === null ? '' : ` · ${t.scopeBelow.replace('{n}', String(o.below))}`;
    return `${o.name} · ${o.direct}${below}`;
  };

  const confirm = () => {
    const handlers = {
      onSuccess: onClose,
      onError: (err: unknown) => {
        onError(adminErrorKey(err));
        onClose();
      },
    };
    if (mode === 'approve') approve.mutate({ targetId: account.id, scope }, handlers);
    else change.mutate({ targetId: account.id, scope }, handlers);
  };

  return (
    <Modal onClose={onClose} width={400} zIndex={1500}>
      <div data-testid="scope-dialog" style={{ padding: '22px' }}>
        <div
          style={{
            fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '18px', fontWeight: 700,
            color: theme.color.ink,
          }}
        >
          {mode === 'approve' ? t.approveTitle : t.changeScope}
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
            disabled={blocked}
            style={{ ...primaryButtonStyle, opacity: blocked ? 0.5 : 1 }}
          >
            {/* Short enough for one line on a phone; the title says what is saved. */}
            {mode === 'approve' ? t.approve : t.save}
          </button>
        </div>
      </div>
    </Modal>
  );
};
