import { ASSOCIATIONS, type CantonalId, type RegionalId } from './associations';

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

const PARENT = Object.fromEntries(
  ASSOCIATIONS.flatMap((a) => (a.level === 'cantonal' ? [[a.id, a.parentId]] : [])),
) as Record<CantonalId, RegionalId>;

// A cantonal association takes the tint of its regional association.
export const tintOf = (id: CantonalId): string => REGIONAL_TINTS[PARENT[id]];
