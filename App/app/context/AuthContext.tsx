// app/context/AuthContext.tsx
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';
import { clearEventReminders } from '../utils/eventReminders';

export type Membership = {
  orgId: string;
  orgName: string;
  role: 'admin' | 'staff' | 'giocatore';
  playerId: string | null;
};

type AuthResult = { error: string | null };
type SignUpResult = AuthResult & { needsEmailConfirmation: boolean };

type AuthCtx = {
  session: Session | null;
  membership: Membership | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  createOrganization: (name: string) => Promise<AuthResult>;
  redeemInvite: (code: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMembership = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setMembership(null);
      return;
    }
    const { data, error } = await supabase
      .from('memberships')
      .select('org_id, role, player_id, organizations(name)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setMembership(null);
      setCurrentOrgId(null);
      return;
    }
    const orgName = (data.organizations as unknown as { name: string } | null)?.name ?? '';
    setMembership({
      orgId: data.org_id,
      role: data.role as 'admin' | 'staff' | 'giocatore',
      playerId: data.player_id,
      orgName,
    });
    setCurrentOrgId(data.org_id);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      loadMembership(data.session?.user?.id).finally(() => mounted && setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(true);
      loadMembership(newSession?.user?.id).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadMembership]);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null, needsEmailConfirmation: !error && !data.session };
  };

  const signOut = async () => {
    await clearEventReminders();
    await supabase.auth.signOut();
    setCurrentOrgId(null);
  };

  const createOrganization = async (name: string): Promise<AuthResult> => {
    const { error } = await supabase.rpc('create_organization', { p_name: name });
    if (!error) await loadMembership(session?.user?.id);
    return { error: error?.message ?? null };
  };

  const redeemInvite = async (code: string): Promise<AuthResult> => {
    const { error } = await supabase.rpc('redeem_invite', { p_code: code });
    if (!error) await loadMembership(session?.user?.id);
    return { error: error?.message ?? null };
  };

  const value = useMemo<AuthCtx>(
    () => ({ session, membership, loading, signIn, signUp, signOut, createOrganization, redeemInvite }),
    [session, membership, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve stare dentro <AuthProvider>');
  return ctx;
}
