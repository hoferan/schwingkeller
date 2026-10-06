import { describe, it, expect } from 'vitest';
import { buildTree } from './tree';

const tree = buildTree();

describe('buildTree', () => {
  it('looks associations up by id', () => {
    expect(tree.byId.get('emmental')?.parentId).toBe('bksv');
    expect(tree.byId.get('nowhere')).toBeUndefined();
  });

  it('lists children in sort order', () => {
    expect(tree.childrenOf('esv').map((a) => a.id)).toEqual(['bksv', 'isv', 'nosv', 'nwsv', 'swsv']);
    const bern = tree.childrenOf('bksv').map((a) => a.id);
    expect([bern[0], bern[bern.length - 1]]).toEqual(['berner-jura', 'seeland']);
    expect(tree.childrenOf('emmental')).toEqual([]);
  });

  it('finds the regional association of a node', () => {
    expect(tree.regionalOf('emmental')?.id).toBe('bksv');
    expect(tree.regionalOf('isv')?.id).toBe('isv');
    expect([tree.regionalOf('esv'), tree.regionalOf('nowhere'), tree.regionalOf(null)]).toEqual([null, null, null]);
  });

  it('lists the 29 cantonal associations in tree order', () => {
    expect(tree.cantonal).toHaveLength(29);
    expect([tree.cantonal[0].id, tree.cantonal[28].id]).toEqual(['berner-jura', 'wallis']);
  });
});
