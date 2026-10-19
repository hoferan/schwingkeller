import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { buildTree } from '../associations/tree';
import { AuthContext, buildAuthValue } from './AuthProvider';
import type { Profile } from './profile';

export type TestAccount = 'esv' | 'bksv' | 'emmental' | 'pending' | 'suspended' | 'rejected' | 'signed-out' | 'loading';

const tree = buildTree();
const USER_ID = 'test-user';
const session = { user: { id: USER_ID } } as unknown as Session;

const profileFor = (as: Exclude<TestAccount, 'signed-out' | 'loading'>): Profile => {
  const base = { id: USER_ID, requested_association_id: null };
  switch (as) {
    case 'esv':
    case 'bksv':
    case 'emmental':
      return { ...base, status: 'approved', scope_association_id: as };
    case 'pending':
      return { ...base, status: 'pending', scope_association_id: null, requested_association_id: 'emmental' };
    case 'suspended':
    case 'rejected':
      return { ...base, status: as, scope_association_id: 'emmental' };
  }
};

// Stands in for the real AuthProvider in component tests, so they need no Supabase mock.
export const TestAuthProvider = ({ as, children }: { as: TestAccount; children: ReactNode }) => {
  // 'loading' is a session whose profile has not arrived yet.
  const value =
    as === 'signed-out'
      ? buildAuthValue(null, null, tree)
      : as === 'loading'
        ? buildAuthValue(session, null, tree)
        : buildAuthValue(session, profileFor(as), tree);
  return (
    <AuthContext.Provider
      value={{ ...value, signIn: async () => ({ error: null }), signOut: async () => {} }}
    >
      {children}
    </AuthContext.Provider>
  );
};
