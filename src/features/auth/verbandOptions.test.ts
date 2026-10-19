import { describe, it, expect } from 'vitest';
import { associationsFor } from '../associations/useAssociations';
import { verbandOptions } from './verbandOptions';

const a = associationsFor('de');

describe('verbandOptions', () => {
  it('puts the ESV on top', () => {
    expect(verbandOptions(a).top).toEqual({ id: 'esv', name: a.nameOf('esv') });
  });

  it('has one group per Teilverband, in tree order', () => {
    const labels = verbandOptions(a).groups.map((g) => g.label);
    expect(labels).toEqual(a.childrenOf('esv').map((r) => a.nameOf(r.id)));
  });

  it('starts each group with the Teilverband itself, then its Verbände', () => {
    const bksv = verbandOptions(a).groups.find((g) => g.options[0].id === 'bksv');
    expect(bksv?.options.slice(1).map((o) => o.id)).toEqual(a.childrenOf('bksv').map((c) => c.id));
  });

  it('lists every association exactly once', () => {
    const { groups } = verbandOptions(a);
    const ids = ['esv', ...groups.flatMap((g) => g.options.map((o) => o.id))];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(a.byId.size);
  });
});
