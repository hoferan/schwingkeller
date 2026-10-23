import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { deleteOwnAccount } from './deleteOwnAccount';
import { fetchOwnProfile, requestReviewAgain } from './profile';

export const profileKey = (userId: string) => ['profile', userId] as const;

export const useProfile = (userId: string | null) =>
  useQuery({
    queryKey: profileKey(userId ?? ''),
    queryFn: () => fetchOwnProfile(userId as string),
    enabled: userId !== null,
  });

export const useRequestReview = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: requestReviewAgain,
    onSuccess: () => client.invalidateQueries({ queryKey: ['profile'] }),
  });
};

// Drops what the cache holds about the account that just left. The account list too, so the next
// account on this tab never sees the last one's rows.
export const forgetAccount = (client: QueryClient): void => {
  client.removeQueries({ queryKey: ['profile'] });
  client.removeQueries({ queryKey: ['accounts'] });
};

export const useDeleteOwnAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => deleteOwnAccount(email, password),
    onSuccess: () => forgetAccount(client),
  });
};
