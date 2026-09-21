/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { codecovVitePlugin } from '@codecov/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
    ...(process.env.CODECOV_TOKEN
      ? [
          codecovVitePlugin({
            enableBundleAnalysis: true,
            bundleName: 'schwingkeller',
            uploadToken: process.env.CODECOV_TOKEN,
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: true,
  },
  test: {
    // Scoped to src/ so Vitest's default glob does not also pick up the Playwright specs in e2e/,
    // which import @playwright/test and would fail under jsdom.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-report.junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
});
