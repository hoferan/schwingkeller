---
status: proposed
date: 2026-10-19
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
* Editors work at three levels from the start: the ESV, a Teilverband, or a Kantonal- or
  Gauverband. A new level later, such as clubs, shouldn't need a schema or RLS change.
* The app should manage its own accounts. Apart from the first ESV account, editors approve each
  other.
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
  recursive `association_is_within(node, scope)`.
* Super-admin is scope `esv`. There's no role column, so there's no second concept to keep
  consistent with the scope.
* An admin grants any node. Applicants may request any node at sign-up, the ESV included; the
  approver decides.
* Account approval follows the same tree. An editor manages the accounts strictly below their node,
  so a Teilverband editor approves the Verband editors in it and only the ESV approves Teilverband
  and ESV editors. A Kantonal- or Gauverband editor approves nobody.
* Inside their scope, editors at every level have the same rights over venues.
* Status and scope change only through `security definer` RPCs that re-check the caller.
* Nobody manages their own account, super-admins included. Rejecting answers an application and
  works on `pending` only; an approved editor is suspended instead. Transitions keep the scope, and
  only approving and setting the scope write it, so a suspended editor stays with their approver.
  `set_editor_scope` and `suspend_editor` lock the approved ESV profiles, so two super-admins who
  suspend each other at the same moment can't leave none.
* Photo rows carry the Verband scope of their venue. In the `venue-photos` bucket any approved
  editor may upload, and only the uploader or a super-admin may change or delete a file. Uploads
  happen before the venue is saved, so a file has no Verband yet.
* Canton scopes were turned down because a canton doesn't match a Verband. A separate role would
  say the same thing as the root scope in a second place. Several scopes per editor were left out
  because nobody is expected to look after two Teilverbände, and a parent node already covers more
  than one Verband.
* For the bucket, a path per Verband was turned down because the form would need the Verband before
  the upload, and a path per venue because the venue may not exist yet. Checking the status alone
  would let any approved editor overwrite another Verband's files through the API.

### Consequences

* Good, because a new level in the tree, such as clubs, works without touching the policies.
* Good, because checking for a super-admin is a comparison with `esv`.
* The database requires a Verband on every venue (migration 0010), so each venue is in the scope
  of its Verband's editors.
* No function replaces every venue at once any more
  ([ADR 0018](0018-remove-the-import-and-replace-venues.md)), so the scoped policies need no
  exception for one.
* Existing accounts are bootstrapped to `esv`, so production keeps working when the policies
  tighten.

### Confirmation

Integration tests in `integration/` sign in as one local account per level. `editor-rpcs.test.ts`
covers the RPCs: a `bksv` editor can approve an Emmental applicant but can't grant `bksv`, nobody
manages their own account, and no RPC removes the last super-admin. The scope describes in
`venues.test.ts` and `venue-photos.test.ts` check that a `bksv` editor can write `emmental` and not
`luzern`, that an `emmental` editor can't write `oberland` in the same Teilverband, and that nobody
can move a venue out of scope. `profiles.test.ts` checks that a `bksv` editor sees the profiles
below BKSV. `storage.test.ts` checks that only the uploader or a super-admin can change or delete a
file in `venue-photos`. Migration 0012 stops when a write policy that no migration defines sits on
`venues`, `venue_photos` or `storage.objects`, because Postgres would OR it with the scoped ones.

## More information

* Profiles and bootstrap: [#25](https://github.com/hoferan/schwingkeller/issues/25), RLS and RPCs:
  [#26](https://github.com/hoferan/schwingkeller/issues/26)
* Deletion, registration, UI and admin panel:
  [#27](https://github.com/hoferan/schwingkeller/issues/27) to
  [#31](https://github.com/hoferan/schwingkeller/issues/31), switch:
  [#73](https://github.com/hoferan/schwingkeller/issues/73)
* Nothing calls the RPCs before the admin panel, so the Vitest coverage of the RPC calls moves to
  [#30](https://github.com/hoferan/schwingkeller/issues/30).
