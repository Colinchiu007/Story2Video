import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserSettings } from '@/types';
import { toast } from 'sonner';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
  return data;
}

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('获取用户设置失败:', error);
    return null;
  }
  return data;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  settings: UserSettings | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      setSettings(null);
      return;
    }

    const [profileData, settingsData] = await Promise.all([
      getProfile(user.id),
      getUserSettings(user.id),
    ]);
    setProfile(profileData);
    setSettings(settingsData);
  };

  useEffect(() => {
    supabase
      .auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          Promise.all([
            getProfile(session.user.id),
            getUserSettings(session.user.id),
          ]).then(([p, s]) => {
            setProfile(p);
            setSettings(s);
          });
        }
      })
      .catch((error: Error) => {
        toast.error(`获取用户信息失败: ${error.message}`);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          getProfile(session.user.id),
          getUserSettings(session.user.id),
        ]).then(([p, s]) => {
          setProfile(p);
          setSettings(s);
        });
      } else {
        setProfile(null);
        setSettings(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSettings(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, settings, loading, signInWithUsername, signUpWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
