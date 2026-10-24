-- Sign-up by invitation only (#139). An approved editor invites an email address to their own node or
-- one below it, and the invitation carries that node as the new account's scope. The link holds a
-- random token; the table keeps only its SHA-256, so a leaked row can't be used to sign up.
--
-- An address has at most one open invitation. Inviting it again replaces the open one, unless that
-- one is live and was made for a node the caller may not invite to. Invitations run out after 7
-- days. Rows revoked or expired more than 30 days ago are deleted the next time an invitation is
-- created, revoked or used. Once an account exists for an address, its other invitations go.
--
-- Editors see the open invitations at or below their node, without the token hash. No client role
-- writes the table: the RPCs below do, as its owner.
--
-- The file holds the table, the invitation helpers, the editor RPCs, the lookup by token, the
-- select policy, the triggers that use up an invitation when its account is created, and the
-- sign-up hook that turns away every sign-up without one.
--
-- Safe to run twice.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------------------------
-- invited_by is set null when the inviter's account goes, so their invitations stay usable and
-- anyone who may invite there can revoke them. used_by cascades, so the used invitation goes with
-- the account it made; the triggers below delete the address's other rows when the account is
-- created. It is deferred because the row is marked used while the account is still being inserted.

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

-- Deletes the invitations revoked more than 30 days ago and the unused ones that expired more than
-- 30 days ago. A used one stays until its account is deleted. Creating, revoking and using an
-- invitation call it, so nothing needs a schedule.
create or replace function public.purge_stale_invitations()
returns void
language sql
security definer
volatile
set search_path = ''
as $$
  delete from public.invitations
   where revoked_at < now() - interval '30 days'
      or (used_at is null and expires_at < now() - interval '30 days');
$$;

revoke execute on function public.invitation_token_hash(text) from public, anon, authenticated;
revoke execute on function public.purge_stale_invitations() from public, anon, authenticated;
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

  perform public.purge_stale_invitations();

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
  perform public.purge_stale_invitations();
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

-- ---------------------------------------------------------------------------------------------
-- Consuming an invitation at sign-up
-- ---------------------------------------------------------------------------------------------
-- The sign-up hook (#139) only checks the token, because GoTrue calls it before the insert
-- transaction opens. The token is used up here, inside that transaction: consume_invitation marks
-- the invitation used while auth.users is inserted, and handle_new_user then approves the profile
-- with the invitation's node. An account made without a token, through the admin API, starts
-- pending as before.
--
-- Neither the token nor a requested node stays on the account. The node comes from the invitation,
-- so whatever the client sent as association is dropped too. GoTrue writes the sign-up metadata
-- three times in that transaction: into the auth.users row, into the auth.identities row, and,
-- after the identity is inserted, back into auth.users from memory with a few updates. Each write
-- gets its own trigger that strips both keys.

-- Who invited the account. Null for an account made without an invitation, and once the inviter's
-- account is gone.
alter table public.profiles
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

grant select on public.profiles to authenticated;

-- Before insert on auth.users. Any value under the invitation key counts as a token, an empty
-- string or a number included, so it either matches a live invitation for this address or the
-- insert fails. Of two sign-ups racing for one token, the second waits on the row lock, finds the
-- invitation used and fails.
create or replace function public.consume_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed uuid;
begin
  if not coalesce(new.raw_user_meta_data ? 'invitation', false) then
    return new;
  end if;

  update public.invitations i
     set used_at = now(), used_by = new.id
   where i.token_hash = public.invitation_token_hash(new.raw_user_meta_data->>'invitation')
     and i.used_at is null
     and i.revoked_at is null
     and i.expires_at > now()
     and i.email = lower(trim(new.email))
  returning i.id into consumed;
  if consumed is null then
    raise exception 'invalid invitation';
  end if;

  -- The address's replaced and revoked invitations would outlive the account, since only the used
  -- one goes with it.
  delete from public.invitations i
   where i.email = lower(trim(new.email))
     and i.id <> consumed;
  perform public.purge_stale_invitations();

  new.raw_user_meta_data := new.raw_user_meta_data - 'invitation' - 'association';
  return new;
end;
$$;

-- Before insert on auth.identities, which GoTrue fills with a copy of the sign-up metadata.
create or replace function public.strip_invitation_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.identity_data := new.identity_data - 'invitation' - 'association';
  return new;
end;
$$;

-- After insert on auth.users, replacing 0011's version. An account whose insert used an invitation
-- is approved with that invitation's node. Any other starts pending with the node it asked for, an
-- unknown one stored as null. Its address's unused invitations are deleted: nobody can sign up with
-- them any more, and they would outlive the account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  node text;
  inviter uuid;
begin
  select i.association_id, i.invited_by into node, inviter
    from public.invitations i
   where i.used_by = new.id;

  if found then
    insert into public.profiles (id, email, status, scope_association_id, invited_by)
    values (new.id, new.email, 'approved', node, inviter)
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, email, status, requested_association_id)
    values (
      new.id,
      new.email,
      'pending',
      (select a.id from public.associations a where a.id = new.raw_user_meta_data->>'association')
    )
    on conflict (id) do nothing;

    delete from public.invitations i
     where i.email = lower(trim(new.email))
       and i.used_at is null;
  end if;
  return new;
end;
$$;

-- Before update of the metadata on auth.users, for GoTrue's write-back after the identity insert.
-- It only acts when the token is there, so a pending account keeps the node it asked for.
create or replace function public.strip_invitation_from_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ? 'invitation', false) then
    new.raw_user_meta_data := new.raw_user_meta_data - 'invitation' - 'association';
  end if;
  return new;
end;
$$;

revoke execute on function public.consume_invitation() from public, anon, authenticated;
revoke execute on function public.strip_invitation_token() from public, anon, authenticated;
revoke execute on function public.strip_invitation_from_metadata() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists consume_invitation on auth.users;
create trigger consume_invitation
  before insert on auth.users
  for each row execute function public.consume_invitation();

drop trigger if exists strip_invitation_token on auth.identities;
create trigger strip_invitation_token
  before insert on auth.identities
  for each row execute function public.strip_invitation_token();

drop trigger if exists strip_invitation_from_metadata on auth.users;
create trigger strip_invitation_from_metadata
  before update of raw_user_meta_data on auth.users
  for each row execute function public.strip_invitation_from_metadata();

-- ---------------------------------------------------------------------------------------------
-- Sign-up hook
-- ---------------------------------------------------------------------------------------------
-- GoTrue's before-user-created hook. It runs for public sign-up, invites, generated links and
-- OAuth, but not for users made through the admin API. The sign-up passes only with a token for a
-- live invitation made for the address being signed up. Every other case gets the same 403, so the
-- answer doesn't tell a used token from a revoked or unknown one. The hook only checks: the token
-- is used up by consume_invitation inside the insert.
--
-- GoTrue calls it as supabase_auth_admin and looks the function up on each call, so the auth
-- service can start before this migration has run.

create or replace function public.before_user_created(event jsonb)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when exists (
      select 1
        from public.invitations i
       where i.token_hash = public.invitation_token_hash(event->'user'->'user_metadata'->>'invitation')
         and i.used_at is null
         and i.revoked_at is null
         and i.expires_at > now()
         and i.email = lower(trim(event->'user'->>'email'))
    ) then '{}'::jsonb
    else jsonb_build_object(
      'error',
      jsonb_build_object('http_code', 403, 'message', 'Sign-up requires a valid invitation.')
    )
  end;
$$;

revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
