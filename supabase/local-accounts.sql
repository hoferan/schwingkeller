-- The local test accounts' profiles, one per level of the Verband tree plus one awaiting approval.
-- Local stack only: db-init runs this after the migrations on every start, and `supabase db push`
-- never reads it.
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
