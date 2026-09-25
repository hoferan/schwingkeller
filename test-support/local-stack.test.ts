import { afterEach, describe, expect, it, vi } from 'vitest';

// global-setup.ts calls assertLocalTargets before any test file runs, but Vite/vitest only load
// .env.local into process.env inside test workers, not in that main process. A cloud
// VITE_SUPABASE_URL there passes the globalSetup guard while every test file that imports
// local-stack builds its client against the cloud project. The guard has to run again wherever
// SUPABASE_URL is read, so it belongs at module scope in local-stack.ts itself.
describe('local-stack module guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses to load when VITE_SUPABASE_URL points at the cloud', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co');
    await expect(import('./local-stack')).rejects.toThrow(/supabaseURL/);
  });

  it('loads when VITE_SUPABASE_URL points at the local stack', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    await expect(import('./local-stack')).resolves.toBeDefined();
  });
});
