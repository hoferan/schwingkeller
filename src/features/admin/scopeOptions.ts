import type { Associations } from '../associations/useAssociations';
import { isWithin } from '../auth/scope';
import type { Account } from './accounts';

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
// (`below`, null for a Verband, which has none). `direct` is null where the caller can't count it.
export interface ScopeCount {
  direct: number | null;
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
