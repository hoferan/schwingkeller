import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveEditor,
  deleteAccount,
  fetchAccounts,
  fetchApprovedScopes,
  fetchPendingCount,
  reactivateEditor,
  rejectEditor,
  setEditorScope,
  suspendEditor,
  type AccountFilter,
} from './accounts';

// Every admin query sits under this key, so one invalidation refreshes the list, the badge and the
// picker counts together.
export const accountsKey = ['accounts'] as const;

// The actions a row runs on an account id: reject, suspend, reactivate and delete. The panel reads
// every pending one under this key, so each targeted row stays busy until its own call returns.
export const rowActionKey = [...accountsKey, 'row-action'] as const;

// Hook-level, because TanStack Query calls a mutate()-level onError for the latest call only, and
// the same mutation serves every row.
type RowActionOptions = { onError?: (err: unknown) => void };

export const useAccounts = (filter: AccountFilter) =>
  useQuery({ queryKey: [...accountsKey, 'list', filter], queryFn: () => fetchAccounts(filter) });

export const usePendingCount = () =>
  useQuery({ queryKey: [...accountsKey, 'pending-count'], queryFn: fetchPendingCount });

export const useApprovedScopes = () =>
  useQuery({ queryKey: [...accountsKey, 'approved-scopes'], queryFn: fetchApprovedScopes });

// Every admin mutation refetches the account queries when it settles. Failures too: a refusal
// usually means someone else changed the account first.
const useAccountMutation = <V>(
  mutationFn: (variables: V) => Promise<void>,
  extra: { mutationKey?: readonly unknown[]; onError?: (err: unknown) => void } = {},
) => {
  const client = useQueryClient();
  return useMutation({ ...extra, mutationFn, onSettled: () => client.invalidateQueries({ queryKey: accountsKey }) });
};

type ScopeChoice = { targetId: string; scope: string };

export const useApproveEditor = () =>
  useAccountMutation(({ targetId, scope }: ScopeChoice) => approveEditor(targetId, scope));

export const useSetEditorScope = () =>
  useAccountMutation(({ targetId, scope }: ScopeChoice) => setEditorScope(targetId, scope));

const useRowAction = (mutationFn: (targetId: string) => Promise<void>, { onError }: RowActionOptions) =>
  useAccountMutation(mutationFn, { mutationKey: rowActionKey, onError });

export const useRejectEditor = (options: RowActionOptions = {}) => useRowAction(rejectEditor, options);
export const useSuspendEditor = (options: RowActionOptions = {}) => useRowAction(suspendEditor, options);
export const useReactivateEditor = (options: RowActionOptions = {}) => useRowAction(reactivateEditor, options);
export const useDeleteAccount = (options: RowActionOptions = {}) => useRowAction(deleteAccount, options);
