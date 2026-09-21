// The admin that docker-compose.yml's admin-init creates through the GoTrue admin API. These are
// local-stack-only credentials, committed alongside the demo JWTs in docker/supabase.env for the
// same reason: `docker compose up` has to work with no setup. They authenticate against nothing
// but a disposable container on this machine.
export const ADMIN = {
  email: 'admin@schwingkeller.local',
  password: 'schwingadmin',
} as const;

export const STORAGE_STATE = 'e2e/.auth/admin.json';

// Fribourg carries 11 seeded venues, two of them ~135m apart, which is the only canton dense
// enough to push the poster's label placement off its first-choice slot. See supabase/seed.sql.
export const DENSE_CANTON = 'FR';
