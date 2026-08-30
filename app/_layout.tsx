import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeVars } from '@/hooks/use-theme-vars';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ActivityProvider } from '@/contexts/ActivityContext';
import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Modal, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { parseTrustedAuthCallback } from '@/lib/auth/deepLinks';
import type { PreferredPosition } from '@/types/database';
import { POSITION_LABELS, POSITIONS } from '@/components/profile/profileDisplay';
import {
  handleNotificationNavigation,
  registerForPushNotificationsAsync,
  savePushToken,
} from '@/lib/notifications';
import { Archivo_500Medium } from '@expo-google-fonts/archivo/500Medium';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Archivo_900Black } from '@expo-google-fonts/archivo/900Black';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import * as Sentry from '@sentry/react-native';

import { scrubSentryEvent } from '@/lib/sentry/scrub';
import { getPendingSeriesInvite } from '@/lib/seriesInvite';
const MIN_BIRTHDAY_DATE = new Date(1900, 0, 1);

Sentry.init({
  dsn: 'https://f1d68a7332dc132619af76b18cc06b8c@o4511344482648064.ingest.de.sentry.io/4511344484089936',
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  profilesSampleRate: __DEV__ ? 1.0 : 0,
  enableLogs: __DEV__,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  integrations: [Sentry.feedbackIntegration()],
  beforeSend: scrubSentryEvent,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

// Modal que pide datos minimos a usuarios con perfil incompleto (ej. Google OAuth).
function ProfileCompletionGateModal() {
  const { profile, refreshProfile } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [birthday, setBirthday] = useState<Date>(new Date(2000, 0, 1));
  const [preferredPosition, setPreferredPosition] = useState<PreferredPosition | ''>('');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Mostrar solo cuando hay perfil cargado y falta algun dato obligatorio.
  const needsBirthday = !!profile && !profile.birthday;
  const needsPosition = !!profile && !profile.preferred_position;
  if (!needsBirthday && !needsPosition) return null;

  const handleSave = async () => {
    if (needsPosition && !preferredPosition) {
      Alert.alert('Posición pendiente', 'Elige tu posición antes de continuar.');
      return;
    }

    setSaving(true);
    const iso = birthday.toISOString().split('T')[0];
    try {
      if (needsBirthday) {
        const { error } = await supabase
          .from('user_account_private')
          .upsert(
            { user_id: profile!.id, birthday: iso, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );

        if (error) throw error;
      }

      if (needsPosition) {
        const { error } = await supabase
          .from('users')
          .update({ preferred_position: preferredPosition })
          .eq('id', profile!.id);

        if (error) throw error;
      }
      await refreshProfile();
    } catch {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Intentalo de nuevo.');
    } finally {
      setSaving(false);
    }
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
          Completa tu perfil
        </Text>
        <Text style={{ fontSize: 15, color: textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          Necesitamos estos datos para que otros jugadores y organizadores sepan con quien juegan.
        </Text>

        {/* Selector de fecha */}
        <View style={{ width: '100%', marginBottom: 28, gap: 18 }}>
          {needsBirthday && (
            <View>
              <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                Fecha de nacimiento
              </Text>
              <TouchableOpacity
                onPress={() => setShowPicker(true)}
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', minHeight: 54 }}
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
              minimumDate={MIN_BIRTHDAY_DATE}
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
                minimumDate={MIN_BIRTHDAY_DATE}
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
          )}

          {needsPosition && (
            <View>
              <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                Posicion
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {POSITIONS.map((position) => {
                  const active = preferredPosition === position;
                  return (
                    <TouchableOpacity
                      key={position}
                      onPress={() => setPreferredPosition(position as PreferredPosition)}
                      style={{
                        minHeight: 46,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: active ? '#22C55E' : border,
                        backgroundColor: active ? 'rgba(34,197,94,0.16)' : cardBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: active ? '#22C55E' : textPrimary, fontSize: 15, fontWeight: '700' }}>
                        {POSITION_LABELS[position]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
  const themeVars = useThemeVars();
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Flag para evitar redirigir a tabs cuando estamos en flujo de recuperación de contraseña
  const passwordRecoveryRef = useRef(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

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
      const allowedWebOrigin = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
      const callback = parseTrustedAuthCallback(url, allowedWebOrigin);
      if (!callback) return;
      passwordRecoveryRef.current = callback.isRecoveryLink;

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (error) throw error;

        if (callback.isRecoveryLink) {
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
    const inPublicJoin = String(segments[0]) === 'join';

    if (!session && !inAuthGroup && !inPublicJoin) {
      // Redirigir al inicio de sesión si no hay sesión y no estamos ya en la zona auth
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      const redirectAfterAuth = async () => {
        try {
          const pendingInvite = await getPendingSeriesInvite();
          router.replace(pendingInvite ? `/join/${pendingInvite}` as never : '/(tabs)');
        } catch {
          router.replace('/(tabs)');
        }
      };
      void redirectAfterAuth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loading, segments]);

  useEffect(() => {
    if (loading || !session) return;

    let active = true;

    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (active && token) await savePushToken(token);

        notificationListener.current = Notifications.addNotificationReceivedListener(() => undefined);
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationNavigation(response.notification, router);
        });

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (active && lastResponse) handleNotificationNavigation(lastResponse.notification, router);
      } catch (error) {
        if (__DEV__) console.warn('notification setup error:', error);
      }
    };

    void setupNotifications();

    return () => {
      active = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [session, loading, router]);

  if (loading) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, themeVars]}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <ActivityProvider user={user}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={[{ flex: 1 }, themeVars]}>
        <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
        {/* Intercepta usuarios con perfil incompleto (Google OAuth, etc.) */}
        <ProfileCompletionGateModal />
        </View>
      </ThemeProvider>
    </ActivityProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded, fontError] = Font.useFonts({
    Archivo_700Bold,
    Archivo_900Black,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    void Font.loadAsync({
      Archivo_500Medium,
      Archivo_600SemiBold,
      Archivo_800ExtraBold,
      JetBrainsMono_500Medium,
    }).catch(() => undefined);
  }, []);

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
