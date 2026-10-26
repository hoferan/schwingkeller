import { useEffect, useRef, useState } from 'react';
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
import { invitableScopes, inviteOptionIds } from './scopeOptions';
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

// Creates an invitation and shows its link once. The link cannot be read again afterwards.
export const CreateInvitationDialog = ({ onClose, initial }: CreateInvitationDialogProps) => {
  const { t, lang } = useTranslation();
  const a = useAssociations();
  const { scope: callerScope } = useAuth();
  const invitations = useInvitations();
  const create = useCreateInvitation();
  const options = invitableScopes(a, callerScope ?? '');
  const ids = inviteOptionIds(options);

  const [email, setEmail] = useState(initial?.email ?? '');
  const [scope, setScope] = useState(() =>
    initial && ids.includes(initial.scope) ? initial.scope : (options.own ?? ids[0] ?? ''),
  );
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
  const blocked = email.trim() === '' || scope === '' || create.isPending;

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
      <Modal onClose={() => {}} width={400} zIndex={1500} labelledBy="create-invitation-title">
        <div data-testid="create-invitation-dialog" style={{ padding: '22px' }}>
          <div id="create-invitation-title" style={titleStyle}>
            {t.inviteCreatedTitle}
          </div>
          <div
            style={{
              fontSize: '13.5px',
              color: theme.color.muted,
              marginTop: '6px',
              overflowWrap: 'anywhere',
            }}
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
          <div
            style={{
              fontSize: '12.5px',
              color: theme.color.muted,
              marginTop: '14px',
              lineHeight: 1.5,
            }}
          >
            {t.inviteShownOnce}
          </div>
          <div style={{ display: 'flex', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={primaryButtonStyle}>
              {t.inviteDone}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={dismiss} width={400} zIndex={1500} labelledBy="create-invitation-title">
      <div data-testid="create-invitation-dialog" style={{ padding: '22px' }}>
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
              <label htmlFor="invite-scope" style={{ ...labelStyle, margin: '14px 0 6px' }}>
                {t.accountsScope}
              </label>
              <select
                id="invite-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                style={inputStyle}
              >
                {options.own && (
                  <option value={options.own}>{scopeLabel(a, t, options.own)}</option>
                )}
                {options.groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.ids.map((id) => (
                      <option key={id} value={id}>
                        {scopeLabel(a, t, id)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </>
          )}
          {/* Always rendered, so a screen reader announces the text when it appears. */}
          <div
            role="status"
            style={{
              fontSize: '12.5px',
              color: theme.color.muted,
              marginTop: replacesOpen ? '12px' : 0,
              lineHeight: 1.5,
            }}
          >
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
            <button
              type="submit"
              disabled={blocked}
              style={{ ...primaryButtonStyle, opacity: blocked ? 0.5 : 1 }}
            >
              {t.inviteCreate}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
