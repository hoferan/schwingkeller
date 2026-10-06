---
status: accepted
date: 2026-10-06
decision-makers: André Hofer
---

# Remove the import and drop `replace_venues`

## Context and problem statement

The sidebar had a JSON and CSV import that replaced every venue at once through
`public.replace_venues(rows jsonb)` ([ADR 0002](0002-replace-venues-in-one-rpc.md)), and an export
to go with it. Both were a development aid and nobody used them. Once venues gained a Verband
([ADR 0015](0015-organise-venues-by-schwingerverband.md)), keeping them meant teaching them the
association column. The user management milestone also scopes editors to a node of the Verband tree
([ADR 0016](0016-editor-scope-is-a-verband-node.md)), and a function that deletes every venue
doesn't fit a scoped editor.

## Considered options

* Keep the import, add the association column, and restrict `replace_venues` to super-admins
* Remove the import from the app and keep `replace_venues` for later
* Remove the import and drop `replace_venues`

## Decision outcome

Chosen option: remove the import and the export from the app
([#66](https://github.com/hoferan/schwingkeller/issues/66)), then drop `replace_venues`
([#97](https://github.com/hoferan/schwingkeller/issues/97)).

* Restricting the function to super-admins, as
  [#26](https://github.com/hoferan/schwingkeller/issues/26) had planned, would have kept a
  function that can empty the table, with no caller, behind a check that has to stay correct.
* Keeping it unused was turned down for the same reason. Every signed-in user could still call it.
* Migration `0009_drop_replace_venues.sql` drops it with `drop function if exists`. The older
  migrations that created it stay as they are.

### Consequences

* Good, because [#26](https://github.com/hoferan/schwingkeller/issues/26) can scope the venue
  policies without an exception for a function that deletes every venue.
* Good, because the riskiest control in the sidebar is gone.
* Bad, because loading many venues at once now takes SQL against the database. Nobody does that
  today.

### Confirmation

An integration test in `integration/venues.test.ts` calls `replace_venues` as the admin and expects
PostgREST to report that the function doesn't exist.

## More information

* Bring an import back when a Verband or the ESV asks to load or update many venues from a file.
  It would need the association column, and it would have to respect the caller's scope: an editor
  may only add or change venues inside their node, and replacing every venue would be a super-admin
  action, if it's still needed at all. That would need its own record.
* Removal from the app: [#98](https://github.com/hoferan/schwingkeller/pull/98)
