import { ASSOCIATION_HOME_BOUNDS } from '../../data/associationBounds';
import type { CantonBounds } from '../../data/cantonBounds';
import type { Venue } from '../venues/types';
import type { AssociationTree } from './tree';

const HOME_BOUNDS: Readonly<Record<string, CantonBounds | undefined>> = ASSOCIATION_HOME_BOUNDS;

const box = (points: [number, number][]): CantonBounds | null =>
  points.length === 0
    ? null
    : [
        [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))],
        [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))],
      ];

// The sidebar groups a ?vb= link opens: a Verband sits inside its Teilverband, so both open. The
// keys are the ones AssociationGroups reads.
export const expandedKeysFor = (id: string, tree: AssociationTree): string[] => {
  const node = tree.byId.get(id);
  if (node?.level === 'cantonal') return [node.parentId, node.id];
  if (node?.level === 'regional') return [node.id];
  return [];
};

// Where a ?vb= link frames the map. A Verband or Teilverband is framed to the venues filed under it,
// wherever they are. One without venues yet gets its home area: a Verband its own box, a Teilverband
// the union of its Verbände's boxes.
export const boundsForAssociation = (
  id: string,
  venues: Venue[],
  tree: AssociationTree,
): CantonBounds | null => {
  const node = tree.byId.get(id);
  if (!node || node.level === 'federation') return null;
  const cantonal = node.level === 'cantonal' ? [node.id] : tree.childrenOf(node.id).map((a) => a.id);
  const inside = new Set<string>(cantonal);
  const own = venues.filter((v) => inside.has(v.association_id));
  return (
    box(own.map((v) => [v.lat, v.lng])) ??
    box(cantonal.flatMap((a) => HOME_BOUNDS[a] ?? []))
  );
};
