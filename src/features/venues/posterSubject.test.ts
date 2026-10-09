import { describe, it, expect } from 'vitest';
import type { Venue } from './types';
import { boundsForCanton } from '../../data/cantonBounds';
import { cantonByCode, wappenUrl } from '../../data/cantons';
import { ASSOCIATION_HOME_BOUNDS } from '../../data/associationBounds';
import { associationsFor } from '../associations/useAssociations';
import {
  PosterGenerationError, associationPosterSubject, cantonPosterSubject, posterSubjectFor,
} from './posterSubject';

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'FR', address: '', lat: 46.8, lng: 7.1,
  indoor: true, outdoor: false, person: '', phone: '', website: '', photos: [], association_id: 'freiburg', ...over,
});

const venues = [
  v({ id: 'fr1', canton: 'FR', association_id: 'freiburg' }),
  v({ id: 'fr2', canton: 'FR', association_id: 'freiburg' }),
  v({ id: 'lu1', canton: 'LU', association_id: 'luzern' }),
  v({ id: 'esch', name: 'Schwingkeller Escholzmatt', canton: 'LU', association_id: 'emmental' }),
];

describe('cantonPosterSubject', () => {
  it('describes a canton poster for FR', () => {
    const s = cantonPosterSubject('FR', venues);
    expect(s.id).toBe('FR');
    expect(s.name).toBe(cantonByCode('FR')?.name);
    expect(s.venues.map((x) => x.id)).toEqual(['fr1', 'fr2']);
    expect(s.count).toBe(2);
    expect(s.mark).toEqual({ kind: 'arms', url: wappenUrl('FR') });
    expect(s.homeBounds).toEqual(boundsForCanton('FR'));
    expect(s.permalink('https://x.app/?vb=luzern&venue=9')).toBe('https://x.app/?ctn=FR');
  });

  it('rejects an unknown canton with [UNKNOWN_CANTON]', () => {
    expect(() => cantonPosterSubject('XX', [])).toThrow(PosterGenerationError);
    expect(() => cantonPosterSubject('XX', [])).toThrow('[UNKNOWN_CANTON]');
  });
});

describe('associationPosterSubject', () => {
  it('describes the Freiburg Verband in German', () => {
    const s = associationPosterSubject('freiburg', venues, associationsFor('de'));
    expect(s.id).toBe('freiburg');
    expect(s.name).toBe('Freiburg');
    expect(s.count).toBeNull();
    expect(s.mark).toEqual({ kind: 'association', tint: '#5D6B80', badge: { text: 'SWSV', colour: '#5D6B80' } });
    expect(s.venues.map((x) => x.id)).toEqual(['fr1', 'fr2']);
    expect(s.permalink('https://x.app/?ctn=FR')).toBe('https://x.app/?vb=freiburg');
  });

  it.each([['fr', 'Fribourg'], ['it', 'Friburgo']] as const)('names Freiburg and badges it ARLS in %s', (lang, name) => {
    const s = associationPosterSubject('freiburg', venues, associationsFor(lang));
    expect(s.name).toBe(name);
    expect(s.mark).toMatchObject({ badge: { text: 'ARLS' } });
  });

  it('files Escholzmatt (LU) under Emmental and not under Luzern', () => {
    const de = associationsFor('de');
    expect(associationPosterSubject('emmental', venues, de).venues.map((x) => x.id)).toEqual(['esch']);
    expect(associationPosterSubject('luzern', venues, de).venues.map((x) => x.id)).toEqual(['lu1']);
  });

  it('frames a Verband without venues to its home area', () => {
    const s = associationPosterSubject('berner-jura', venues, associationsFor('de'));
    expect(s.venues).toEqual([]);
    expect(s.homeBounds).toEqual(ASSOCIATION_HOME_BOUNDS['berner-jura']);
  });

  it.each(['nope', 'bksv', 'esv'])('rejects %s with [UNKNOWN_ASSOCIATION]', (id) => {
    expect(() => associationPosterSubject(id, venues, associationsFor('de'))).toThrow(PosterGenerationError);
    expect(() => associationPosterSubject(id, venues, associationsFor('de'))).toThrow('[UNKNOWN_ASSOCIATION]');
  });
});

describe('posterSubjectFor', () => {
  it('dispatches on the target kind', () => {
    const de = associationsFor('de');
    expect(posterSubjectFor({ kind: 'canton', code: 'FR' }, venues, de).id).toBe('FR');
    expect(posterSubjectFor({ kind: 'association', id: 'emmental' }, venues, de).id).toBe('emmental');
  });
});
