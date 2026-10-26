import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInvitation, fetchInvitations, revokeInvitation } from './invitations';

export const invitationsKey = ['invitations'] as const;

// Every revoke runs under this key, so the list can keep each targeted row busy until its own call returns.
export const revokeRowKey = [...invitationsKey, 'revoke'] as const;

export const useInvitations = () => useQuery({ queryKey: invitationsKey, queryFn: fetchInvitations });

// The result is the token. gcTime 0 drops it from the mutation cache as soon as the dialog unmounts.
export const useCreateInvitation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, scope }: { email: string; scope: string }) => createInvitation(email, scope),
    gcTime: 0,
    onSettled: () => client.invalidateQueries({ queryKey: invitationsKey }),
  });
};

// Hook-level onError, for the reason given in useAccounts.ts. Failures refetch too: a refusal usually
// means the invitation was used or revoked first.
export const useRevokeInvitation = ({ onError }: { onError?: (err: unknown) => void }) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: revokeRowKey,
    mutationFn: revokeInvitation,
    onError,
    onSettled: () => client.invalidateQueries({ queryKey: invitationsKey }),
  });
};
