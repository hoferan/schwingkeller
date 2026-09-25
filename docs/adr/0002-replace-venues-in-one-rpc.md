---
status: accepted
date: 2026-06-20
decision-makers: André Hofer
---

# Replace all venues atomically in one `security invoker` function

## Context and problem statement

A JSON import replaces the whole venue list. Done from the client as a delete followed by inserts, a
failure halfway through leaves the table empty or half filled. The replacement has to succeed or fail
as a whole.

## Considered options

* Delete and insert from the client in separate requests
* `truncate` inside a database function
* `delete` and `insert` inside one database function

## Decision outcome

Chosen option: `public.replace_venues(rows jsonb)`, one function that deletes and inserts, so both
run in one transaction.

* It is `security invoker`, so RLS still applies to the caller.
* It generates the new venue ids up front with `gen_random_uuid()` and inserts the photo galleries
  with those ids in the same call. The first design matched ids through `insert … returning` order,
  but Postgres doesn't guarantee that order.
* `truncate` was ruled out because it would have meant granting `truncate` to `authenticated`.

### Consequences

* Good, because an import either replaces everything or changes nothing.
* Bad, because the delete has to be written `delete from public.venues where true`. Supabase runs
  `pg_safeupdate`, which rejects a `delete` without a `where` clause (error 21000). Removing the
  `where true` breaks import.

## More information

* `supabase/migrations/0003_fix_replace_venues_no_where.sql`, `0005_replace_venues_photos.sql`
* Caller: `src/features/venues/useVenues.ts`
