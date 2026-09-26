import { defineConfig } from 'vitest/config';

// Integration tests reach the local Compose stack (see docker-compose.yml) as real users and check
// RLS, table grants and database functions. One file at a time: the replace_venues test compares
// the whole venues table before and after, which parallel inserts from another file would disturb.
export default defineConfig({
  test: {
    include: ['integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 90_000,
    globalSetup: ['integration/global-setup.ts'],
  },
});
