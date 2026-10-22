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

// Refetch on failure too: a refusal usually means someone else changed the account first.
export const useApproveEditor = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, scope }: { targetId: string; scope: string }) => approveEditor(targetId, scope),
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useRejectEditor = ({ onError }: RowActionOptions = {}) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: rowActionKey,
    mutationFn: rejectEditor,
    onError,
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useSetEditorScope = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, scope }: { targetId: string; scope: string }) => setEditorScope(targetId, scope),
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useSuspendEditor = ({ onError }: RowActionOptions = {}) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: rowActionKey,
    mutationFn: suspendEditor,
    onError,
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useReactivateEditor = ({ onError }: RowActionOptions = {}) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: rowActionKey,
    mutationFn: reactivateEditor,
    onError,
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useDeleteAccount = ({ onError }: RowActionOptions = {}) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: rowActionKey,
    mutationFn: deleteAccount,
    onError,
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};
