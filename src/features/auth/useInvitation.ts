import { useQuery } from '@tanstack/react-query';
import { fetchInvitation } from './invitation';

// One lookup per dialog. A used invitation looks up as nothing, so a refetch after sign-up, on window
// focus say, would turn the welcome step into "link not valid". gcTime 0: the token is a credential
// until it is used, so the cache lets go of it as soon as the dialog does. A failed lookup isn't
// retried; the dialog shows the same message as for a bad token.
export const useInvitation = (token: string) =>
  useQuery({
    queryKey: ['invitation', token],
    queryFn: () => fetchInvitation(token),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
