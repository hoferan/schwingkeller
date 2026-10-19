---
status: accepted
date: 2026-10-19
decision-makers: André Hofer
---

# Account deletion runs in the database

## Context and problem statement

Editors have to be able to erase their account (GDPR and the Swiss DSG), and super-admins have to be
able to delete other accounts ([#27](https://github.com/hoferan/schwingkeller/issues/27)). Removing an
account means deleting its `auth.users` row, and the client may not hold the service-role key
([ADR 0001](0001-rls-is-the-security-boundary.md)). The last approved super-admin must survive, even
when two super-admins delete each other at the same moment
([ADR 0016](0016-editor-scope-is-a-verband-node.md)).

## Decision drivers

* No service-role key in the browser, and none that CI has to carry.
* The last-super-admin check and the deletion must run in one transaction, so a race can't remove
  both super-admins.
* The project has no Edge Functions today. The Compose stack has no functions runtime, so a function
  couldn't be tested locally.
* RLS and database functions stay the security boundary.

## Considered options

* An Edge Function holding the service-role key, which checks the caller and calls the admin API
* An RPC for the checks plus an Edge Function for the deletion
* One `security definer` function that checks and deletes

## Decision outcome

Chosen option: one `security definer` function, `public.delete_account(target_id uuid default null)`.

* It locks the approved ESV profile rows first, as `set_editor_scope` and `suspend_editor` do
  ([#26](https://github.com/hoferan/schwingkeller/issues/26)). A racing call waits, then re-checks
  against the committed state. A caller who was deleted in the meantime gets `not authorized`.
* Any signed-in account may delete itself, and a super-admin may delete another account. A caller
  without that right gets `not authorized` for any other id, whether the account exists or not, so
  ids can't be probed. Deleting the last super-admin fails with `cannot delete the last super-admin`.
* The `auth.users` row goes, and the foreign keys cascade to identities, sessions and the profile.
* The Edge Function was turned down because the function would need a Supabase account token to
  deploy, which CI deliberately doesn't hold. The check and the admin API call also can't share a
  transaction, so two super-admins deleting each other could both succeed.
* Splitting the checks into an RPC and the deletion into an Edge Function has the same costs and the
  same race.

### Consequences

* Good, because no service-role key exists anywhere, so the environment variable that #27 asked for
  isn't needed.
* Good, because the function ships through the existing `migrate` job and the integration tests run
  it against the Compose stack.
* Bad, because it depends on `postgres` keeping `DELETE` on `auth.users` in hosted Supabase. That
  held in production on 2026-10-19. If Supabase restricts it, deleting an account fails at call time,
  not when the migration runs.
* Bad, because a deleted editor's photo files stay in the `venue-photos` bucket. `storage.objects`
  has no foreign key to `auth.users`, so nothing cascades. With the uploader gone, only super-admins
  can change or delete those files ([#26](https://github.com/hoferan/schwingkeller/issues/26)).

### Confirmation

`integration/delete-account.test.ts` covers self-deletion, a pending account deleting itself, the
refusals for other accounts and unknown ids, the last-super-admin rule, and anonymous callers. The
race between two super-admins isn't automated: locally it always involves the shared admin, and
losing it would delete that account. It was checked by hand in two psql sessions. The second call
waited on the lock and was then refused because its caller was gone.

## More information

* The confirmation dialogs, re-authentication and the admin-panel button are
  [#30](https://github.com/hoferan/schwingkeller/issues/30) and
  [#31](https://github.com/hoferan/schwingkeller/issues/31). They map the error codes `42501`,
  `P0002` and `P0001` to messages.
* Look at this again if Supabase removes `DELETE` on `auth.users` from `postgres`, or if the project
  starts running Edge Functions for other reasons.
