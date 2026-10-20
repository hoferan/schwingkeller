import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveEditor,
  fetchAccounts,
  fetchApprovedScopes,
  fetchPendingCount,
  rejectEditor,
  type AccountFilter,
} from './accounts';

// Every admin query sits under this key, so one invalidation refreshes the list, the badge and the
// picker counts together.
export const accountsKey = ['accounts'] as const;

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

export const useRejectEditor = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: rejectEditor,
    onSettled: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};
