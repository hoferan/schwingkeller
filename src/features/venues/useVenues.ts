import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listVenues, createVenue, updateVenue, removeVenue, syncVenuePhotos, VenueChangeRefusedError,
} from './api';
import type { VenueInput, VenuePhoto } from './types';

const KEY = ['venues'] as const;

export const useVenues = () =>
  useQuery({ queryKey: KEY, queryFn: listVenues });

export const useVenueMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  // A refused change means the venue is gone or the editor's scope shrank. Refetch both, so the
  // list and the edit controls match what the database allows.
  const refreshIfRefused = (err: unknown) => {
    if (!(err instanceof VenueChangeRefusedError)) return;
    void invalidate();
    void qc.invalidateQueries({ queryKey: ['profile'] });
  };
  return {
    create: useMutation({ mutationFn: (v: VenueInput) => createVenue(v), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Partial<VenueInput> }) => updateVenue(a.id, a.input),
      onSuccess: invalidate,
      onError: refreshIfRefused,
    }),
    remove: useMutation({
      mutationFn: (id: string) => removeVenue(id),
      onSuccess: invalidate,
      onError: refreshIfRefused,
    }),
    syncPhotos: useMutation({
      mutationFn: (a: { venueId: string; original: VenuePhoto[]; draft: VenuePhoto[] }) =>
        syncVenuePhotos(a.venueId, a.original, a.draft),
      onSuccess: invalidate,
    }),
  };
};
