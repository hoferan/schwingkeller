import { describe, it, expect } from 'vitest';
import type { Venue } from '../venues/types';
import { buildTree } from './tree';
import { groupByAssociation } from './grouping';

const tree = buildTree();

const v = (over: Partial<Venue>): Venue => ({
  id: '1', name: 'A', canton: 'BE', address: '', lat: 0, lng: 0, indoor: true, outdoor: false,
  person: '', phone: '', website: '', photos: [], association_id: null, ...over,
});

const shape = (venues: Venue[], includeEmpty = false) =>
  groupByAssociation(venues, tree, includeEmpty).groups.map((g) => ({
    id: g.id,
    count: g.count,
    associations: g.associations.map((a) => [a.id, a.count]),
  }));

describe('groupByAssociation', () => {
  it('counts venues per association and per Teilverband', () => {
    const venues = [
      v({ id: '1', association_id: 'emmental' }),
      v({ id: '2', association_id: 'emmental' }),
      v({ id: '3', association_id: 'oberland' }),
      v({ id: '4', canton: 'FR', association_id: 'freiburg' }),
    ];
    expect(shape(venues)).toEqual([
      { id: 'bksv', count: 3, associations: [['emmental', 2], ['oberland', 1]] },
      { id: 'swsv', count: 1, associations: [['freiburg', 1]] },
    ]);
  });

  it('groups by association, not by canton', () => {
    const escholzmatt = v({ id: '9', name: 'Schwingkeller Escholzmatt', canton: 'LU', association_id: 'emmental' });
    const { groups } = groupByAssociation([escholzmatt], tree, false);
    expect(groups[0].id).toBe('bksv');
    expect(groups[0].associations[0].venues).toEqual([escholzmatt]);
  });

  it('puts null, unknown and non-cantonal ids in unassigned, sorted by name', () => {
    const { groups, unassigned } = groupByAssociation(
      [
        v({ id: '1', name: 'Zug Halle', association_id: null }),
        v({ id: '2', name: 'Bern Halle', association_id: 'nowhere' }),
        v({ id: '3', name: 'Mittel Halle', association_id: 'bksv' }),
      ],
      tree,
      false,
    );
    expect(groups).toEqual([]);
    expect(unassigned.map((x) => x.id)).toEqual(['2', '3', '1']);
  });

  it('lists every group when includeEmpty is true', () => {
    const groups = shape([v({ association_id: 'freiburg' })], true);
    expect(groups.map((g) => g.id)).toEqual(['bksv', 'isv', 'nosv', 'nwsv', 'swsv']);
    expect(groups.flatMap((g) => g.associations)).toHaveLength(29);
    expect(groups[0]).toEqual({ id: 'bksv', count: 0, associations: expect.arrayContaining([['emmental', 0]]) });
  });

  it('keeps only non-empty groups when includeEmpty is false', () => {
    expect(shape([v({ association_id: 'freiburg' })])).toEqual([
      { id: 'swsv', count: 1, associations: [['freiburg', 1]] },
    ]);
  });

  it('follows the sort order and sorts venues by name', () => {
    const venues = [
      v({ id: '1', name: 'Burgdorf', association_id: 'emmental' }),
      v({ id: '2', name: 'Ämmital', association_id: 'emmental' }),
      v({ id: '3', name: 'Tavannes', association_id: 'berner-jura' }),
      v({ id: '4', name: 'Luzern', association_id: 'luzern' }),
    ];
    const { groups } = groupByAssociation(venues, tree, false);
    expect(groups.map((g) => g.id)).toEqual(['bksv', 'isv']);
    expect(groups[0].associations.map((a) => a.id)).toEqual(['berner-jura', 'emmental']);
    expect(groups[0].associations[1].venues.map((x) => x.name)).toEqual(['Ämmital', 'Burgdorf']);
  });
});
