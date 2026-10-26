import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import type { TKey } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';
import { captureAndFormat } from '../../lib/sentry';
import { theme } from '../../theme';
import { useAssociations } from '../associations/useAssociations';
import type { AuthFailure } from './authFailure';
import { primaryButtonStyle, secondaryButtonStyle } from './formStyles';
import { MIN_PASSWORD_LENGTH, SignUpForm } from './SignUpForm';
import { useAuth } from './useAuth';
import { useInvitation } from './useInvitation';

const SIGN_UP_MESSAGE: Record<AuthFailure, TKey> = {
  // Sign-up never fails this way; listed so the record covers every kind.
  credentials: 'inviteInvalid',
  invitation: 'inviteInvalid',
  weakPassword: 'registerErrShort',
  rateLimit: 'authErrRateLimit',
  unavailable: 'authErrUnavailable',
};

interface InviteDialogProps {
  token: string;
  onClose: () => void;
}

const textStyle = { margin: 0, fontSize: '14px', color: theme.color.ink, lineHeight: 1.5, overflowWrap: 'anywhere' } as const;

// Opens from an invitation link (?invite=, #140). Every token that isn't a live invitation gets the
// same message, as the database answers (ADR 0020). 'submitting' keeps the form on screen while the
// new session arrives, so the "already signed in" note never shows for the account just made.
export const InviteDialog = ({ token, onClose }: InviteDialogProps) => {
  const { t } = useTranslation();
  const { session, signUp, signOut } = useAuth();
  const { nameOf } = useAssociations();
  const { data: invitation, error: lookupError, isPending } = useInvitation(token);
  const [step, setStep] = useState<'form' | 'submitting' | 'welcome'>('form');
  const [error, setError] = useState('');

  useEffect(() => {
    if (lookupError) captureAndFormat(lookupError, 'invitation lookup failed');
  }, [lookupError]);

  const submit = async (email: string, password: string) => {
    setStep('submitting');
    setError('');
    const { error: failure } = await signUp(email, password, token);
    if (!failure) {
      setStep('welcome');
      return;
    }
    setError(t[SIGN_UP_MESSAGE[failure]].replace('{n}', String(MIN_PASSWORD_LENGTH)));
    setStep('form');
  };

  const dismiss = () => {
    if (step !== 'submitting') onClose();
  };

  const closeButton = (autoFocus = false) => (
    <div style={{ display: 'flex', marginTop: '18px' }}>
      <button type="button" onClick={onClose} autoFocus={autoFocus} style={primaryButtonStyle}>{t.close}</button>
    </div>
  );

  let title: string = t.inviteTitle;
  let body: ReactNode;
  if (step === 'welcome' && invitation) {
    title = t.inviteWelcomeTitle;
    body = (
      <>
        <p style={textStyle}>{t.inviteWelcome.replace('{node}', nameOf(invitation.associationId))}</p>
        {closeButton(true)}
      </>
    );
  } else if (session && step === 'form') {
    body = (
      <>
        <p style={textStyle}>{t.inviteSignedInAs.replace('{email}', session.user.email ?? '')}</p>
        <div style={{ display: 'flex', gap: '11px', marginTop: '18px' }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>{t.cancel}</button>
          <button type="button" onClick={() => { void signOut(); }} style={primaryButtonStyle}>{t.inviteSignOut}</button>
        </div>
      </>
    );
  } else if (isPending) {
    body = <p role="status" style={{ ...textStyle, color: theme.color.muted }}>{t.inviteChecking}</p>;
  } else if (lookupError || !invitation) {
    body = (
      <>
        <p style={textStyle}>{t.inviteInvalid}</p>
        {closeButton()}
      </>
    );
  } else {
    body = (
      <>
        <p style={{ ...textStyle, marginBottom: '16px' }}>
          {t.inviteFor.replace('{node}', nameOf(invitation.associationId))}
        </p>
        <SignUpForm
          email={invitation.email}
          busy={step === 'submitting'}
          error={error}
          onSubmit={(password) => { void submit(invitation.email, password); }}
          onCancel={onClose}
        />
      </>
    );
  }

  const header = (
    <div style={{ background: theme.color.ink, padding: '18px 20px' }}>
      <span
        id="invite-dialog-title"
        style={{ fontFamily: theme.font.display, textTransform: 'uppercase', fontSize: '16px', fontWeight: 700, color: theme.color.bg }}
      >
        {title}
      </span>
    </div>
  );

  return (
    <Modal onClose={dismiss} width={360} zIndex={1500} header={header} labelledBy="invite-dialog-title">
      <div style={{ padding: '18px 20px 20px' }}>{body}</div>
    </Modal>
  );
};
