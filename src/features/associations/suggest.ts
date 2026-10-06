import { HOME_AREAS, type CantonalId } from '../../data/associations';

// The association a venue's address suggests: its canton's, or inside Bern its Verwaltungskreis's.
// Never guesses a Gau: a Bernese address without a known district gets null, and the editor picks
// the association by hand.
export const suggestAssociation = ({
  canton,
  bernDistrict = null,
}: {
  canton: string | null;
  bernDistrict?: string | null;
}): CantonalId | null => {
  const code = canton?.trim().toUpperCase();
  if (!code) return null;
  const district = code === 'BE' ? bernDistrict : null;
  if (code === 'BE' && !district) return null;
  return HOME_AREAS.find((h) => h.canton === code && h.bernDistrict === district)?.associationId ?? null;
};
