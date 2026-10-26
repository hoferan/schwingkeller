import { describe, it, expect } from 'vitest';
import { associationsFor } from '../associations/useAssociations';
import {
  boardIds,
  defaultScopeFor,
  grantableBoard,
  invitableBoard,
  scopeCounts,
} from './scopeOptions';

const a = associationsFor('de');
const BERNESE_GAUE = ['berner-jura', 'emmental', 'mittelland', 'oberaargau', 'oberland', 'seeland'];

describe('grantableBoard', () => {
  it('offers a super-admin the ESV on top and one block per Teilverband', () => {
    const b = grantableBoard(a, 'esv');
    expect(b.top).toBe('esv');
    expect(b.blocks.map((x) => x.regional)).toEqual(a.childrenOf('esv').map((r) => r.id));
    expect(b.blocks.every((x) => x.regionalPickable)).toBe(true);
    expect(b.blocks[0].children).toEqual(BERNESE_GAUE);
  });

  it('offers a super-admin every association once', () => {
    const ids = boardIds(grantableBoard(a, 'esv'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(a.byId.size);
  });

  it('shows a Teilverband editor its own node as a heading over the Verbände below it', () => {
    const b = grantableBoard(a, 'bksv');
    expect(b).toEqual({ top: null, blocks: [{ regional: 'bksv', regionalPickable: false, children: BERNESE_GAUE }] });
    expect(boardIds(b)).toEqual(BERNESE_GAUE);
  });

  it('offers a Verband editor or an unknown scope nothing', () => {
    expect(grantableBoard(a, 'emmental')).toEqual({ top: null, blocks: [] });
    expect(grantableBoard(a, 'nope')).toEqual({ top: null, blocks: [] });
  });
});

describe('invitableBoard', () => {
  it('offers a super-admin the same nodes as approving', () => {
    expect(boardIds(invitableBoard(a, 'esv'))).toEqual(boardIds(grantableBoard(a, 'esv')));
  });

  it('lets a Teilverband editor invite to its own node too', () => {
    const b = invitableBoard(a, 'bksv');
    expect(b.blocks).toHaveLength(1);
    expect(b.blocks[0].regionalPickable).toBe(true);
    expect(boardIds(b)).toEqual(['bksv', ...BERNESE_GAUE]);
  });

  it('offers a Verband editor only its own node', () => {
    expect(invitableBoard(a, 'emmental')).toEqual({ top: 'emmental', blocks: [] });
  });

  it('offers an unknown scope nothing', () => {
    expect(boardIds(invitableBoard(a, 'nope'))).toEqual([]);
  });
});

describe('scopeCounts', () => {
  const count = scopeCounts(a, ['esv', 'bksv', 'emmental', 'emmental', 'luzern']);

  it('counts the editors on a node and those below it', () => {
    expect(count('esv')).toEqual({ direct: 1, below: 4 });
    expect(count('bksv')).toEqual({ direct: 1, below: 2 });
    expect(count('isv')).toEqual({ direct: 0, below: 1 });
  });

  it('has nothing below a Verband', () => {
    expect(count('emmental')).toEqual({ direct: 2, below: null });
  });
});

describe('defaultScopeFor', () => {
  const bksv = grantableBoard(a, 'bksv');

  it('preselects the Verband a new applicant asked for', () => {
    expect(defaultScopeFor({ scope_association_id: null, requested_association_id: 'emmental' }, bksv)).toBe('emmental');
  });

  // An account back for review keeps its old scope, and its sign-up choice may be months old.
  it('preselects the old scope of an account back for review', () => {
    expect(defaultScopeFor({ scope_association_id: 'mittelland', requested_association_id: 'emmental' }, bksv)).toBe(
      'mittelland',
    );
  });

  it('preselects nothing when the applicant named no Verband', () => {
    expect(defaultScopeFor({ scope_association_id: null, requested_association_id: null }, bksv)).toBeNull();
  });

  it('preselects nothing the caller may not grant', () => {
    expect(defaultScopeFor({ scope_association_id: null, requested_association_id: 'luzern' }, bksv)).toBeNull();
  });
});
