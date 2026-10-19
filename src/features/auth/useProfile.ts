import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
