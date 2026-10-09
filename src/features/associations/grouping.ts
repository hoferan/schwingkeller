import type { CantonalId, RegionalId } from '../../data/associations';
import type { Venue } from '../venues/types';
import type { AssociationTree } from './tree';

export interface AssociationGroup { id: CantonalId; count: number; venues: Venue[] }
export interface RegionalGroup { id: RegionalId; count: number; associations: AssociationGroup[] }

const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name, 'de');

// Groups by the stored association, never by canton, so a club across a border sits with its own
// association.
export const groupByAssociation = (venues: Venue[], tree: AssociationTree, includeEmpty: boolean): RegionalGroup[] => {
  const buckets = new Map<string, Venue[]>();
  venues.forEach((v) => {
    buckets.set(v.association_id, [...(buckets.get(v.association_id) ?? []), v]);
  });

  const root = [...tree.byId.values()].find((a) => a.level === 'federation');
  const groups: RegionalGroup[] = [];
  (root ? tree.childrenOf(root.id) : []).forEach((regional) => {
    if (regional.level !== 'regional') return;
    const associations: AssociationGroup[] = [];
    tree.childrenOf(regional.id).forEach((a) => {
      if (a.level !== 'cantonal') return;
      const list = (buckets.get(a.id) ?? []).sort(byName);
      if (list.length > 0 || includeEmpty) associations.push({ id: a.id, count: list.length, venues: list });
    });
    const count = associations.reduce((n, a) => n + a.count, 0);
    if (count > 0 || includeEmpty) groups.push({ id: regional.id, count, associations });
  });

  return groups;
};
