import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { clearAllClientState, clearTransientClientState } from '@/lib/client-state';

type Profile = Tables<'profiles'>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = React.useRef(false);
  const profileRequestId = React.useRef(0);
  const lastUserId = React.useRef<string | null>(null);

  const ensureProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar perfil', error);
      setProfile(null);
      return null;
    }

    if (data) {
      setProfile(data);
      return data;
    }

    const { error: createError } = await supabase
      .from('profiles')
      .upsert({ id: userId } as never, { onConflict: 'id' });

    if (createError) {
      console.error('Erro ao criar perfil automaticamente', createError);
      setProfile(null);
      return null;
    }

    const { data: createdProfile, error: reloadError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (reloadError) {
      console.error('Erro ao recarregar perfil criado', reloadError);
      setProfile(null);
      return null;
    }

    setProfile(createdProfile ?? null);
    return createdProfile ?? null;
  };

  const refreshProfile = async () => {
    if (user) await ensureProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const syncAuthState = (nextSession: Session | null) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;
      const previousUserId = lastUserId.current;

      if (previousUserId && previousUserId !== nextUserId) {
        void clearTransientClientState();
      }

      lastUserId.current = nextUserId;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (previousUserId !== nextUserId) {
        setProfile(null);
      }

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const requestId = ++profileRequestId.current;
      setLoading(true);

      void ensureProfile(nextSession.user.id).finally(() => {
        if (!mounted) return;
        if (profileRequestId.current === requestId) {
          setLoading(false);
        }
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (!initialLoadDone.current && event === 'INITIAL_SESSION') return;
      syncAuthState(nextSession);
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        initialLoadDone.current = true;
        syncAuthState(session);
      })
      .catch((error) => {
        console.error('Erro ao restaurar sessão', error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        initialLoadDone.current = true;
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    profileRequestId.current += 1;

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao encerrar sessão', error);
    } finally {
      lastUserId.current = null;
      await clearAllClientState();
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
