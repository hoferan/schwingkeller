-- venues got its grants by hand in the dashboard, so no migration declared them
-- and a database built from the migrations alone had none. Declared here to match
-- production; there it is a no-op, since GRANT is idempotent.
grant select on public.venues to anon;
grant select, insert, update, delete on public.venues to authenticated;

-- replace_venues kept EXECUTE for PUBLIC from before the default privileges
-- changed, so anyone could call it; only the table grants stopped an anonymous
-- import. Only signed-in editors call it.
revoke execute on function public.replace_venues(jsonb) from public;
grant execute on function public.replace_venues(jsonb) to authenticated;
