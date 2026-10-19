import { describe, it, expect } from 'vitest';
import { buildTree } from '../associations/tree';
import { canWriteAssociation, isWithin } from './scope';

const tree = buildTree();

describe('canWriteAssociation', () => {
  it('lets a regional editor write their own node and the ones below', () => {
    expect(canWriteAssociation(tree, 'bksv', 'emmental')).toBe(true);
    expect(canWriteAssociation(tree, 'bksv', 'oberland')).toBe(true);
    expect(canWriteAssociation(tree, 'bksv', 'luzern')).toBe(false);
  });

  it('keeps a cantonal editor to their own node', () => {
    expect(canWriteAssociation(tree, 'emmental', 'emmental')).toBe(true);
    expect(canWriteAssociation(tree, 'emmental', 'oberland')).toBe(false);
  });

  it('lets the root write everything, including rows without a Verband', () => {
    expect(canWriteAssociation(tree, 'esv', 'luzern')).toBe(true);
    expect(canWriteAssociation(tree, 'esv', null)).toBe(true);
  });

  it('gives nobody without a scope any right', () => {
    expect(canWriteAssociation(tree, null, 'emmental')).toBe(false);
    expect(canWriteAssociation(tree, null, null)).toBe(false);
  });

  it('keeps rows without a Verband for the root', () => {
    expect(canWriteAssociation(tree, 'bksv', null)).toBe(false);
  });

  it('says no, and does not throw, for a node the tree does not know', () => {
    expect(canWriteAssociation(tree, 'bksv', 'no-such-node')).toBe(false);
    expect(canWriteAssociation(tree, 'no-such-scope', 'emmental')).toBe(false);
  });
});

describe('isWithin', () => {
  it('counts a node as within itself', () => {
    expect(isWithin(tree, 'bksv', 'bksv')).toBe(true);
  });
  it('is false for an unknown node', () => {
    expect(isWithin(tree, 'no-such-node', 'bksv')).toBe(false);
  });
});
