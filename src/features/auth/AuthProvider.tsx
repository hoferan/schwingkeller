import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { captureAndFormat } from '../../lib/sentry';
import { buildTree, type AssociationTree } from '../associations/tree';
import { signInFailure, signUpFailure, type AuthFailure, type SignInFailure } from './authFailure';
import type { Profile } from './profile';
import { canWriteAssociation } from './scope';
import { forgetAccount, useProfile } from './useProfile';

export interface AuthValue {
  session: Session | null;
  // Null while signed out, loading or failed.
  profile: Profile | null;
  // The profile's scope node when the status is 'approved', else null.
  scope: string | null;
  isApproved: boolean;
  isSuperAdmin: boolean;
  // True when the scope has nodes below it (the ESV and the Teilverbände): those accounts get the
  // account list (the Benutzer tab) and the pending badge. RLS decides which rows it shows. Every
  // approved editor gets the panel itself, for the invitations.
  canManageAccounts: boolean;
  canEditAssociation: (id: string | null) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: SignInFailure | null }>;
  // Signs up with an invitation token. The database decides the node from the invitation.
  signUp: (email: string, password: string, invitation: string) => Promise<{ error: AuthFailure | null }>;
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
): Omit<AuthValue, 'signIn' | 'signUp' | 'signOut'> => {
  const own = session && profile && profile.id === session.user.id ? profile : null;
  const scope = own && own.status === 'approved' ? own.scope_association_id : null;
  return {
    session,
    profile: own,
    scope,
    isApproved: scope !== null,
    isSuperAdmin: scope === 'esv',
    canManageAccounts: scope !== null && associations.childrenOf(scope).length > 0,
    canEditAssociation: (id) => canWriteAssociation(associations, scope, id),
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const queryClient = useQueryClient();
  const { data: profile, error: profileError } = useProfile(session?.user.id ?? null);

  // Without a profile an editor silently loses every control, so a failed fetch has to reach Sentry.
  useEffect(() => {
    if (profileError) captureAndFormat(profileError, 'profile fetch failed');
  }, [profileError]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? signInFailure(error) : null };
  };
  // The access token in the sign-up response still carries the used invitation, because GoTrue signs
  // it before any trigger runs (ADR 0020). A refresh issues a clean one. If the refresh fails, the
  // next automatic one does the same, so the sign-up still counts as done.
  const signUp: AuthValue['signUp'] = async (email, password, invitation) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { invitation } } });
    if (error) return { error: signUpFailure(error) };
    if (data.session) await supabase.auth.refreshSession();
    return { error: null };
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    forgetAccount(queryClient);
  };

  const base = useMemo(() => buildAuthValue(session, profile ?? null, tree), [session, profile]);

  return <AuthContext.Provider value={{ ...base, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
};
