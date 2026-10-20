import { supabase } from '../../lib/supabase';
import { toError, type ProfileStatus } from '../auth/profile';

// A profile as the account list sees it. RLS returns only the rows the caller may manage, plus
// their own (profiles_select_managed and profiles_select_own in the migrations).
export interface Account {
  id: string;
  email: string;
  status: ProfileStatus;
  requested_association_id: string | null;
  scope_association_id: string | null;
  created_at: string;
}

export type AccountFilter = ProfileStatus | 'all';

const COLUMNS = 'id,email,status,requested_association_id,scope_association_id,created_at';

// Filtered in the database: PostgREST returns at most 1000 rows, and a long-lived local stack
// collects more applicants than that.
export const fetchAccounts = async (filter: AccountFilter): Promise<Account[]> => {
  const query = supabase.from('profiles').select(COLUMNS);
  const filtered = filter === 'all' ? query : query.eq('status', filter);
  const { data, error } = await filtered.order('created_at', { ascending: false });
  if (error) throw toError(error);
  return data as Account[];
};

// A count only, so the badge stays right however many rows there are.
export const fetchPendingCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw toError(error);
  return count ?? 0;
};

// The scope of every approved editor the caller can see, for the counts in the scope picker.
export const fetchApprovedScopes = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('scope_association_id')
    .eq('status', 'approved');
  if (error) throw toError(error);
  return (data as { scope_association_id: string | null }[])
    .map((row) => row.scope_association_id)
    .filter((id): id is string => id !== null);
};

export const approveEditor = async (targetId: string, scope: string): Promise<void> => {
  const { error } = await supabase.rpc('approve_editor', { target_id: targetId, scope });
  if (error) throw toError(error);
};

export const rejectEditor = async (targetId: string): Promise<void> => {
  const { error } = await supabase.rpc('reject_editor', { target_id: targetId });
  if (error) throw toError(error);
};
