import { useState, useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signOut as authSignOut } from '../lib/auth';
import type { User } from '../types';

interface AuthState {
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    // Resolve the initial session from persisted storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user, loading: false }));
        loadProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    // Keep in sync with auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user }));
        loadProfile(session.user.id);
      } else {
        setState({ user: null, profile: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) setState(prev => ({ ...prev, profile: data as User }));
    } catch {
      // Profile may not exist yet if trigger hasn't run — non-fatal
    }
  }

  async function signOut() {
    try {
      await authSignOut();
    } catch {
      // Force local clear even if network fails
      setState({ user: null, profile: null, loading: false });
    }
  }

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    signOut,
  };
}
