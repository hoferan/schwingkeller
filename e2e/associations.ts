import type { CantonalId, RegionalId } from '../src/data/associations';
import type { Association } from '../src/features/associations/tree';
import { associationsFor } from '../src/features/associations/useAssociations';

// Scenarios name Verbände and Teilverbände the way a German-speaking visitor reads them. The app's
// test ids and venue rows use ids, so these turn one into the other and fail loudly on a typo.
const de = associationsFor('de');

type Regional = Extract<Association, { level: 'regional' }>;
type Cantonal = Extract<Association, { level: 'cantonal' }>;
const isRegional = (a: Association): a is Regional => a.level === 'regional';
const isCantonal = (a: Association): a is Cantonal => a.level === 'cantonal';

// In the order the sidebar lists them.
export const TEILVERBAND_IDS: RegionalId[] = de.childrenOf('esv').filter(isRegional).map((a) => a.id);

export const teilverbandId = (short: string): RegionalId => {
  const id = TEILVERBAND_IDS.find((r) => de.shortOf(r) === short);
  if (!id) throw new Error(`no Teilverband abbreviated "${short}"`);
  return id;
};

export const verbandId = (name: string): CantonalId => {
  const verband = de.cantonal.filter(isCantonal).find((a) => de.nameOf(a.id) === name);
  if (!verband) throw new Error(`no Verband named "${name}"`);
  return verband.id;
};

export const verbandIdsOf = (teilverband: RegionalId): CantonalId[] =>
  de.childrenOf(teilverband).filter(isCantonal).map((a) => a.id);
