-- NOTE: change to your own passwords for production environments
--
-- Set the password for every Supabase service role to $POSTGRES_PASSWORD.
-- We only ALTER roles that actually exist in this Postgres image: the set of
-- pre-created roles varies by image version (e.g. supabase_functions_admin is
-- not present in newer images). A hard-coded ALTER on a missing role aborts the
-- script and leaves later roles (notably supabase_storage_admin) without their
-- password, which then breaks Storage/Auth with "password authentication failed".
\set pgpass `echo "$POSTGRES_PASSWORD"`

SELECT format('ALTER USER %I WITH PASSWORD %L', rolname, :'pgpass')
FROM pg_roles
WHERE rolname IN (
  'authenticator',
  'pgbouncer',
  'supabase_auth_admin',
  'supabase_functions_admin',
  'supabase_storage_admin',
  'supabase_admin'
)
\gexec
