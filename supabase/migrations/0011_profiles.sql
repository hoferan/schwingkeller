-- One profile per account: a status and a scope node of the Verband tree (ADR 0016). An editor may
-- write the venues at or below their node, and manage the accounts below it; #26 adds those rules.
-- This migration adds the data only.
--
-- New accounts start pending. At sign-up an applicant may request any node, the ESV included; the
-- approver decides the scope.
--
-- Every account that exists when this runs becomes an approved ESV editor, because until now every
-- account could write everything. Review production's accounts before merging.
--
-- Safe to run twice.

create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text not null,
  status                   text not null default 'pending'
                           check (status in ('pending', 'approved', 'suspended', 'rejected')),
  requested_association_id text references public.associations(id),
  scope_association_id     text references public.associations(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Runs as its owner so it can write profiles, which no signed-in role can. An unknown requested id
-- is stored as null rather than refusing the sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, status, requested_association_id)
  values (
    new.id,
    new.email,
    'pending',
    (select a.id from public.associations a where a.id = new.raw_user_meta_data->>'association')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Reading only. Status and scope change through the RPCs in #26.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

insert into public.profiles (id, email, status, scope_association_id)
select id, email, 'approved', 'esv' from auth.users
on conflict (id) do nothing;
