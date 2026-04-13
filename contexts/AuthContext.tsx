import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/database';
import * as Linking from 'expo-linking';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, fullName: string, preferredPosition: string, phone: string, birthday: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, authUser?: User) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      let profileData = data;

      // Sincronizar foto de Google si el perfil no tiene avatar pero el proveedor sí
      if (!data.avatar_url && authUser) {
        const googleAvatar =
          authUser.user_metadata?.picture ||
          authUser.user_metadata?.avatar_url ||
          null;

        if (googleAvatar) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: googleAvatar })
            .eq('id', userId);

          if (!updateError) {
            profileData = { ...data, avatar_url: googleAvatar };
          }
        }
      }

      setProfile(profileData as UserProfile);
    }
  };

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user);
      }
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string, fullName: string, preferredPosition: string, phone: string, birthday: string, captchaToken?: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        emailRedirectTo: Linking.createURL('/'),
        data: {
          username: username.toLowerCase(),
          full_name: fullName,
          preferred_position: preferredPosition,
          phone: phone,
          birthday: birthday,
        },
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = Platform.OS === 'web'
      ? window.location.origin
      : Linking.createURL('/');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) {
      console.error('Error Google OAuth:', error.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
