import { supabase } from '../../lib/supabase';
import { toError } from '../auth/profile';

// An open invitation as the list sees it. RLS returns only the rows the caller may manage that are
// neither used nor revoked (supabase/migrations/0015_invitations.sql).
export interface Invitation {
  id: string;
  email: string;
  association_id: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
}

export const INVITATION_DAYS = 7;

const COLUMNS = 'id,email,association_id,invited_by,created_at,expires_at';

export const fetchInvitations = async (): Promise<Invitation[]> => {
  const { data, error } = await supabase
    .from('invitations')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw toError(error);
  return data as Invitation[];
};

// Resolves to the token. It is shown once and never stored anywhere else.
export const createInvitation = async (email: string, scope: string): Promise<string> => {
  const { data, error } = await supabase.rpc('create_invitation', { target_email: email, scope });
  if (error) throw toError(error);
  return data as string;
};

export const revokeInvitation = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('revoke_invitation', { invitation_id: id });
  if (error) throw toError(error);
};

// The database treats an invitation as live while expires_at > now(), so the instant itself is expired.
export const isExpired = (inv: Pick<Invitation, 'expires_at'>, now: Date): boolean =>
  new Date(inv.expires_at).getTime() <= now.getTime();

export const invitationLink = (origin: string, token: string): string =>
  `${origin}/?invite=${encodeURIComponent(token)}`;
