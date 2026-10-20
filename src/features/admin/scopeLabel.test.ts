import { describe, it, expect } from 'vitest';
import { STR } from '../../i18n/translations';
import { associationsFor } from '../associations/useAssociations';
import { scopeLabel } from './scopeLabel';

describe('scopeLabel', () => {
  const a = associationsFor('de');

  it.each([
    ['bksv', 'Teilverband BKSV'],
    ['emmental', 'Verband Emmental'],
    ['esv', 'ESV'],
  ])('names %s as "%s"', (id, label) => {
    expect(scopeLabel(a, STR.de, id)).toBe(label);
  });

  it('uses the language of the names it is given', () => {
    expect(scopeLabel(associationsFor('fr'), STR.fr, 'esv')).toBe('AFLS');
  });
});
