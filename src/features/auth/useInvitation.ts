import { useQuery } from '@tanstack/react-query';
import { fetchInvitation } from './invitation';

// gcTime 0: the token is a credential until it is used, so the cache lets go of it as soon as the
// dialog does. A failed lookup isn't retried; the dialog shows the same message as for a bad token.
export const useInvitation = (token: string) =>
  useQuery({
    queryKey: ['invitation', token],
    queryFn: () => fetchInvitation(token),
    retry: false,
    gcTime: 0,
  });
