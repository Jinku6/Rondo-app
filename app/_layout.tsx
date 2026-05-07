import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Modal, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://f1d68a7332dc132619af76b18cc06b8c@o4511344482648064.ingest.de.sentry.io/4511344484089936',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  // Adjust this value in production.
  tracesSampleRate: 1.0,

  // profilesSampleRate is relative to tracesSampleRate.
  // Here, profiles are captured for 100% of transactions.
  profilesSampleRate: 1.0,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

// Modal que pide la fecha de nacimiento a usuarios sin birthday (ej. Google OAuth)
function BirthdayGateModal() {
  const { profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [birthday, setBirthday] = useState<Date>(new Date(2000, 0, 1));
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Mostrar solo cuando hay perfil cargado y no tiene birthday
  const needsBirthday = !!profile && !profile.birthday;
  if (!needsBirthday) return null;

  const handleSave = async () => {
    setSaving(true);
    const iso = birthday.toISOString().split('T')[0];
    const { error } = await supabase
      .from('users')
      .update({ birthday: iso })
      .eq('id', profile!.id);

    if (error) {
      Alert.alert('Error', 'No se pudo guardar la fecha. Inténtalo de nuevo.');
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
  };

  const birthdayLabel = birthday.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const bg = isDark ? '#0a0a0a' : '#ffffff';
  const cardBg = isDark ? '#111827' : '#f8fafc';
  const border = isDark ? '#1f2937' : '#e2e8f0';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <View style={{ backgroundColor: '#22C55E', borderRadius: 24, width: 72, height: 72, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="calendar" size={36} color="#fff" />
        </View>

        <Text style={{ fontSize: 26, fontWeight: 'bold', color: textPrimary, textAlign: 'center', marginBottom: 10 }}>
          ¿Cuándo es tu cumpleaños?
        </Text>
        <Text style={{ fontSize: 15, color: textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          Necesitamos tu fecha de nacimiento para mostrar tu edad a los organizadores de partidos.
        </Text>

        {/* Selector de fecha */}
        <View style={{ width: '100%', marginBottom: 28 }}>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="calendar-outline" size={20} color="#22C55E" style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, flex: 1 }}>
              {birthdayLabel}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          {/* Android: picker inline */}
          {Platform.OS === 'android' && showPicker && (
            <DateTimePicker
              value={birthday}
              mode="date"
              display="default"
              maximumDate={new Date(new Date().getFullYear() - 14, 11, 31)}
              onChange={(_: DateTimePickerEvent, date?: Date) => {
                setShowPicker(false);
                if (date) setBirthday(date);
              }}
            />
          )}

          {/* iOS: picker spinner inline */}
          {Platform.OS === 'ios' && showPicker && (
            <View style={{ marginTop: 8, backgroundColor: cardBg, borderRadius: 14, borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
              <DateTimePicker
                value={birthday}
                mode="date"
                display="spinner"
                maximumDate={new Date(new Date().getFullYear() - 14, 11, 31)}
                onChange={(_: DateTimePickerEvent, date?: Date) => {
                  if (date) setBirthday(date);
                }}
                style={{ height: 160 }}
              />
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={{ backgroundColor: '#22C55E', margin: 12, borderRadius: 10, padding: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 16, width: '100%', alignItems: 'center', minHeight: 52 }}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>Guardar y continuar</Text>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// Componente interno para gestionar la redirección
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Flag para evitar redirigir a tabs cuando estamos en flujo de recuperación de contraseña
  const passwordRecoveryRef = useRef(false);

  // Escuchar el evento PASSWORD_RECOVERY de Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryRef.current = true;
        router.replace('/(auth)/reset-password');
      } else if (event === 'USER_UPDATED') {
        // Contraseña actualizada correctamente, limpiar flag
        passwordRecoveryRef.current = false;
      }
    });

    // Manejar enlaces de recuperación de contraseña entrantes (Deep Linking)
    const handleDeepLink = async (url: string) => {
      const [, hash = ''] = url.split('#');
      const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
      const params = new URLSearchParams(query);
      const hashParams = new URLSearchParams(hash);
      const type = params.get('type') ?? hashParams.get('type');
      const code = params.get('code') ?? hashParams.get('code');
      const accessToken = params.get('access_token') ?? hashParams.get('access_token');
      const refreshToken = params.get('refresh_token') ?? hashParams.get('refresh_token');
      const isRecoveryLink = type === 'recovery' || url.includes('reset-password');
      const isAuthLink = isRecoveryLink || type === 'signup' || type === 'email_change' || !!code || (!!accessToken && !!refreshToken);

      if (!isAuthLink) return;

      passwordRecoveryRef.current = isRecoveryLink;

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        if (isRecoveryLink) {
          router.replace('/(auth)/reset-password');
        } else {
          router.replace('/(auth)/login');
        }
      } catch (e) {
        passwordRecoveryRef.current = false;
        const message = e instanceof Error ? e.message : 'El enlace de recuperaciÃ³n no es vÃ¡lido o ha caducado.';
        if (Platform.OS === 'web') {
          window.alert(`Error: ${message}`);
        } else {
          Alert.alert('Error', message);
        }
      }
    };

    // Escuchar enlaces si la app está en segundo plano
    const linkingSub = Linking.addEventListener('url', (event) => {
       handleDeepLink(event.url);
    });

    // Escuchar enlaces si la app está cerrada
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (passwordRecoveryRef.current) return; // No redirigir durante recuperación de contraseña

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirigir al inicio de sesión si no hay sesión y no estamos ya en la zona auth
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Redirigir a la app principal si hay sesión y estábamos en una pantalla de auth
      router.replace('/(tabs)');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      {/* Intercepta usuarios sin birthday (Google OAuth, etc.) */}
      <BirthdayGateModal />
    </ThemeProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded, fontError] = Font.useFonts({
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
});
