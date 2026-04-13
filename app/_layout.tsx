import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Modal, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

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

  useEffect(() => {
    if (loading) return;

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
