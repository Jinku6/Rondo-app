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
import {
  handleNotificationNavigation,
  registerForPushNotificationsAsync,
  savePushToken,
} from '@/lib/notifications';
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

const SENTRY_REDACTED = '[Filtered]';
const SENTRY_SENSITIVE_KEY = /authorization|token|secret|password|api[_-]?key|apikey|email|phone|birthday|location|latitude|longitude|lat|lng|ip_address/i;
const SENTRY_SENSITIVE_TEXT = /([\w.%+-]+@[\w.-]+\.[A-Za-z]{2,})|(\+?\d[\d\s().-]{7,}\d)|(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
const MIN_BIRTHDAY_DATE = new Date(1900, 0, 1);

const scrubSentryValue = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(SENTRY_SENSITIVE_TEXT, SENTRY_REDACTED);
  if (Array.isArray(value)) return value.map(scrubSentryValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENTRY_SENSITIVE_KEY.test(key) ? SENTRY_REDACTED : scrubSentryValue(entry),
    ]),
  );
};

const scrubSentryEvent = (event: any) => {
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  event.extra = scrubSentryValue(event.extra) as any;
  event.contexts = scrubSentryValue(event.contexts) as any;
  event.request = scrubSentryValue(event.request) as any;
  event.breadcrumbs = Array.isArray(event.breadcrumbs)
    ? event.breadcrumbs.map(scrubSentryValue)
    : event.breadcrumbs;
  return event;
};

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
    try {
      const { error } = await supabase
        .from('user_account_private')
        .upsert(
          { user_id: profile!.id, birthday: iso, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );

      if (error) throw error;
      await refreshProfile();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la fecha. Inténtalo de nuevo.');
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

    if (!session && !inAuthGroup) {
      // Redirigir al inicio de sesión si no hay sesión y no estamos ya en la zona auth
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Redirigir a la app principal si hay sesión y estábamos en una pantalla de auth
      router.replace('/(tabs)');
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
        {/* Intercepta usuarios sin birthday (Google OAuth, etc.) */}
        <BirthdayGateModal />
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
