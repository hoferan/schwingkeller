-- Every venue belongs to one cantonal association (ADR 0015). 0008 added the column as nullable and
-- filled it from the canton for every venue outside Bern. The edit form requires an association, and
-- from here on the database does too.
--
-- No backfill. 0008's canton rule has already run, so a venue that is still null needs someone to
-- pick its association; filing it under a guess would be worse. The migration stops and names the
-- venues instead.
--
-- Safe to run twice.

do $$
declare
  missing text;
begin
  select string_agg(format('%s (%s)', name, canton), ', ' order by name)
    into missing
    from public.venues
   where association_id is null;
  if missing is not null then
    raise exception 'venues without an association: %. Assign one to each before this migration runs.', missing;
  end if;
end;
$$;

alter table public.venues alter column association_id set not null;

-- Unchanged from 0007, restated so this migration declares what it relies on.
grant select on public.venues to anon;
grant select, insert, update, delete on public.venues to authenticated;
