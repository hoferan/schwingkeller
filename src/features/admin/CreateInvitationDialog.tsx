import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import {
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../auth/formStyles';
import { useAuth } from '../auth/useAuth';
import { createInvitationErrorKey, type CreateInvitationErrorKey } from './invitationError';
import { INVITATION_DAYS, invitationLink, isExpired } from './invitations';
import { inviteMessage, mailtoHref } from './inviteMessage';
import { scopeLabel } from './scopeLabel';
import { ScopeChips } from './ScopeChips';
import { boardIds, invitableBoard, scopeCounts } from './scopeOptions';
import { useApprovedScopes } from './useAccounts';
import { useCreateInvitation, useInvitations } from './useInvitations';

interface CreateInvitationDialogProps {
  onClose: () => void;
  // Fills the form again, for a new invitation to an address whose last one ran out.
  initial?: { email: string; scope: string };
}

// What step 2 shows. The token lives here and nowhere else once the mutation is dropped.
interface Created {
  token: string;
  email: string;
  scope: string;
  until: Date;
}

const titleStyle = {
  fontFamily: theme.font.display,
  textTransform: 'uppercase',
  fontSize: '18px',
  fontWeight: 700,
  color: theme.color.ink,
} as const;

const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

const mailButtonStyle = {
  ...secondaryButtonStyle,
  textAlign: 'center',
  textDecoration: 'none',
  boxSizing: 'border-box',
} as const;

const mutedText = { color: theme.color.muted } as const;

// The note under the form: the warning about an open invitation, and the one-time notice on step 2.
const noteStyle = { ...mutedText, fontSize: '12.5px', lineHeight: 1.5 } as const;

// Both steps share the Modal and the test id. Only step 1 may be dismissed from outside.
const DialogShell = ({ onClose, children }: { onClose: () => void; children: ReactNode }) => (
  <Modal onClose={onClose} width={400} zIndex={1500} labelledBy="create-invitation-title">
    <div data-testid="create-invitation-dialog" style={{ padding: '22px' }}>
      {children}
    </div>
  </Modal>
);

// Creates an invitation and shows its link once. The link cannot be read again afterwards.
export const CreateInvitationDialog = ({ onClose, initial }: CreateInvitationDialogProps) => {
  const { t, lang } = useTranslation();
  const a = useAssociations();
  const { scope: callerScope } = useAuth();
  const invitations = useInvitations();
  const create = useCreateInvitation();
  const approved = useApprovedScopes();
  const board = invitableBoard(a, callerScope ?? '');
  const ids = boardIds(board);

  const [email, setEmail] = useState(initial?.email ?? '');
  const [scope, setScope] = useState(() => {
    if (initial && ids.includes(initial.scope)) return initial.scope;
    return callerScope && ids.includes(callerScope) ? callerScope : (ids[0] ?? '');
  });
  const [errorKey, setErrorKey] = useState<CreateInvitationErrorKey | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  // Set before mutate: the pending flag reaches a render a tick later, too late for a double click.
  const inFlight = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const typed = email.trim().toLowerCase();
  const replacesOpen =
    typed !== '' &&
    (invitations.data ?? []).some((inv) => inv.email === typed && !isExpired(inv, new Date()));
  const incomplete = email.trim() === '' || scope === '';
  const blocked = incomplete || create.isPending;

  // Step 2 replaces step 1 in the same Modal, whose focus effect runs on mount only. Put the focus on
  // the link, or it falls to the page when the focused button goes away.
  useEffect(() => {
    if (created) linkRef.current?.focus();
  }, [created]);

  const submit = () => {
    if (blocked || inFlight.current) return;
    inFlight.current = true;
    setErrorKey(null);
    const target = email.trim();
    create.mutate(
      { email: target, scope },
      {
        onSuccess: (token) => {
          const until = new Date();
          until.setDate(until.getDate() + INVITATION_DAYS);
          setCreated({ token, email: target, scope, until });
        },
        onError: (err) => setErrorKey(createInvitationErrorKey(err)),
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  // Stays open until the request returns, so the link it brings back is never lost.
  const dismiss = () => {
    if (!create.isPending) onClose();
  };

  if (created) {
    const link = invitationLink(window.location.origin, created.token);
    const message = inviteMessage(lang, created.scope, link);
    const date = new Intl.DateTimeFormat(`${lang}-CH`, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(created.until);

    const selectLink = () => {
      linkRef.current?.focus();
      linkRef.current?.select();
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // No clipboard (an http: page) or it refused: leave the text selected for the user to copy.
        selectLink();
        return;
      }
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    };
    const share = () => {
      // The user cancelling the share sheet rejects the promise; nothing to report.
      navigator.share({ title: message.subject, text: message.body }).catch(() => {});
    };

    return (
      // The link is shown once, so only Fertig closes this step, not Escape or the backdrop.
      <DialogShell onClose={() => {}}>
        <div id="create-invitation-title" style={titleStyle}>
          {t.inviteCreatedTitle}
        </div>
        <div
          style={{ ...mutedText, fontSize: '13.5px', marginTop: '6px', overflowWrap: 'anywhere' }}
        >
          {t.inviteCreatedFor
            .replace('{email}', () => created.email)
            .replace('{node}', () => scopeLabel(a, t, created.scope))
            .replace('{date}', () => date)}
        </div>
        <label htmlFor="invitation-link" style={{ ...labelStyle, margin: '16px 0 6px' }}>
          {t.inviteLink}
        </label>
        <input
          id="invitation-link"
          ref={linkRef}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: '11px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={copy} style={secondaryButtonStyle}>
            {copied ? t.inviteCopied : t.inviteCopy}
          </button>
          <a href={mailtoHref(created.email, message)} style={mailButtonStyle}>
            {t.inviteSendMail}
          </a>
          {typeof navigator.share === 'function' && (
            <button type="button" onClick={share} style={secondaryButtonStyle}>
              {t.inviteShare}
            </button>
          )}
        </div>
        <span role="status" style={srOnly}>
          {copied ? t.inviteCopied : ''}
        </span>
        <div style={{ ...noteStyle, marginTop: '14px' }}>{t.inviteShownOnce}</div>
        <div style={{ display: 'flex', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={primaryButtonStyle}>
            {t.inviteDone}
          </button>
        </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell onClose={dismiss}>
      <div id="create-invitation-title" style={titleStyle}>
        {t.invite}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="invite-email" style={{ ...labelStyle, margin: '16px 0 6px' }}>
          {t.email}
        </label>
        <input
          id="invite-email"
          autoFocus
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        {ids.length === 1 ? (
          <div
            style={{
              fontSize: '13.5px',
              color: theme.color.ink,
              marginTop: '14px',
              overflowWrap: 'anywhere',
            }}
          >
            {`${t.accountsScope}: ${scopeLabel(a, t, ids[0])}`}
          </div>
        ) : (
          <>
            <div id="invite-scope-label" style={{ ...labelStyle, margin: '14px 0 6px' }}>
              {t.accountsScope}
            </div>
            <ScopeChips
              board={board}
              counts={approved.data ? scopeCounts(a, approved.data) : null}
              value={scope}
              onChange={setScope}
              labelledBy="invite-scope-label"
            />
          </>
        )}
        {/* Always rendered, so a screen reader announces the text when it appears. */}
        <div role="status" style={{ ...noteStyle, marginTop: replacesOpen ? '12px' : 0 }}>
          {replacesOpen ? t.inviteReplacesOpen : ''}
        </div>
        {errorKey && (
          <div
            role="alert"
            style={{ color: theme.color.accent, fontSize: '13px', marginTop: '12px' }}
          >
            {t[errorKey]}
          </div>
        )}
        <div style={{ display: 'flex', gap: '11px', marginTop: '20px' }}>
          <button
            type="button"
            onClick={dismiss}
            disabled={create.isPending}
            style={{ ...secondaryButtonStyle, opacity: create.isPending ? 0.5 : 1 }}
          >
            {t.cancel}
          </button>
          {/* aria-disabled while the request runs keeps the focus here. submit() ignores it either way. */}
          <button
            type="submit"
            disabled={incomplete}
            aria-disabled={create.isPending || undefined}
            style={{ ...primaryButtonStyle, opacity: blocked ? 0.5 : 1 }}
          >
            {t.inviteCreate}
          </button>
        </div>
      </form>
    </DialogShell>
  );
};
