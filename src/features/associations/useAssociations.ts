import { ASSOCIATION_NAMES, isAssociationId } from '../../data/associations';
import { LANGS, type Lang } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';
import { buildTree, type AssociationTree } from './tree';

export type Associations = AssociationTree & {
  nameOf(id: string): string;
  shortOf(id: string): string | null;
};

// Built once: the tree is static in the frontend. One value per language, so the hook returns the
// same object until the language changes and effects or memos that depend on it don't re-run.
// This hook is the only way components reach the tree, so loading it from the database later would
// change this file and nothing else.
const TREE = buildTree();
const BY_LANG = Object.fromEntries(
  LANGS.map((lang) => {
    const names = ASSOCIATION_NAMES[lang];
    const value: Associations = {
      ...TREE,
      nameOf: (id) => (isAssociationId(id) ? names[id].name : id),
      shortOf: (id) => (isAssociationId(id) ? (names[id].short ?? null) : null),
    };
    return [lang, value];
  }),
) as Record<Lang, Associations>;

// The tree with its names in one language, for code that runs outside a component.
export const associationsFor = (lang: Lang): Associations => BY_LANG[lang];

export const useAssociations = (): Associations => associationsFor(useTranslation().lang);
