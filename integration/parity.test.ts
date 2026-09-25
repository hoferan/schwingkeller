import { describe, expect, it } from 'vitest';
import { anonClient } from '../test-support/local-stack';

// db-init gives the local database production's default privileges. A volume created before that
// still carries the image's broad grants, and every grant test would then pass for the wrong
// reason. Nothing matches the id, so the delete removes nothing either way.
describe('local grant parity', () => {
  it('refuses anonymous writes at the table, as production does', async () => {
    const { error } = await anonClient()
      .from('venues')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');
    expect(
      error?.message,
      'The local database still has the broad default grants from before the parity step in db-init. Run `docker compose down -v` once, then start the stack again.',
    ).toMatch(/permission denied for table venues/);
  });
});
