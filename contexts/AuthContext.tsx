import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/database';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

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
    // Obtener sesión actual con timeout de 10s para evitar spinner infinito
    const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 10000)
    );
    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id, session.user);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

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
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) Alert.alert('Error Google', error.message);
      return;
    }

    // Native: use expo-web-browser for the OAuth flow
    const redirectUrl = Linking.createURL('/');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      Alert.alert('Error Google', error?.message ?? 'No se pudo iniciar el proceso de autenticación.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success' && result.url) {
      // Supabase will pick up the session automatically via the URL hash/code.
      // We trigger getSessionFromUrl so the SDK processes the tokens.
      const { error: sessionError } = await (supabase.auth as any).getSessionFromUrl?.({ url: result.url })
        ?? supabase.auth.exchangeCodeForSession(new URL(result.url).searchParams.get('code') ?? '');
      if (sessionError) {
        Alert.alert('Error de autenticación', sessionError.message);
      }
    } else if (result.type === 'cancel') {
      // User closed the browser — no action needed
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
