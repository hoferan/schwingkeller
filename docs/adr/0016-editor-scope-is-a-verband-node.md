---
status: proposed
date: 2026-09-25
decision-makers: André Hofer
---

# An editor's scope is one node of the Verband tree

## Context and problem statement

Every signed-in account can write every venue today ([ADR 0001](0001-rls-is-the-security-boundary.md)).
The [user management](https://github.com/hoferan/schwingkeller/milestone/2) milestone adds
self-registration and needs to limit each editor to the venues they look after. An earlier draft
scoped editors to a canton with a separate super-admin role. Once venues belong to a Verband
([ADR 0015](0015-organise-venues-by-schwingerverband.md)), the scope had to follow.

## Decision drivers

* The scope has to match how the Verbände divide responsibility, not the cantons.
* Phase 1 hands out Teilverband scopes. Finer scopes later shouldn't need a schema or RLS change.
* Nobody should be able to widen their own rights.
* RLS stays the only security boundary.

## Considered options

* A `role` column and a `canton` column per profile
* A separate `super_admin` role next to a Verband scope
* One Verband tree node per profile, with super-admin meaning the ESV root
* Several scope nodes per editor

## Decision outcome

Chosen option: one node of the tree per profile.

* A venue is writable when its Verband is at or below the caller's scope node, checked by a
  recursive `verband_is_within(node, scope)`.
* Super-admin is scope `esv`. There's no role column, so there's no second concept to keep
  consistent with the scope.
* Phase 1 grants one of the 5 Teilverbände. The admin panel applies that by default and the
  database doesn't restrict it, so granting one of the 29 later is a different pick in the same
  picker.
* Status and scope change only through `security definer` RPCs that re-check the caller.
* Canton scopes were turned down because a canton doesn't match a Verband. A separate role would
  say the same thing as the root scope in a second place. Several scopes per editor were left out
  because nobody is expected to look after two Teilverbände, and a parent node already covers more
  than one Verband.

### Consequences

* Good, because a new level in the tree, such as clubs, works without touching the policies.
* Good, because checking for a super-admin is a comparison with `esv`.
* A venue without a Verband is writable only by a super-admin.
* `replace_venues` deletes everything before inserting, so it's limited to super-admins.
* Existing accounts are bootstrapped to `esv`, so production keeps working when the policies
  tighten.

### Confirmation

Integration tests in `integration/` check that a `bksv` editor can write `emmental` and not
`luzern`, can't move a venue out of scope, and that no RPC removes the last super-admin.

## More information

* Profiles and bootstrap: [#25](https://github.com/hoferan/schwingkeller/issues/25), RLS and RPCs:
  [#26](https://github.com/hoferan/schwingkeller/issues/26)
* Deletion, registration, UI and admin panel:
  [#27](https://github.com/hoferan/schwingkeller/issues/27) to
  [#31](https://github.com/hoferan/schwingkeller/issues/31), switch:
  [#73](https://github.com/hoferan/schwingkeller/issues/73)
* Revisit if Teilverband editors should approve people inside their own scope. That needs a new RPC
  rule, not a schema change.
