import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listVenues, createVenue, updateVenue, removeVenue, replaceAllVenues,
} from './api';
import type { VenueInput } from './types';

const KEY = ['venues'] as const;

export const useVenues = () =>
  useQuery({ queryKey: KEY, queryFn: listVenues });

export const useVenueMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({ mutationFn: (v: VenueInput) => createVenue(v), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Partial<VenueInput> }) => updateVenue(a.id, a.input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => removeVenue(id), onSuccess: invalidate }),
    replaceAll: useMutation({
      mutationFn: (v: (VenueInput & { photo_urls: string[] })[]) => replaceAllVenues(v),
      onSuccess: invalidate,
    }),
  };
};
