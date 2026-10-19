-- Scopes every editor to one node of the Verband tree (ADR 0016, #26). Until now any signed-in
-- account wrote everything. From here on the database decides, by the caller's profile: an approved
-- account may write what sits at or below its scope node, and nobody else may write at all.
--
-- The policies read `profiles` live, not the JWT, so suspending an account takes effect at once.
--
-- Editors manage the accounts below their node in the same way. They see those profiles, and the
-- RPCs at the end of the file are the only way to approve, reject, suspend, reactivate or rescope
-- an account. Nobody manages their own account, and the last approved super-admin can't be
-- suspended or moved off the root.
--
-- The file holds the scope helpers, the venue and photo-row policies, the policies on the
-- venue-photos bucket, the managed-profiles policy and the editor RPCs.
--
-- Safe to run twice.

-- ---------------------------------------------------------------------------------------------
-- Scope helpers
-- ---------------------------------------------------------------------------------------------
-- They run as their owner because no signed-in role may read profiles beyond its own row, and a
-- policy needs the caller's scope without recursing into the profiles policy.

-- The caller's scope node, or null unless the account is approved.
create or replace function public.current_scope()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select p.scope_association_id
    from public.profiles p
   where p.id = (select auth.uid())
     and p.status = 'approved';
$$;

-- The super-admin is whoever holds the root node.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(public.current_scope() = 'esv', false);
$$;

-- May the caller write a row that belongs to association v? A row with no association is for
-- super-admins only.
create or replace function public.can_write_association(v text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when v is null then public.is_super_admin()
    else public.current_scope() is not null
         and public.association_is_within(v, public.current_scope())
  end;
$$;

-- May the caller hand out scope s? Super-admins any node; everyone else only nodes strictly below
-- their own.
create or replace function public.can_grant_scope(s text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when s is null then false
    else public.is_super_admin()
         or (public.current_scope() is not null
             and public.association_is_within(s, public.current_scope())
             and s <> public.current_scope())
  end;
$$;

-- May the caller change the status or scope of account target? Never their own. The node that
-- counts is the granted scope, or for an applicant the requested one. An applicant with neither
-- (an unknown Verband at sign-up) is for super-admins only.
create or replace function public.can_manage_profile(target uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when target = (select auth.uid()) then false
    else coalesce(
      (select case
                when coalesce(p.scope_association_id, p.requested_association_id) is null
                  then public.is_super_admin()
                else public.can_grant_scope(coalesce(p.scope_association_id, p.requested_association_id))
              end
         from public.profiles p
        where p.id = target),
      false
    )
  end;
$$;

revoke execute on function public.current_scope() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.can_write_association(text) from public, anon;
revoke execute on function public.can_grant_scope(text) from public, anon;
revoke execute on function public.can_manage_profile(uuid) from public, anon;
grant execute on function public.current_scope() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.can_write_association(text) to authenticated;
grant execute on function public.can_grant_scope(text) to authenticated;
grant execute on function public.can_manage_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------------------------
-- The same check on the old and the new row, so an editor can't move a venue out of their scope.

drop policy if exists "venues_auth_insert" on public.venues;
create policy "venues_auth_insert" on public.venues
  for insert to authenticated
  with check (public.can_write_association(association_id));

drop policy if exists "venues_auth_update" on public.venues;
create policy "venues_auth_update" on public.venues
  for update to authenticated
  using (public.can_write_association(association_id))
  with check (public.can_write_association(association_id));

drop policy if exists "venues_auth_delete" on public.venues;
create policy "venues_auth_delete" on public.venues
  for delete to authenticated
  using (public.can_write_association(association_id));

-- Unchanged from 0010, restated so this migration declares what it relies on.
grant select on public.venues to anon;
grant select, insert, update, delete on public.venues to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Venue photo rows
-- ---------------------------------------------------------------------------------------------
-- A photo row follows its venue: whoever may write the venue's Verband may write its photos.
-- Insert and update check the new row, so a photo can't be moved onto a venue out of scope.

drop policy if exists "venue_photos_auth_insert" on public.venue_photos;
create policy "venue_photos_auth_insert" on public.venue_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.venues v
       where v.id = venue_id and public.can_write_association(v.association_id)
    )
  );

drop policy if exists "venue_photos_auth_update" on public.venue_photos;
create policy "venue_photos_auth_update" on public.venue_photos
  for update to authenticated
  using (
    exists (
      select 1 from public.venues v
       where v.id = venue_id and public.can_write_association(v.association_id)
    )
  )
  with check (
    exists (
      select 1 from public.venues v
       where v.id = venue_id and public.can_write_association(v.association_id)
    )
  );

drop policy if exists "venue_photos_auth_delete" on public.venue_photos;
create policy "venue_photos_auth_delete" on public.venue_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.venues v
       where v.id = venue_id and public.can_write_association(v.association_id)
    )
  );

