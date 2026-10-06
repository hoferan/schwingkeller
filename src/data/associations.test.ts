import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANGS } from '../i18n/translations';
import { ASSOCIATIONS, ASSOCIATION_NAMES, HOME_AREAS, isAssociationId, isCantonalId } from './associations';

// The database is the authority; integration/association-parity.test.ts compares against it. This
// reads the migration as text so a drift shows up in the unit run already.
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/0008_associations.sql'), 'utf8');
const unquote = (s: string) => (s === 'null' ? null : s.slice(1, -1));

describe('ASSOCIATIONS', () => {
  it('has 35 associations: 1 federation, 5 regional, 29 cantonal', () => {
    const count = (level: string) => ASSOCIATIONS.filter((a) => a.level === level).length;
    expect(ASSOCIATIONS).toHaveLength(35);
    expect([count('federation'), count('regional'), count('cantonal')]).toEqual([1, 5, 29]);
  });

  it('points every parent at an existing association one level up', () => {
    const levelOf = new Map<string, string>(ASSOCIATIONS.map((a) => [a.id, a.level]));
    const parentLevel = { federation: undefined, regional: 'federation', cantonal: 'regional' } as const;
    ASSOCIATIONS.forEach((a) => {
      expect(a.parentId === null ? undefined : levelOf.get(a.parentId), a.id).toBe(parentLevel[a.level]);
    });
  });

  it('has the same ids and sort order as the migration', () => {
    const rows = [...migration.matchAll(/\('([a-z-]+)', (null|'[a-z-]+'), '([a-z]+)', '[^']*', (\d+)\)/g)].map(
      ([, id, parent, level, sortOrder]) => [id, unquote(parent), level, Number(sortOrder)],
    );
    expect(rows).toHaveLength(35);
    expect(ASSOCIATIONS.map((a) => [a.id, a.parentId, a.level, a.sortOrder])).toEqual(rows);
  });
});

describe('HOME_AREAS', () => {
  it('has the same home areas as the migration', () => {
    const rows = [...migration.matchAll(/\('([A-Z]{2})', (null|'[^']+'), '([a-z-]+)'\)/g)].map(
      ([, canton, district, id]) => [canton, unquote(district), id],
    );
    expect(rows).toHaveLength(35);
    expect(HOME_AREAS.map((h) => [h.canton, h.bernDistrict, h.associationId])).toEqual(rows);
  });
});

describe('ASSOCIATION_NAMES', () => {
  it('names every association in de, fr and it', () => {
    LANGS.forEach((lang) => {
      ASSOCIATIONS.forEach(({ id }) => {
        expect(ASSOCIATION_NAMES[lang][id]?.name, `${lang} ${id}`).toBeTruthy();
      });
    });
  });

  it('gives esv and the five regional associations a short in every language', () => {
    const withShort = ASSOCIATIONS.filter((a) => a.level !== 'cantonal').map((a) => a.id);
    expect(withShort).toHaveLength(6);
    LANGS.forEach((lang) => {
      withShort.forEach((id) => expect(ASSOCIATION_NAMES[lang][id].short, `${lang} ${id}`).toBeTruthy());
    });
    expect(ASSOCIATION_NAMES.fr.swsv.short).toBe('ARLS');
    expect(ASSOCIATION_NAMES.it.esv.short).toBe('AFLS');
    expect(ASSOCIATION_NAMES.de.swsv.short).toBe('SWSV');
  });

  it('uses the official and confirmed names', () => {
    expect(ASSOCIATION_NAMES.de.nwsv.name).toBe('Nordwestschweizerischer Schwingerverband');
    expect(ASSOCIATION_NAMES.de.bksv.name).toBe('Bernisch-Kantonaler Schwingerverband');
    expect(ASSOCIATION_NAMES.fr.swsv.name).toBe('Association romande de lutte suisse');
    expect(ASSOCIATION_NAMES.fr.oberaargau.name).toBe('Haute-Argovie');
    expect(ASSOCIATION_NAMES.it.wallis.name).toBe('Vallese');
  });
});

describe('isAssociationId', () => {
  it('accepts tree ids only', () => {
    expect(isAssociationId('emmental')).toBe(true);
    expect([isAssociationId('nowhere'), isAssociationId(null), isAssociationId(42)]).toEqual([false, false, false]);
  });
});

describe('isCantonalId', () => {
  it('accepts the 29 cantonal associations only', () => {
    expect(isCantonalId('emmental')).toBe(true);
    expect(['bksv', 'esv', 'nowhere', null, 42].map(isCantonalId)).toEqual([false, false, false, false, false]);
  });
});
