---
status: accepted
date: 2026-10-19
decision-makers: André Hofer
---

# Account deletion runs in the database

## Context and problem statement

Editors have to be able to erase their account (GDPR and the Swiss DSG), and super-admins have to be
able to delete other accounts ([#27](https://github.com/hoferan/schwingkeller/issues/27)). That means
deleting an `auth.users` row, and the client may not hold the service-role key
([ADR 0001](0001-rls-is-the-security-boundary.md)). The last approved super-admin must survive, even
when two super-admins delete each other at the same moment
([ADR 0016](0016-editor-scope-is-a-verband-node.md)).

## Decision drivers

* No service-role key in the browser, and none that CI has to carry.
* The last-super-admin check and the deletion run in one transaction, so a race can't remove both.
* The project has no Edge Functions, and the Compose stack has no functions runtime to test one.

## Considered options

* An Edge Function holding the service-role key
* An RPC for the checks plus an Edge Function for the deletion
* One `security definer` function that checks and deletes

## Decision outcome

Chosen option: one `security definer` function, `public.delete_account(target_id uuid default null)`.
It locks the approved ESV profile rows first, as `set_editor_scope` and `suspend_editor` do
([#26](https://github.com/hoferan/schwingkeller/issues/26)), so a racing call waits and re-checks.

Both Edge Function options were turned down. Deploying one needs a Supabase account token, which CI
deliberately doesn't hold, and the check can't share a transaction with the admin API call, so two
super-admins deleting each other could both succeed.

### Consequences

* Good, because no service-role key exists anywhere, so the environment variable that #27 asked for
  isn't needed.
* Good, because the function ships through the existing `migrate` job and runs in the integration
  tests.
* Bad, because it relies on `postgres` keeping `DELETE` on `auth.users` in hosted Supabase. That held
  in production on 2026-10-19. If Supabase restricts it, deletion fails at call time, not when the
  migration runs.
* Bad, because a deleted editor's photo files stay in the `venue-photos` bucket, owned by nobody.
  Only super-admins can remove them
  ([#26](https://github.com/hoferan/schwingkeller/issues/26)). Until its token expires (one hour by
  default), a deleted editor can still replace or delete those files, because PostgREST and Storage
  don't check that the user exists and the 0012 bucket rule tests `owner_id = auth.uid()`. Every other
  call is refused, since the profile is gone.

### Confirmation

`integration/delete-account.test.ts` covers every rule except the race between two super-admins. That
race was checked by hand in two psql sessions, because locally it always involves the shared admin
and losing it would delete that account.

## More information

* [#30](https://github.com/hoferan/schwingkeller/issues/30) and
  [#31](https://github.com/hoferan/schwingkeller/issues/31) map the function's errors to messages.
* Look at this again if Supabase removes `DELETE` on `auth.users` from `postgres`, or if the project
  starts running Edge Functions for other reasons.
