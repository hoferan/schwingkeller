import { describe, expect, it } from 'vitest';
import { catalogQuery } from './support';

// The hosted project's default privileges gave anon and authenticated TRUNCATE, REFERENCES,
// TRIGGER and MAINTAIN on every new table in public. TRUNCATE ignores RLS. No PostgREST call
// reaches any of them, but a function running as the caller could, so the tables hold only what
// the migrations grant (#85).
type Right = { table?: string; role: string; privilege: string };

describe('table rights for anon and authenticated', () => {
  it('grants nothing beyond select, insert, update and delete on any public table', async () => {
    const rows = await catalogQuery<Right>(`
      select c.relname as table, a.grantee::regrole::text as role, a.privilege_type as privilege
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace,
             aclexplode(c.relacl) a
       where n.nspname = 'public'
         and c.relkind in ('r', 'p')
         and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
         and a.privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
       order by 1, 2, 3`);
    expect(rows).toEqual([]);
  });

  it('gives new tables in public no rights for them by default', async () => {
    const rows = await catalogQuery<Right>(`
      select a.grantee::regrole::text as role, a.privilege_type as privilege
        from pg_default_acl d,
             aclexplode(d.defaclacl) a
       where d.defaclrole = 'postgres'::regrole
         and d.defaclnamespace = 'public'::regnamespace
         and d.defaclobjtype = 'r'
         and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
       order by 1, 2`);
    expect(rows).toEqual([]);
  });
});
