// E2E-only test data conventions. The helpers that reach the local stack live in
// test-support/local-stack.ts, shared with the integration tests.

// Every venue a scenario creates carries this, so a sweep can find leftovers from a run that
// crashed before its cleanup ran. Deliberately not a name any real venue would have.
export const E2E_PREFIX = '[e2e]';

// Scenarios write into a canton the seed leaves empty, so a venue in flight can never disturb a
// test that counts Fribourg's labels.
export const WRITE_CANTON = 'GR';
