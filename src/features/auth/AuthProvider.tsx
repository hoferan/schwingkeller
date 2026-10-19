import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { buildTree, type AssociationTree } from '../associations/tree';
import type { Profile } from './profile';
import { canWriteAssociation } from './scope';
import { useProfile } from './useProfile';

export interface AuthValue {
  session: Session | null;
  // Null while signed out, loading or failed.
  profile: Profile | null;
  // The profile's scope node when the status is 'approved', else null.
  scope: string | null;
  isApproved: boolean;
  isSuperAdmin: boolean;
  canEditAssociation: (id: string | null) => boolean;
  // Temporary: goes once callers read the scope instead.
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthValue | null>(null);

const tree = buildTree();

// A missing session, a missing profile and a profile of another user all give no rights.
// eslint-disable-next-line react-refresh/only-export-components
export const buildAuthValue = (
  session: Session | null,
  profile: Profile | null,
  associations: AssociationTree,
): Omit<AuthValue, 'signIn' | 'signOut'> => {
  const own = session && profile && profile.id === session.user.id ? profile : null;
  const scope = own && own.status === 'approved' ? own.scope_association_id : null;
  return {
    session,
    profile: own,
    scope,
    isApproved: scope !== null,
    isSuperAdmin: scope === 'esv',
    canEditAssociation: (id) => canWriteAssociation(associations, scope, id),
    isAdmin: !!session,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(session?.user.id ?? null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.removeQueries({ queryKey: ['profile'] });
  };

  const base = useMemo(() => buildAuthValue(session, profile ?? null, tree), [session, profile]);

  return <AuthContext.Provider value={{ ...base, signIn, signOut }}>{children}</AuthContext.Provider>;
};
