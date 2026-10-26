import { supabase } from '../../lib/supabase';
import { toError } from './profile';

// A live invitation, as invitation_details shows it to anyone holding the token (migration 0015).
export interface Invitation {
  email: string;
  associationId: string;
  expiresAt: string;
}

interface InvitationRow {
  email: string;
  association_id: string;
  expires_at: string;
}

// Null for every token that doesn't match a live invitation: unknown, used, revoked or expired.
// The database doesn't say which, and neither does the app.
export const fetchInvitation = async (token: string): Promise<Invitation | null> => {
  const { data, error } = await supabase.rpc('invitation_details', { token });
  if (error) throw toError(error);
  const row = (data as InvitationRow[] | null)?.[0];
  return row ? { email: row.email, associationId: row.association_id, expiresAt: row.expires_at } : null;
};
