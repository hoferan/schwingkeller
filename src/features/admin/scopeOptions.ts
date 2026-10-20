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

// An account back in the queue through request_review_again keeps its old scope, which is a better
// guess than the Verband it chose at sign-up. Nothing is preselected that the caller may not grant.
export const defaultScopeFor = (
  account: Pick<Account, 'scope_association_id' | 'requested_association_id'>,
  o: ScopeOptions,
): string | null => {
  const guess = account.scope_association_id ?? account.requested_association_id;
  return guess !== null && optionIds(o).includes(guess) ? guess : null;
};
