---
status: accepted
date: 2026-06-18
decision-makers: André Hofer
---

# Row Level Security is the only security boundary

## Context and problem statement

The app is a static single-page app in a public repository. It has no server of its own, and the
browser talks to Supabase directly. Anything in the bundle is readable by anyone, so the client
can't be trusted to decide who may write.

## Considered options

* Supabase Row Level Security as the only gate, with the publishable key in the browser
* A roles or allowlist table checked by the policies
* The legacy `anon` and `service_role` keys

## Decision outcome

Chosen option: RLS is the only security boundary.

* `venues`, `venue_photos` and the `venue-photos` storage bucket are readable by everyone and
  writable by any authenticated user.
* Public sign-up is turned off in the hosted project and admins are invited, so being signed in
  means being an admin. The client mirrors that with `isAdmin: !!session`, which only decides what
  to show.
* The browser uses the publishable key (`sb_publishable_…`). The secret key never ships. The legacy
  `anon` and `service_role` keys aren't used.
* A roles table was left out because v1 had no need for different kinds of admin.

### Consequences

* Good, because there's one place to audit, and a client bug can't open up writes.
* Bad, because every admin can change or delete every venue.
* Bad, because the grants are part of the model too. Local default privileges hid a missing grant on
  `venue_photos` that production lacked, which is why `0006_grant_venue_photos.sql` exists. A new
  table needs explicit grants as well as policies.
* Sign-up is only off in the hosted dashboard. The local `supabase/config.toml` still allows it.

## More information

* Policies: `supabase/migrations/0001_init.sql`, `0004_venue_photos.sql`, `0006_grant_venue_photos.sql`
* Client check: `src/features/auth/AuthProvider.tsx`
* The milestone [Verband-scoped user management](https://github.com/hoferan/schwingkeller/milestone/2)
  will replace "signed in means admin" with editors scoped to part of the Verband tree. RLS stays the
  boundary.
