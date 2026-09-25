import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, anonClient, signInAsAdmin } from '../test-support/local-stack';
import { INT_PREFIX } from './support';

let admin: SupabaseClient;

beforeAll(async () => {
  admin = await signInAsAdmin(ADMIN.email, ADMIN.password);
});

const snapshot = async () => {
  const { data, error } = await admin.from('venues').select('id, name').order('id');
  if (error) throw new Error(`snapshot failed: ${error.message}`);
  return data;
};

// replace_venues deletes every venue before inserting the new set. Only the refusal and the
// rollback are tested: a successful call would wipe the seed data of whatever stack it runs on.
describe('replace_venues', () => {
  it('cannot be called anonymously', async () => {
    // An empty list inserts nothing; before 0007 an anonymous call went through and deleted
    // nothing only because RLS filtered every row.
    const { error } = await anonClient().rpc('replace_venues', { rows: [] });
    expect(error?.message).toMatch(/permission denied for function replace_venues/);
  });

  it('leaves every venue untouched when one row is broken', async () => {
    const before = await snapshot();
    // 'not-a-number' cannot be cast to double precision, so the second row always fails and the
    // whole call rolls back, including the delete that ran first.
    const { error } = await admin.rpc('replace_venues', {
      rows: [
        { name: `${INT_PREFIX} valid`, canton: 'GR', lat: 46.85, lng: 9.53 },
        { name: `${INT_PREFIX} broken`, canton: 'GR', lat: 'not-a-number', lng: 9.53 },
      ],
    });
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });
});
