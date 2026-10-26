import { describe, it, expect } from 'vitest';
import { associationsFor } from '../associations/useAssociations';
import { defaultScopeFor, grantableScopes, inviteOptionIds, invitableScopes, optionIds } from './scopeOptions';

const a = associationsFor('de');
const BERNESE_GAUE = ['berner-jura', 'emmental', 'mittelland', 'oberaargau', 'oberland', 'seeland'];

describe('grantableScopes', () => {
  it('offers a super-admin the ESV on top and one group per Teilverband', () => {
    const o = grantableScopes(a, 'esv', []);
    expect(o.top?.id).toBe('esv');
    expect(o.groups.map((g) => g.options[0].id)).toEqual(a.childrenOf('esv').map((r) => r.id));
    expect(o.groups[0].options.slice(1).map((x) => x.id)).toEqual(a.childrenOf('bksv').map((c) => c.id));
  });

  it('offers a super-admin every association once', () => {
    const ids = optionIds(grantableScopes(a, 'esv', []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(a.byId.size);
  });

  it('offers a Teilverband editor only the Verbände below it', () => {
    const o = grantableScopes(a, 'bksv', []);
    expect(o.top).toBeNull();
    expect(o.groups).toHaveLength(1);
    expect(o.groups[0].label).toBe(a.nameOf('bksv'));
    expect(optionIds(o)).toEqual(BERNESE_GAUE);
  });

  it('offers a Verband editor nothing', () => {
    const o = grantableScopes(a, 'emmental', []);
    expect(o.top).toBeNull();
    expect(o.groups).toEqual([]);
  });

  it('counts the editors on each node and below it', () => {
    const o = grantableScopes(a, 'esv', ['esv', 'bksv', 'emmental', 'emmental', 'luzern']);
    const all = [o.top, ...o.groups.flatMap((g) => g.options)];
    const byId = (id: string) => all.find((x) => x?.id === id);
    expect(byId('esv')).toMatchObject({ direct: 1, below: 4 });
    expect(byId('bksv')).toMatchObject({ direct: 1, below: 2 });
    expect(byId('emmental')).toMatchObject({ direct: 2, below: null });
    expect(byId('isv')).toMatchObject({ direct: 0, below: 1 });
  });
});

describe('invitableScopes', () => {
  it('offers a super-admin every node once, the ESV first', () => {
    const o = invitableScopes(a, 'esv');
    const ids = inviteOptionIds(o);
    expect(o.own).toBe('esv');
    expect(ids[0]).toBe('esv');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(a.byId.size);
    expect(o.groups.map((g) => g.ids[0])).toEqual(a.childrenOf('esv').map((r) => r.id));
  });

  it('offers a Teilverband editor its own node and the Verbände below it', () => {
    const o = invitableScopes(a, 'bksv');
    expect(o.own).toBe('bksv');
    expect(o.groups).toHaveLength(1);
    expect(o.groups[0].label).toBe(a.nameOf('bksv'));
    expect(inviteOptionIds(o)).toEqual(['bksv', ...BERNESE_GAUE]);
  });

  it('offers a Verband editor only its own node', () => {
    const o = invitableScopes(a, 'emmental');
    expect(o.own).toBe('emmental');
    expect(o.groups).toEqual([]);
    expect(inviteOptionIds(o)).toEqual(['emmental']);
  });

  it('offers an unknown scope nothing', () => {
    const o = invitableScopes(a, 'nope');
    expect(o.own).toBeNull();
    expect(inviteOptionIds(o)).toEqual([]);
  });
});

describe('defaultScopeFor', () => {
  const bksv = grantableScopes(a, 'bksv', []);

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