-- Unchanged from 0006, restated so this migration declares what it relies on.
grant select on public.venue_photos to anon;
grant select, insert, update, delete on public.venue_photos to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The venue-photos bucket
-- ---------------------------------------------------------------------------------------------
-- Files are judged by uploader, not by Verband. The path carries no venue, and an upload happens
-- before the venue is saved, so there is no Verband to check yet. Any approved account may
-- upload; only the uploader or the super-admin may replace or delete a file.
-- The grants on storage.objects aren't restated: storage-api owns the table and its grants.

drop policy if exists "venue_photos_auth_write" on storage.objects;
create policy "venue_photos_auth_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'venue-photos' and (select public.current_scope()) is not null);

drop policy if exists "venue_photos_auth_update" on storage.objects;
create policy "venue_photos_auth_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'venue-photos'
    and (owner_id = (select auth.uid())::text or (select public.is_super_admin()))
  )
  with check (
    bucket_id = 'venue-photos'
    and (owner_id = (select auth.uid())::text or (select public.is_super_admin()))
  );

drop policy if exists "venue_photos_auth_delete" on storage.objects;
create policy "venue_photos_auth_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'venue-photos'
    and (owner_id = (select auth.uid())::text or (select public.is_super_admin()))
  );

-- ---------------------------------------------------------------------------------------------
-- Managed profiles
-- ---------------------------------------------------------------------------------------------
-- An editor sees the accounts they manage, next to their own row from 0011.

drop policy if exists "profiles_select_managed" on public.profiles;
create policy "profiles_select_managed" on public.profiles
  for select to authenticated
  using (public.can_manage_profile(id));

-- Unchanged from 0011, restated so this migration declares what it relies on.
grant select on public.profiles to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Editor RPCs
-- ---------------------------------------------------------------------------------------------
-- The only way to change a status or scope. Each one locks the target row and checks the caller
-- again. The statuses move like this:
--
--   pending   --approve_editor-->     approved
--   pending   --reject_editor-->      rejected
--   approved  --suspend_editor-->     suspended
--   suspended --reactivate_editor-->  approved
--   rejected  --approve_editor-->     approved
--   rejected | suspended --request_review_again--> pending
--
-- set_editor_scope changes the scope of an approved account and leaves the status alone.
--
-- set_editor_scope and suspend_editor can take the root node away from someone. They lock the
-- approved super-admins first, in a statement of their own, so two super-admins suspending each
-- other wait for one another. The second call then checks against the committed result and finds
-- its caller no longer approved. Without the lock both would pass and leave nobody at the root.

-- True when target is an approved super-admin and no other one exists. #27 uses it too.
create or replace function public.is_last_super_admin(target_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
           select 1 from public.profiles p
            where p.id = target_id and p.status = 'approved' and p.scope_association_id = 'esv'
         )
     and not exists (
           select 1 from public.profiles p
            where p.id <> target_id and p.status = 'approved' and p.scope_association_id = 'esv'
         );
$$;

create or replace function public.approve_editor(target_id uuid, scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select p.status into current_status from public.profiles p where p.id = target_id for update;
  if not found
     or not public.can_manage_profile(target_id)
     or not public.can_grant_scope(scope) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.associations a where a.id = scope) then
    raise exception 'unknown association: %', scope;
  end if;
  if current_status not in ('pending', 'rejected') then
    raise exception 'cannot approve an account that is %', current_status;
  end if;
  update public.profiles
     set status = 'approved', scope_association_id = scope
   where id = target_id;
end;
$$;

create or replace function public.set_editor_scope(target_id uuid, scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  current_node text;
begin
  perform 1 from public.profiles p
   where p.status = 'approved' and p.scope_association_id = 'esv'
   order by p.id
     for update;

  select p.status, p.scope_association_id into current_status, current_node
    from public.profiles p where p.id = target_id for update;
  if not found
     or not public.can_manage_profile(target_id)
     or not public.can_grant_scope(scope) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.associations a where a.id = scope) then
    raise exception 'unknown association: %', scope;
  end if;
  if current_status <> 'approved' then
    raise exception 'cannot change the scope of an account that is %', current_status;
  end if;
  if current_node = 'esv' and scope <> 'esv' and public.is_last_super_admin(target_id) then
    raise exception 'cannot remove the last super-admin';
  end if;
  update public.profiles set scope_association_id = scope where id = target_id;
