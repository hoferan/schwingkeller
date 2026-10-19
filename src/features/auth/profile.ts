import { supabase } from '../../lib/supabase';

export type ProfileStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface Profile {
  id: string;
  status: ProfileStatus;
  scope_association_id: string | null;
  requested_association_id: string | null;
}

const toError = (e: { message: string; code?: string; hint?: string; details?: string }): Error => {
  const err = new Error(e.code ? `[${e.code}] ${e.message}` : e.message);
  err.cause = e;
  return err;
};

export const fetchOwnProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,status,scope_association_id,requested_association_id')
    .eq('id', userId)
    .single();
  if (error) throw toError(error);
  return data as Profile;
};

export const requestReviewAgain = async (): Promise<void> => {
  const { error } = await supabase.rpc('request_review_again');
  if (error) throw toError(error);
};
