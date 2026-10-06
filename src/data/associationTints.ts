import { ASSOCIATIONS, type RegionalId } from './associations';

// One colour per regional association. The sidebar dot, the Teilverband badge and later the map
// pins (#95) all take it from here. Darker than theme.color.accent so they don't read as buttons;
// against white they reach 7.6, 6.8, 6.4, 7.1 and 5.9 to 1, enough for the badge's white text.
// #95 may adjust them once they are checked on every tile layer.
export const REGIONAL_TINTS: Record<RegionalId, string> = {
  bksv: '#9B2C1F',
  isv: '#1F5F8B',
  nosv: '#2E6B3F',
  nwsv: '#6A4A8C',
  swsv: '#8A5A12',
};

const byId = new Map<string, (typeof ASSOCIATIONS)[number]>(ASSOCIATIONS.map((a) => [a.id, a]));

// Venues carry a plain string, so this takes any id: a cantonal association gets its regional
// association's tint, the federation and unknown ids get none.
export const tintOf = (id: string | null | undefined): string | null => {
  const node = id ? byId.get(id) : undefined;
  if (!node) return null;
  if (node.level === 'regional') return REGIONAL_TINTS[node.id];
  if (node.level === 'cantonal') return REGIONAL_TINTS[node.parentId];
  return null;
};
