import { describe, it, expect } from 'vitest';
import { ASSOCIATION_HOME_BOUNDS } from '../../data/associationBounds';
import type { Venue } from '../venues/types';
import type { CantonalId } from '../../data/associations';
import { buildTree } from './tree';
import { boundsForAssociation, expandedKeysFor } from './focus';

const tree = buildTree();

const venue = (id: string, association_id: CantonalId, lat: number, lng: number): Venue => ({
  id, name: id, canton: 'BE', address: '', lat, lng, indoor: true, outdoor: false,
  person: '', phone: '', website: '', photos: [], association_id,
});

describe('expandedKeysFor', () => {
  it('opens a Verband and its Teilverband', () => {
    expect(expandedKeysFor('emmental', tree)).toEqual(['bksv', 'emmental']);
  });

  it('opens a Teilverband', () => {
    expect(expandedKeysFor('nosv', tree)).toEqual(['nosv']);
  });

  it('opens nothing for an id outside the tree', () => {
    expect(expandedKeysFor('nowhere', tree)).toEqual([]);
  });
});

describe('boundsForAssociation', () => {
  it("frames a Verband's venues", () => {
    const venues = [
      venue('a', 'emmental', 46.95, 7.6),
      venue('b', 'emmental', 47.05, 7.8),
      venue('c', 'mittelland', 46.9, 7.4),
    ];
    expect(boundsForAssociation('emmental', venues, tree)).toEqual([[46.95, 7.6], [47.05, 7.8]]);
  });

  it('includes a venue filed under the Verband outside its home area', () => {
    const venues = [venue('a', 'zuerich', 47.4, 8.5), venue('b', 'zuerich', 47.5, 9.0)];
    expect(boundsForAssociation('zuerich', venues, tree)).toEqual([[47.4, 8.5], [47.5, 9.0]]);
  });

  it('falls back to the home bounds for a Verband without venues', () => {
    expect(boundsForAssociation('berner-jura', [venue('a', 'emmental', 47, 7.7)], tree))
      .toEqual(ASSOCIATION_HOME_BOUNDS['berner-jura']);
  });

  it("frames all of a Teilverband's venues", () => {
    const venues = [
      venue('a', 'emmental', 46.95, 7.6),
      venue('b', 'oberland', 46.6, 7.9),
      venue('c', 'zuerich', 47.4, 8.5),
    ];
    expect(boundsForAssociation('bksv', venues, tree)).toEqual([[46.6, 7.6], [46.95, 7.9]]);
  });

  it("falls back to the union of its Verbände's home bounds for a Teilverband without venues", () => {
    const boxes = tree.childrenOf('isv').map((a) => ASSOCIATION_HOME_BOUNDS[a.id as keyof typeof ASSOCIATION_HOME_BOUNDS]);
    const expected = [
      [Math.min(...boxes.map((b) => b[0][0])), Math.min(...boxes.map((b) => b[0][1]))],
      [Math.max(...boxes.map((b) => b[1][0])), Math.max(...boxes.map((b) => b[1][1]))],
    ];
    expect(boundsForAssociation('isv', [], tree)).toEqual(expected);
  });

  it('returns null for an id outside the tree', () => {
    expect(boundsForAssociation('nowhere', [], tree)).toBeNull();
  });
});
