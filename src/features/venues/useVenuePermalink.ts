import { useEffect, useRef } from 'react';
import { withVenueParam } from '../../lib/permalink';
import { isFeatureOn } from '../../lib/features';
import { useAssociations } from '../associations/useAssociations';
import type { Venue } from './types';

interface UseVenuePermalinkArgs {
  venueParam: string | null;
  venues: Venue[];
  venuesLoaded: boolean;
  detailId: string | null;
  openDetail: (id: string) => void;
  setExpanded: (updater: (e: Record<string, boolean>) => Record<string, boolean>) => void;
}

// Resolves a ?venue= permalink once the venues query settles, and keeps the
// URL's ?venue= in sync with the open/closed DetailModal afterward. See
// docs/adr/0007-url-parameters-without-a-router.md.
export function useVenuePermalink({
  venueParam, venues, venuesLoaded, detailId, openDetail, setExpanded,
}: UseVenuePermalinkArgs): void {
  // Runs at most once — background refetches must not re-trigger it.
  const appliedVenueParamRef = useRef(false);
  const { byId } = useAssociations();
  useEffect(() => {
    if (!venueParam || appliedVenueParamRef.current || !venuesLoaded) return;
    appliedVenueParamRef.current = true;
    const match = venues.find((v) => v.id === venueParam);
    if (match) {
      openDetail(match.id);
      // With the verband flag on, the venue's row sits under its Teilverband and Verband. A venue
      // without a cantonal association falls back to its canton.
      const node = isFeatureOn('verband') && match.association_id ? byId.get(match.association_id) : undefined;
      const keys = node?.level === 'cantonal' ? [node.parentId, node.id] : [match.canton];
      setExpanded((e) => ({ ...e, ...Object.fromEntries(keys.map((key) => [key, true])) }));
    }
  }, [venueParam, venues, venuesLoaded, openDetail, setExpanded, byId]);

  // Skips its first run so it never strips a permalink's ?venue= before the
  // effect above has applied it.
  const mountedUrlSyncRef = useRef(false);
  useEffect(() => {
    if (!mountedUrlSyncRef.current) {
      mountedUrlSyncRef.current = true;
      return;
    }
    const next = withVenueParam(window.location.pathname + window.location.search, detailId);
    window.history.replaceState(null, '', next);
  }, [detailId]);
}
