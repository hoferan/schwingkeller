import { captureAndFormat, extractCode } from '../../lib/sentry';

export type CreateInvitationErrorKey =
  | 'inviteErrInvalidEmail'
  | 'inviteErrHasAccount'
  | 'inviteErrOpenHigher'
  | 'inviteErrNotAuthorized'
  | 'adminErrGeneric';

export type RevokeInvitationErrorKey = 'inviteErrRevokeNotAuthorized' | 'inviteErrStale' | 'adminErrGeneric';

const messageOf = (err: Error): string => err.message.replace(/^\[\w+\] /, '');

// The texts come from create_invitation and revoke_invitation in
// supabase/migrations/0015_invitations.sql. Only an error the dialog can't explain goes to Sentry.
export const createInvitationErrorKey = (err: unknown): CreateInvitationErrorKey => {
  if (err instanceof Error) {
    if (extractCode(err) === '42501') return 'inviteErrNotAuthorized';
    const message = messageOf(err);
    if (message === 'invalid email') return 'inviteErrInvalidEmail';
    if (message === 'email already has an account') return 'inviteErrHasAccount';
    if (message === 'an invitation for this email is open at a higher level') return 'inviteErrOpenHigher';
  }
  captureAndFormat(err, 'create invitation failed');
  return 'adminErrGeneric';
};

export const revokeInvitationErrorKey = (err: unknown): RevokeInvitationErrorKey => {
  if (err instanceof Error) {
    if (extractCode(err) === '42501') return 'inviteErrRevokeNotAuthorized';
    if (/^cannot revoke an invitation that is /.test(messageOf(err))) return 'inviteErrStale';
  }
  captureAndFormat(err, 'revoke invitation failed');
  return 'adminErrGeneric';
};
