-- Scopes every editor to one node of the Verband tree (ADR 0016, #26). Until now any signed-in
-- account wrote everything. From here on the database decides, by the caller's profile: an approved
-- account may write what sits at or below its scope node, and nobody else may write at all.
--
-- The policies read `profiles` live, not the JWT, so suspending an account takes effect at once.
--
-- The file holds the scope helpers, the venue and photo-row policies and the policies on the
-- venue-photos bucket.
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
      (select public.can_grant_scope(coalesce(p.scope_association_id, p.requested_association_id))
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