end;
$$;

create or replace function public.reject_editor(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select p.status into current_status from public.profiles p where p.id = target_id for update;
  if not found or not public.can_manage_profile(target_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if current_status <> 'pending' then
    raise exception 'cannot reject an account that is %', current_status;
  end if;
  update public.profiles set status = 'rejected' where id = target_id;
end;
$$;

create or replace function public.suspend_editor(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  perform 1 from public.profiles p
   where p.status = 'approved' and p.scope_association_id = 'esv'
   order by p.id
     for update;

  select p.status into current_status from public.profiles p where p.id = target_id for update;
  if not found or not public.can_manage_profile(target_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if current_status <> 'approved' then
    raise exception 'cannot suspend an account that is %', current_status;
  end if;
  if public.is_last_super_admin(target_id) then
    raise exception 'cannot remove the last super-admin';
  end if;
  update public.profiles set status = 'suspended' where id = target_id;
end;
$$;

create or replace function public.reactivate_editor(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select p.status into current_status from public.profiles p where p.id = target_id for update;
  if not found or not public.can_manage_profile(target_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if current_status <> 'suspended' then
    raise exception 'cannot reactivate an account that is %', current_status;
  end if;
  update public.profiles set status = 'approved' where id = target_id;
end;
$$;

-- A rejected or suspended account asks to be looked at again. The scope stays, and grants nothing
-- until someone approves the account.
create or replace function public.request_review_again()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  select p.status into current_status
    from public.profiles p where p.id = (select auth.uid()) for update;
  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if current_status not in ('rejected', 'suspended') then
    raise exception 'cannot request a review for an account that is %', current_status;
  end if;
  update public.profiles set status = 'pending' where id = (select auth.uid());
end;
$$;

revoke execute on function public.is_last_super_admin(uuid) from public, anon;
revoke execute on function public.approve_editor(uuid, text) from public, anon;
revoke execute on function public.set_editor_scope(uuid, text) from public, anon;
revoke execute on function public.reject_editor(uuid) from public, anon;
revoke execute on function public.suspend_editor(uuid) from public, anon;
revoke execute on function public.reactivate_editor(uuid) from public, anon;
revoke execute on function public.request_review_again() from public, anon;
grant execute on function public.is_last_super_admin(uuid) to authenticated;
grant execute on function public.approve_editor(uuid, text) to authenticated;
grant execute on function public.set_editor_scope(uuid, text) to authenticated;
grant execute on function public.reject_editor(uuid) to authenticated;
grant execute on function public.suspend_editor(uuid) to authenticated;
grant execute on function public.reactivate_editor(uuid) to authenticated;
grant execute on function public.request_review_again() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- No stray write policies
-- ---------------------------------------------------------------------------------------------
-- Postgres ORs permissive policies, so one extra write policy (production's dashboard was edited by
-- hand before, see 0007) would undo the scoping above. Stop if any exists that no migration made.

do $$
declare
  stray text;
begin
  select string_agg(format('%I.%I %I (%s)', p.schemaname, p.tablename, p.policyname, p.cmd), ', '
                    order by p.schemaname, p.tablename, p.policyname)
    into stray
    from pg_policies p
   where p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     and (p.schemaname, p.tablename) in (('public', 'venues'), ('public', 'venue_photos'),
                                         ('storage', 'objects'))
     and (p.schemaname, p.tablename, p.policyname) not in (
           ('public', 'venues', 'venues_auth_insert'),
           ('public', 'venues', 'venues_auth_update'),
           ('public', 'venues', 'venues_auth_delete'),
           ('public', 'venue_photos', 'venue_photos_auth_insert'),
           ('public', 'venue_photos', 'venue_photos_auth_update'),
           ('public', 'venue_photos', 'venue_photos_auth_delete'),
           ('storage', 'objects', 'venue_photos_auth_write'),
           ('storage', 'objects', 'venue_photos_auth_update'),
           ('storage', 'objects', 'venue_photos_auth_delete')
         );
  if stray is not null then
    raise exception 'write policies that no migration defines: %', stray
      using hint = 'Drop them, or define them in a migration and add them to this list.';
  end if;
end
$$;
