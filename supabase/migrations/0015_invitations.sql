-- Sign-up by invitation only (#139). An approved editor invites an email address to their own node or
-- one below it, and the invitation carries that node as the new account's scope. The link holds a
-- random token; the table keeps only its SHA-256, so a leaked row can't be used to sign up.
--
-- An address has at most one open invitation. Inviting it again replaces the open one, unless that
-- one is live and was made for a node the caller may not invite to. Invitations run out after 7
-- days. Rows revoked or expired more than 30 days ago are deleted the next time anyone invites.
--
-- Editors see the open invitations at or below their node, without the token hash. No client role
-- writes the table: the RPCs below do, as its owner.
--
-- The file holds the table, the invitation helpers, the editor RPCs, the lookup by token and the
-- select policy.
--
-- Safe to run twice.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------------------------
-- invited_by is set null when the inviter's account goes, so their invitations stay usable and
-- anyone who may invite there can revoke them. used_by cascades, so no address outlives the account
-- it made. It is deferred because the row is marked used while the account is still being inserted.

create table if not exists public.invitations (
  id             uuid primary key default gen_random_uuid(),
  token_hash     bytea not null unique,
  email          text not null,
  association_id text not null references public.associations(id),
  invited_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '7 days',
  used_at        timestamptz,
  used_by        uuid references auth.users(id) on delete cascade deferrable initially deferred,
  revoked_at     timestamptz
);

-- One open invitation per address. Two concurrent invitations for the same address can't both
-- land: the second insert fails on this index.
create unique index if not exists invitations_one_open_per_email
  on public.invitations (email)
  where used_at is null and revoked_at is null;

alter table public.invitations enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- The stored form of a token. Only the functions in this file call it.
create or replace function public.invitation_token_hash(token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(token, 'UTF8'));
$$;

-- May the caller invite to node? Super-admins any node; any other approved editor their own node or
-- one below it.
create or replace function public.can_invite(node text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when node is null then false
    else public.is_super_admin()
         or (public.current_scope() is not null
             and public.association_is_within(node, public.current_scope()))
  end;
$$;

revoke execute on function public.invitation_token_hash(text) from public, anon, authenticated;
revoke execute on function public.can_invite(text) from public, anon;
grant execute on function public.can_invite(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Editor RPCs
-- ---------------------------------------------------------------------------------------------

-- Invites target_email to scope and returns the token. The token is shown this once; only its hash
-- is kept.
--
-- An existing account's address is refused. That tells the caller the account exists, but only an
-- approved editor gets this far.
--
-- The open invitation for the address, if any, is locked and revoked when it has expired or the
-- caller may invite to its node. A live one made higher up is left alone and the call is refused,
-- so a cantonal editor can't void an invitation the ESV sent.
create or replace function public.create_invitation(target_email text, scope text)
returns text
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  normalised text := lower(trim(target_email));
  open_id uuid;
  open_node text;
  open_expires timestamptz;
  new_token text;
begin
  if normalised is null or normalised !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;
  if not public.can_invite(scope) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.associations a where a.id = scope) then
    raise exception 'unknown association: %', scope;
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = normalised) then
    raise exception 'email already has an account';
  end if;

  select i.id, i.association_id, i.expires_at into open_id, open_node, open_expires
    from public.invitations i
   where i.email = normalised and i.used_at is null and i.revoked_at is null
     for update;
  if found then
    if open_expires > now() and not public.can_invite(open_node) then
      raise exception 'an invitation for this email is open at a higher level';
    end if;
    update public.invitations set revoked_at = now() where id = open_id;
  end if;

  delete from public.invitations
   where revoked_at < now() - interval '30 days'
      or (used_at is null and expires_at < now() - interval '30 days');

  new_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.invitations (token_hash, email, association_id, invited_by)
  values (public.invitation_token_hash(new_token), normalised, scope, (select auth.uid()));
  return new_token;
end;
$$;

-- A missing invitation and one the caller may not revoke get the same refusal, so ids can't be
-- probed. An expired one may still be revoked.
create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  node text;
  used timestamptz;
  revoked timestamptz;
begin
  select i.association_id, i.used_at, i.revoked_at into node, used, revoked
    from public.invitations i where i.id = invitation_id for update;
  if not found or not public.can_invite(node) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if used is not null then
    raise exception 'cannot revoke an invitation that is used';
  end if;
  if revoked is not null then
    raise exception 'cannot revoke an invitation that is revoked';
  end if;
  update public.invitations set revoked_at = now() where id = invitation_id;
end;
$$;

revoke execute on function public.create_invitation(text, text) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.create_invitation(text, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Lookup by token
-- ---------------------------------------------------------------------------------------------
-- The sign-up page reads the invitation behind a link before anyone types a password: the address
-- to fill in and the node to name. One row for a live invitation, none for anything else (no
-- token, an unknown, used, revoked or expired one), so the page can't tell those apart. The
-- inviter isn't returned, so the link doesn't give out an editor's address. Reading never changes
-- the row.
--
-- Anyone with the link sees the invited address. A token is 32 random bytes, found through the
-- unique index on its hash, so guessing one isn't practical.

create or replace function public.invitation_details(token text)
returns table (email text, association_id text, expires_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select i.email, i.association_id, i.expires_at
    from public.invitations i
   where i.token_hash = public.invitation_token_hash(invitation_details.token)
     and i.used_at is null
     and i.revoked_at is null
     and i.expires_at > now();
$$;

revoke execute on function public.invitation_details(text) from public;
grant execute on function public.invitation_details(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Select policy
-- ---------------------------------------------------------------------------------------------
-- Open invitations at or below the caller's node, expired ones included, so an editor sees which
-- ones ran out. Editors get every column but the token hash.

drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select to authenticated
  using (public.can_invite(association_id) and used_at is null and revoked_at is null);

revoke all on public.invitations from anon, authenticated;
grant select (id, email, association_id, invited_by, created_at, expires_at, used_at, revoked_at)
  on public.invitations to authenticated;
