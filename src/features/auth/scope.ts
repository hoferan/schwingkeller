import type { AssociationTree } from '../associations/tree';

// Mirrors public.association_is_within: walk up from the node and look for the scope.
export const isWithin = (tree: AssociationTree, node: string, scope: string): boolean => {
  const seen = new Set<string>();
  let current = tree.byId.get(node);
  while (current && !seen.has(current.id)) {
    if (current.id === scope) return true;
    seen.add(current.id);
    current = current.parentId === null ? undefined : tree.byId.get(current.parentId);
  }
  return false;
};

// Mirrors public.can_write_association. Only the database enforces this; the client uses it to
// decide which controls to show.
export const canWriteAssociation = (
  tree: AssociationTree,
  scope: string | null,
  associationId: string | null,
): boolean => {
  if (scope === null) return false;
  if (associationId === null) return scope === 'esv';
  return isWithin(tree, associationId, scope);
};
