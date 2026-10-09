import { ASSOCIATIONS } from '../../data/associations';

export type Association = (typeof ASSOCIATIONS)[number];
export type RegionalAssociation = Extract<Association, { level: 'regional' }>;

const isRegional = (a: Association): a is RegionalAssociation => a.level === 'regional';

export interface AssociationTree {
  byId: ReadonlyMap<string, Association>;
  childrenOf(id: string): Association[];
  // A cantonal association's parent, a regional association itself, null for the federation.
  regionalOf(id: string | null | undefined): RegionalAssociation | null;
  // The 29 cantonal associations, regional sort order first, then their own.
  cantonal: Association[];
}

export const buildTree = (associations: readonly Association[] = ASSOCIATIONS): AssociationTree => {
  const byId = new Map<string, Association>(associations.map((a) => [a.id, a]));
  const children = new Map<string, Association[]>();
  associations.forEach((a) => {
    if (a.parentId === null) return;
    children.set(a.parentId, [...(children.get(a.parentId) ?? []), a]);
  });
  children.forEach((list) => list.sort((x, y) => x.sortOrder - y.sortOrder));

  const childrenOf = (id: string) => children.get(id) ?? [];
  const regionalOf = (id: string | null | undefined): RegionalAssociation | null => {
    const node = id ? byId.get(id) : undefined;
    if (!node || node.level === 'federation') return null;
    if (isRegional(node)) return node;
    const parent = byId.get(node.parentId);
    return parent && isRegional(parent) ? parent : null;
  };
  const root = associations.find((a) => a.level === 'federation');
  const cantonal = root ? childrenOf(root.id).flatMap((r) => childrenOf(r.id)) : [];

  return { byId, childrenOf, regionalOf, cantonal };
};
