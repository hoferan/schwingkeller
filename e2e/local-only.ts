// The specs create and delete venues, so they may only ever reach the local Compose stack. The
// Playwright config checks every target URL with this before a server starts or a spec runs, which
// stops a stray E2E_BASE_URL or VITE_SUPABASE_URL from pointing the suite at production data.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export const assertLocalTargets = (targets: Record<string, string>): void => {
  for (const [name, value] of Object.entries(targets)) {
    let host: string;
    try {
      host = new URL(value).hostname;
    } catch {
      throw new Error(`e2e: ${name} is not a valid URL: ${value}`);
    }
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(`e2e: ${name} must point at the local stack (localhost or 127.0.0.1), got ${value}`);
    }
  }
};
