import type { Associations } from '../associations/useAssociations';

export interface VerbandOption {
  id: string;
  name: string;
}

export interface VerbandOptions {
  top: VerbandOption;
  // One per Teilverband: the Teilverband itself first, then its Kantonal- and Gauverbände.
  groups: { label: string; options: VerbandOption[] }[];
}

// Every node of the tree, in the order the registration form offers them.
export const verbandOptions = (a: Associations): VerbandOptions => {
  const root = [...a.byId.values()].find((x) => x.level === 'federation');
  if (!root) throw new Error('association tree has no federation');
  const option = (id: string): VerbandOption => ({ id, name: a.nameOf(id) });
  return {
    top: option(root.id),
    groups: a.childrenOf(root.id).map((r) => ({
      label: a.nameOf(r.id),
      options: [option(r.id), ...a.childrenOf(r.id).map((c) => option(c.id))],
    })),
  };
};
