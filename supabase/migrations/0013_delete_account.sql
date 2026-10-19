-- Deletes an account (#27, GDPR and DSG erasure). Any signed-in account may delete itself, whatever
-- its status. Only a super-admin may delete someone else's. The last approved super-admin can't be
-- deleted at all; the ESV scope has to go to someone else first.
--
-- The function deletes the auth.users row. Everything that refers to it cascades: identities,
-- sessions and refresh tokens, MFA factors, and the profile. Uploaded photos stay in the
-- venue-photos bucket, because they belong to the venue; storage.objects has no foreign key to
-- auth.users.
--
-- Safe to run twice.

-- Runs as its owner, which may delete from auth.users; no signed-in role may.
--
-- It locks the approved super-admins first, in a statement of its own, as set_editor_scope and
-- suspend_editor in 0012 do. When two super-admins delete each other at once, the second call waits,
-- then finds its caller gone and is refused, so one super-admin remains. Two concurrent self-deletes by
-- the last two super-admins serialize on the same lock, and the second is refused as the last
-- super-admin.
--
-- A caller who may not delete the target gets 'not authorized' whether or not the id exists, so ids
-- can't be probed. So does a caller whose own account is already gone but whose token is still valid.
create or replace function public.delete_account(target_id uuid default null)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  caller uuid;
  target uuid;
begin
  perform 1 from public.profiles p
   where p.status = 'approved' and p.scope_association_id = 'esv'
   order by p.id
     for update;

  caller := (select auth.uid());
  target := coalesce(target_id, caller);

  if caller is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if target = caller then
    if not exists (select 1 from auth.users u where u.id = caller) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  elsif not public.is_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  elsif not exists (select 1 from auth.users u where u.id = target) then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if public.is_last_super_admin(target) then
    raise exception 'cannot delete the last super-admin' using errcode = 'P0001';
  end if;

  delete from auth.users u where u.id = target;
end;
$$;

revoke execute on function public.delete_account(uuid) from public, anon;
grant execute on function public.delete_account(uuid) to authenticated;
