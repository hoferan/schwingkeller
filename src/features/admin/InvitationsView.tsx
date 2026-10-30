import { useEffect, useMemo, useState } from 'react';
import { useMutationState } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { captureAndFormat } from '../../lib/sentry';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import { useAuth } from '../auth/useAuth';
import { isExpired, type Invitation } from './invitations';
import { revokeInvitationErrorKey, type RevokeInvitationErrorKey } from './invitationError';
import { actionStyle, cell, head } from './listStyles';
import { RevokeInvitationDialog } from './RevokeInvitationDialog';
import { scopeLabel } from './scopeLabel';
import { revokeRowKey, useInvitations, useRevokeInvitation } from './useInvitations';

interface InvitationsViewProps {
  isMobile: boolean;
  onError: (key: RevokeInvitationErrorKey | null) => void;
  onReinvite: (initial: { email: string; scope: string }) => void;
}

// The open invitations the caller may manage. RLS decides which rows come back.
export const InvitationsView = ({ isMobile, onError, onReinvite }: InvitationsViewProps) => {
  const { t, lang } = useTranslation();
  const a = useAssociations();
  const { session } = useAuth();
  const ownId = session?.user.id ?? null;
  const invitations = useInvitations();
  const [confirming, setConfirming] = useState<Invitation | null>(null);
  const revoke = useRevokeInvitation({ onError: (err) => onError(revokeInvitationErrorKey(err)) });
  // Every row with a revoke running, the dialog's included. Their buttons wait meanwhile.
  const pending = useMutationState({
    filters: { mutationKey: revokeRowKey, status: 'pending' },
    select: (m) => m.state.variables as string,
  });
  const busyIds = useMemo(() => new Set(pending), [pending]);
  const date = new Intl.DateTimeFormat(`${lang}-CH`, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const now = new Date();

  useEffect(() => {
    if (invitations.error) captureAndFormat(invitations.error, 'invitation list fetch failed');
  }, [invitations.error]);

  // No session means no own rows: a null inviter must not match a null id.
  const isMine = (inv: Invitation) => ownId !== null && inv.invited_by === ownId;

  const onRevoke = (inv: Invitation) => {
    if (isMine(inv)) {
      onError(null);
      revoke.mutate(inv.id);
    } else {
      setConfirming(inv);
    }
  };

  // "Abgelaufen" in red, else the date, which the phone card wraps in a sentence.
  const expires = (inv: Invitation, withDate: (formatted: string) => string = (d) => d) =>
    isExpired(inv, now) ? (
      <span style={{ color: theme.color.accent }}>{t.invitationExpired}</span>
    ) : (
      withDate(date.format(new Date(inv.expires_at)))
    );

  const email = (inv: Invitation) => (
    <>
      {inv.email}
      {isMine(inv) && (
        <span style={{ color: theme.color.muted, fontWeight: 400, marginLeft: '8px', fontSize: '12px' }}>
          {t.invitationMine}
        </span>
      )}
    </>
  );

  const actions = (inv: Invitation) => {
    const busy = busyIds.has(inv.id);
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isExpired(inv, now) && (
          <button
            type="button"
            onClick={() => onReinvite({ email: inv.email, scope: inv.association_id })}
            disabled={busy}
            style={actionStyle('primary', busy)}
          >
            {t.invitationReinvite}
          </button>
        )}
        <button type="button" onClick={() => onRevoke(inv)} disabled={busy} style={actionStyle('danger', busy)}>
          {t.invitationRevoke}
        </button>
      </div>
    );
  };

  const list = invitations.data;
  let body = null;
  if (list && list.length > 0 && isMobile) {
    body = (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((inv) => (
          <li
            key={inv.id}
            data-testid={`invitation-${inv.email}`}
            style={{ padding: '14px 16px', borderBottom: '1px solid ' + theme.color.line, fontSize: '13.5px' }}
          >
            <div style={{ fontWeight: 700, color: theme.color.ink, overflowWrap: 'anywhere' }}>{email(inv)}</div>
            <div style={{ color: theme.color.muted, marginTop: '4px', lineHeight: 1.5 }}>
              {scopeLabel(a, t, inv.association_id)} ·{' '}
              {expires(inv, (d) => t.invitationExpiresOn.replace('{date}', () => d))}
            </div>
            <div style={{ marginTop: '10px' }}>{actions(inv)}</div>
          </li>
        ))}
      </ul>
    );
  } else if (list && list.length > 0) {
    body = (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', color: theme.color.ink }}>
        <thead>
          <tr>
            <th style={head}>{t.email}</th>
            <th style={head}>{t.accountsScope}</th>
            <th style={head}>{t.invitationExpires}</th>
            <th style={head}>{t.accountsActions}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((inv) => (
            <tr key={inv.id} data-testid={`invitation-${inv.email}`}>
              <td style={{ ...cell, overflowWrap: 'anywhere' }}>{email(inv)}</td>
              <td style={cell}>{scopeLabel(a, t, inv.association_id)}</td>
              <td style={cell}>{expires(inv)}</td>
              <td style={cell}>{actions(inv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      {invitations.isError && (
        <div role="alert" style={{ padding: '12px 18px', color: theme.color.accent, fontSize: '13px' }}>
          {t.invitationsLoadFailed}
        </div>
      )}
      {list && list.length === 0 && (
        <div style={{ padding: '22px 18px', color: theme.color.muted, fontSize: '13.5px' }}>{t.invitationsEmpty}</div>
      )}
      {body}
      {confirming && <RevokeInvitationDialog invitation={confirming} onClose={() => setConfirming(null)} onError={onError} />}
    </>
  );
};
