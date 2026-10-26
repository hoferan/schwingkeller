---
status: proposed
date: 2026-10-24
decision-makers: André Hofer
---

# Accounts by invitation only

## Context and problem statement

Anyone holding the publishable key can call GoTrue's sign-up endpoint and get a pending account
([#126](https://github.com/hoferan/schwingkeller/issues/126)). A pending account has no rights,
because every write needs an approved scope ([ADR 0016](0016-editor-scope-is-a-verband-node.md)).
It still lands in an approver's queue, can pass for an official, and once email confirmation is on,
sends a mail to whatever address the caller typed. The platform has about 50 editors, each known to
someone above them in the Verband tree. So accounts should come from invitations only, and the
database should refuse every other sign-up before the account exists
([#139](https://github.com/hoferan/schwingkeller/issues/139)).

## Decision drivers

* The refusal happens on the server, before an `auth.users` row or a mail exists. The form is only
  a convenience.
* No third-party service in the visitor's browser.
* No service-role key outside the database and no Edge Function to deploy
  ([ADR 0019](0019-account-deletion-runs-in-the-database.md)).
* An invitation is used once at most, and a sign-up that fails for another reason doesn't use it up.
* The token can't be read back after use.
* It works on the Free and Pro plans and in the Compose stack.

## Considered options

* Turnstile or hCaptcha on every public form
* Open sign-up with approval, as built in #126
* A shared code per Verband
* Invitations sent by Supabase (`inviteUserByEmail`) from an Edge Function, with sign-up off
* The hook checks the invitation, and a before-insert trigger uses it up
* The hook checks the invitation, and `handle_new_user` uses it up after the insert and then
  removes the token from the row
* The hook checks the invitation and uses it up itself

## Decision outcome

Chosen option: the hook checks the invitation, and a before-insert trigger uses it up.

* An approved editor invites an address to their own node or one below it, and the super-admin to
  any node. Inviting reaches the editor's own node, so a Kantonal- or Gauverband editor, who
  approves nobody, can still bring someone into their Verband. Approving, suspending and rescoping
  still reach only the accounts strictly below, as the milestone design decided.
* An invitation runs out after 7 days. Its token is random, and the table keeps only the token's
  SHA-256. Inviting an address again replaces its open invitation. Invitations revoked or expired
  more than 30 days ago are deleted whenever one is created, revoked or used, and once an account
  exists for an address, its other invitations are deleted too.
* The client sends the token in the sign-up metadata. The hook function,
  `public.before_user_created`, lets the sign-up through only when the token matches a live
  invitation for the same address. Every other case gets the same 403, so the answer doesn't say
  why.
* GoTrue calls the hook before it opens the insert transaction, so the hook can only check. Four
  triggers do the rest inside that transaction:
  * Before the insert on `auth.users`, `consume_invitation` uses up the invitation, or fails the
    insert when it can't, and removes the token and any node the client asked for.
  * Before the insert on `auth.identities`, which gets a copy of the sign-up metadata,
    `strip_invitation_token` removes both keys.
  * Before GoTrue's later update that writes the metadata back into `auth.users`,
    `strip_invitation_from_metadata` removes them again.
  * After the insert on `auth.users`, `handle_new_user` creates the profile as `approved`, with the
    invitation's node as its scope and the inviter in `invited_by`.

  An invitation is the approval. The queue stays for accounts made through the admin API and for
  `request_review_again`.
* Only GoTrue's admin API (`POST /admin/users`) skips the hook. The dashboard's "Create user" and
  the Compose seed use it, and those accounts start pending, as before. The dashboard's "Invite
  user" goes through `/invite`, which calls the hook, so it is refused once the hook is on.

Captchas were turned down because they put a third party in the visitor's browser, and GoTrue
supports only those two providers. Open sign-up with approval still answers bots, fills the queue
and mails any address. A shared code ends up in group chats, and a short one can be guessed without
rate limiting of our own. `inviteUserByEmail` needs the project's first Edge Function, a
service-role secret, a deploy step and email, which the project doesn't have yet, and the hook
protects just as well: a request without a token creates nothing. Using up the invitation after the
insert writes the token to the row and then rewrites it, which fires the update triggers on
`auth.users`. The hook can't use it up, because it runs outside the transaction: a sign-up that
fails after the hook, in the insert, would burn the invitation.

### Consequences

* Good, because a sign-up without a valid invitation creates no row and sends no mail, whatever the
  client does.
* Good, because it ships as one migration and the integration tests run it with the hook on.
* Bad, because the access token in the sign-up response still has the used token in
  `user_metadata`. GoTrue signs it from the user it holds in memory, where no trigger reaches. Only
  the sender gets it, the invitation is used by then, and the first refresh issues a clean token.
  The sign-up form ([#140](https://github.com/hoferan/schwingkeller/issues/140)) refreshes right
  after sign-up, so the token lives only in that one response.
* Bad, because two concurrent sign-ups with one token both pass the hook. One succeeds, and the
  other fails in the trigger with GoTrue's 500 instead of the neutral 403.
* Bad, because a sign-up for an address that already has an unconfirmed account updates that
  account instead of inserting one. The token is stripped, but the invitation stays open and the
  account stays pending. That needs email confirmation on and such an account to exist.
* Bad, because the trigger on `auth.identities` relies on `postgres` being allowed to create
  triggers on that table in hosted Supabase. If it isn't, the `migrate` job fails. `migrate` runs
  the migration on the push to `main`, so
  `select has_table_privilege('postgres', 'auth.identities', 'TRIGGER');` has to return true in
  production before this is merged.

### Confirmation

`integration/invitations.test.ts` signs up through GoTrue as an anonymous client. It covers who may
invite, revoke and see invitations, replacing and purging them, the lookup by token, each case the
hook refuses with its single message, a password too short for GoTrue leaving the invitation open,
the race between two sign-ups with one token, the approved profile with `invited_by`, the token's
absence from the stored metadata, the identity and a refreshed session, the cascade when an account
is deleted, which leaves no invitation for its address, and the pending profile of an account made
through the admin API. The unconfirmed-account case isn't tested, because the local stack confirms
every address.

## More information

* This replaces the sign-up part of [ADR 0016](0016-editor-scope-is-a-verband-node.md): applicants
  no longer choose a node.
* Sign-up form: [#140](https://github.com/hoferan/schwingkeller/issues/140), inviting and revoking
  in the admin panel: [#141](https://github.com/hoferan/schwingkeller/issues/141). Production needs
  the hook switched on in the dashboard, pointing at `public.before_user_created`
  ([#73](https://github.com/hoferan/schwingkeller/issues/73)).
* Look at this again if GoTrue starts calling the hook inside the insert transaction or for
  admin-API users, or stops copying the metadata into `auth.identities`.
