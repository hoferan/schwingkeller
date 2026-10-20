import type { Associations } from '../associations/useAssociations';

// A scope node as the account list names it: "Teilverband BKSV", "Verband Emmental", or the ESV by
// its short name alone.
export const scopeLabel = (a: Associations, t: { levelRegional: string; levelCantonal: string }, id: string): string => {
  const name = a.shortOf(id) ?? a.nameOf(id);
  const level = a.byId.get(id)?.level;
  if (level === 'regional') return `${t.levelRegional} ${name}`;
  if (level === 'cantonal') return `${t.levelCantonal} ${name}`;
  return name;
};
