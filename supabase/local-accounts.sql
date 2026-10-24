-- The local test accounts' profiles, one per level of the Verband tree plus one awaiting approval,
-- and the test_… functions the integration tests use for state no client can make or see.
-- Local stack only: db-init runs this after the migrations on every start, and `supabase db push`
-- never reads it, so production never has these functions.
--
-- It runs every time because the profiles start out differently depending on the volume. On a fresh
-- stack admin-init creates the users before 0011 runs, so the bootstrap makes them all ESV editors.
-- On an older volume they're created after it, and the trigger makes them pending. Either way this
-- sets the intended state. test-support/local-stack.ts lists the same accounts.

create temp table local_accounts (email text, status text, requested text, scope text);

insert into local_accounts values
  ('admin@schwingkeller.local', 'approved', null, 'esv'),
  ('bksv@schwingkeller.local', 'approved', null, 'bksv'),
  ('emmental@schwingkeller.local', 'approved', null, 'emmental'),
  ('pending@schwingkeller.local', 'pending', 'emmental', null);

do $$
declare
  missing text;
begin
  select string_agg(a.email, ', ' order by a.email)
    into missing
    from local_accounts a
   where not exists (select 1 from auth.users u where u.email = a.email);
  if missing is not null then
    raise exception 'local test accounts missing from auth.users: %. admin-init creates them; check its log.', missing;
  end if;
end;
$$;

insert into public.profiles (id, email, status, requested_association_id, scope_association_id)
select u.id, u.email, a.status, a.requested, a.scope
  from local_accounts a
  join auth.users u on u.email = a.email
on conflict (id) do update
  set status = excluded.status,
      requested_association_id = excluded.requested_association_id,
      scope_association_id = excluded.scope_association_id;

-- ---------------------------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------------------------
-- Called through PostgREST by any signed-in account. They run as their owner, past the select
-- policy and the missing write grants on public.invitations.

-- Moves an invitation into the past by by_interval: its creation, its expiry and, if revoked, its
-- revocation. That gives expired invitations and ones old enough to purge.
create or replace function public.test_backdate_invitation(invitation_id uuid, by_interval interval)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invitations
     set created_at = created_at - by_interval,
         expires_at = expires_at - by_interval,
         revoked_at = revoked_at - by_interval
   where id = invitation_id;
$$;

-- Every invitation for an address, oldest first, used and revoked ones included.
create or replace function public.test_invitation_rows(target_email text)
returns table (id uuid, used_at timestamptz, used_by uuid, revoked_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select i.id, i.used_at, i.used_by, i.revoked_at
    from public.invitations i
   where i.email = lower(trim(target_email))
   order by i.created_at, i.id;
$$;

revoke execute on function public.test_backdate_invitation(uuid, interval) from public, anon;
revoke execute on function public.test_invitation_rows(text) from public, anon;
grant execute on function public.test_backdate_invitation(uuid, interval) to authenticated;
grant execute on function public.test_invitation_rows(text) to authenticated;
