import { defineConfig } from 'vitest/config';

// Integration tests reach the local Compose stack (see docker-compose.yml) as real users and check
// RLS, table grants and database functions. One file at a time: several files delete every venue
// named with INT_PREFIX after their tests, which would remove another file's venues mid-test.
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
