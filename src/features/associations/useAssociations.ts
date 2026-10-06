import { ASSOCIATION_NAMES, isAssociationId } from '../../data/associations';
import { useTranslation } from '../../i18n/useTranslation';
import { buildTree, type AssociationTree } from './tree';

// Built once: the tree is static in the frontend. This hook is the only way components reach it,
// so loading the tree from the database later would change this file and nothing else.
const TREE = buildTree();

export const useAssociations = (): AssociationTree & {
  nameOf(id: string): string;
  shortOf(id: string): string | null;
} => {
  const { lang } = useTranslation();
  const names = ASSOCIATION_NAMES[lang];
  return {
    ...TREE,
    nameOf: (id) => (isAssociationId(id) ? names[id].name : id),
    shortOf: (id) => (isAssociationId(id) ? (names[id].short ?? null) : null),
  };
};
