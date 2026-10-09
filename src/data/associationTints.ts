import { ASSOCIATIONS, type RegionalId } from './associations';

// One colour per regional association, taken from its team clothing: BKSV wears black, ISV red with
// a black band, NOSV green, NWSV royal blue and SWSV a blue-grey. The sidebar dot, the Teilverband
// badge, and the map pins and clusters all take it from here. NOSV's green and SWSV's blue-grey are
// darker than the clothing, so the badge's white text reaches 4.5 to 1 on every colour. NOSV's
// green also sits darker than ISV's red, which keeps the two apart for red-green colour blindness.
// White edges on pins and clusters keep black BKSV readable on the satellite view.
export const REGIONAL_TINTS: Record<RegionalId, string> = {
  bksv: '#1A1A1A',
  isv: '#E30613',
  nosv: '#0B7A26',
  nwsv: '#1854B4',
  swsv: '#5D6B80',
};

// Pins and cluster shares for venues without an association, in grey, since red is ISV's colour.
export const UNASSIGNED_TINT = '#767676';

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
