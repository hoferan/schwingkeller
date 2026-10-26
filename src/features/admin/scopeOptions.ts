import type { Associations } from '../associations/useAssociations';
import { isWithin } from '../auth/scope';
import type { Account } from './accounts';

// One choice in the scope picker, with how many approved editors already have that node (`direct`)
// and how many sit in the nodes below it (`below`, null for a Verband, which has none).
export interface ScopeOption {
  id: string;
  name: string;
  direct: number;
  below: number | null;
}

export interface ScopeOptions {
  // The ESV, offered to super-admins only.
  top: ScopeOption | null;
  groups: { label: string; options: ScopeOption[] }[];
}

// The scopes the caller may grant: everything for a super-admin, the nodes strictly below their
// own for anyone else. Mirrors public.can_grant_scope; only the database enforces it.
export const grantableScopes = (
  a: Associations,
  callerScope: string,
  approvedScopes: readonly string[],
): ScopeOptions => {
  const option = (id: string): ScopeOption => ({
    id,
    name: a.nameOf(id),
    direct: approvedScopes.filter((s) => s === id).length,
    below:
      a.childrenOf(id).length === 0
        ? null
        : approvedScopes.filter((s) => s !== id && isWithin(a, s, id)).length,
  });
  const caller = a.byId.get(callerScope);
  if (!caller) return { top: null, groups: [] };
  if (caller.level === 'federation') {
    return {
      top: option(caller.id),
      groups: a.childrenOf(caller.id).map((r) => ({
        label: a.nameOf(r.id),
        options: [option(r.id), ...a.childrenOf(r.id).map((c) => option(c.id))],
      })),
    };
  }
  const below = a.childrenOf(caller.id);
  if (below.length === 0) return { top: null, groups: [] };
  return { top: null, groups: [{ label: a.nameOf(caller.id), options: below.map((c) => option(c.id)) }] };
};

export const optionIds = (o: ScopeOptions): string[] => [
  ...(o.top ? [o.top.id] : []),
  ...o.groups.flatMap((g) => g.options.map((x) => x.id)),
];

export interface InviteOptions {
  own: string | null;
  groups: { label: string; ids: string[] }[];
}

// The nodes the caller may invite an editor to. Differs from grantableScopes by including the
// caller's own node. Mirrors public.can_invite; only the database enforces it.
export const invitableScopes = (a: Associations, callerScope: string): InviteOptions => {
  const caller = a.byId.get(callerScope);
  if (!caller) return { own: null, groups: [] };
  // Keys on level 'federation', which only the ESV has. That matches is_super_admin() in can_invite
  // (migration 0015).
  if (caller.level === 'federation') {
    return {
      own: caller.id,
      groups: a.childrenOf(caller.id).map((r) => ({
        label: a.nameOf(r.id),
        ids: [r.id, ...a.childrenOf(r.id).map((c) => c.id)],
      })),
    };
  }
  const below = a.childrenOf(caller.id);
  if (below.length === 0) return { own: caller.id, groups: [] };
  return { own: caller.id, groups: [{ label: a.nameOf(caller.id), ids: below.map((c) => c.id) }] };
};

export const inviteOptionIds = (o: InviteOptions): string[] => [
  ...(o.own ? [o.own] : []),
  ...o.groups.flatMap((g) => g.ids),
];

// One Teilverband on the scope board: its own node, which a Teilverband editor sees as a heading
// when approving but may pick when inviting, and the Verbände below it.
export interface ScopeBlock {
  regional: string;
  regionalPickable: boolean;
  children: string[];
}

// What the scope picker shows. `top` is a node above the blocks: the ESV for a super-admin, or a
// Verband editor's own node when inviting.
export interface ScopeBoard {
  top: string | null;
  blocks: ScopeBlock[];
}

const EMPTY: ScopeBoard = { top: null, blocks: [] };

const block = (a: Associations, regional: string, regionalPickable: boolean): ScopeBlock => ({
  regional,
  regionalPickable,
  children: a.childrenOf(regional).map((c) => c.id),
});

// The scopes the caller may grant: everything for a super-admin, the nodes strictly below their
// own for anyone else. Mirrors public.can_grant_scope; only the database enforces it.
export const grantableBoard = (a: Associations, callerScope: string): ScopeBoard => {
  const caller = a.byId.get(callerScope);
  if (!caller) return EMPTY;
  if (caller.level === 'federation') {
    return { top: caller.id, blocks: a.childrenOf(caller.id).map((r) => block(a, r.id, true)) };
  }
  if (caller.level === 'regional') return { top: null, blocks: [block(a, caller.id, false)] };
  return EMPTY;
};

// The nodes the caller may invite an editor to: what they may grant plus their own node. Mirrors
// public.can_invite; only the database enforces it.
export const invitableBoard = (a: Associations, callerScope: string): ScopeBoard => {
  const caller = a.byId.get(callerScope);
  if (!caller) return EMPTY;
  if (caller.level === 'regional') return { top: null, blocks: [block(a, caller.id, true)] };
  if (caller.level === 'cantonal') return { top: caller.id, blocks: [] };
  return grantableBoard(a, callerScope);
};

export const boardIds = (b: ScopeBoard): string[] => [
  ...(b.top ? [b.top] : []),
  ...b.blocks.flatMap((x) => [...(x.regionalPickable ? [x.regional] : []), ...x.children]),
];

// How many approved editors have a node (`direct`) and how many sit in the nodes below it
// (`below`, null for a Verband, which has none).
export interface ScopeCount {
  direct: number;
  below: number | null;
}

export const scopeCounts =
  (a: Associations, approvedScopes: readonly string[]) =>
  (id: string): ScopeCount => ({
    direct: approvedScopes.filter((s) => s === id).length,
    below:
      a.childrenOf(id).length === 0 ? null : approvedScopes.filter((s) => s !== id && isWithin(a, s, id)).length,
  });

// An account back in the queue through request_review_again keeps its old scope, which is a better
// guess than the Verband it chose at sign-up. Nothing is preselected that the caller may not grant.
export const defaultScopeFor = (
  account: Pick<Account, 'scope_association_id' | 'requested_association_id'>,
  board: ScopeBoard,
): string | null => {
  const guess = account.scope_association_id ?? account.requested_association_id;
  return guess !== null && boardIds(board).includes(guess) ? guess : null;
};
