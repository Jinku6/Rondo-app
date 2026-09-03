import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import {
  completeSeriesInvite,
  normalizeSeriesInviteCode,
  savePendingSeriesInvite,
} from '@/lib/seriesInvite';
import { supabase } from '@/lib/supabase';

export default function JoinSeriesScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = useMemo(() => normalizeSeriesInviteCode(rawCode), [rawCode]);
  const { user, loading: authLoading } = useAuth();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const joinInFlightRef = useRef(false);

  useEffect(() => {
    if (!code || authLoading) return;

    let active = true;

    const continueInvite = async () => {
      try {
        if (!user) {
          const saved = await savePendingSeriesInvite(code);
          if (!saved) throw new Error('No hemos podido guardar la invitación. Inténtalo de nuevo.');
          return;
        }

        if (joinInFlightRef.current) return;
        joinInFlightRef.current = true;
        setJoining(true);
        setError(null);
        const teamId = await completeSeriesInvite(code, async (inviteCode) => {
          const { data, error: joinError } = await supabase.rpc('join_match_series', {
            p_invite_code: inviteCode,
          });
          if (joinError) throw joinError;
          if (typeof data !== 'string') throw new Error('La invitación no ha devuelto un equipo válido.');
          return data;
        });
        if (active) router.replace(`/group/${teamId}` as never);
      } catch (joinError) {
        if (!active) return;
        setError(joinError instanceof Error ? joinError.message : 'No hemos podido meterte en el equipo.');
      } finally {
        joinInFlightRef.current = false;
        if (active) setJoining(false);
      }
    };

    void continueInvite();
    return () => {
      active = false;
    };
  }, [attempt, authLoading, code, router, user]);

  if (!code) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 24, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Invitación' }} />
        <Ionicons name="link-outline" size={48} color={c.danger} />
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '900', marginTop: 20 }}>Este enlace no vale</Text>
        <Text style={{ color: c.textDim, fontSize: 16, lineHeight: 23, marginTop: 8 }}>
          Pide al capitán que comparta de nuevo la invitación del equipo.
        </Text>
      </View>
    );
  }

  if (authLoading || joining) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Stack.Screen options={{ title: 'Entrar al equipo' }} />
        <ActivityIndicator size="large" color={c.brand} />
        <Text style={{ color: c.textDim, fontSize: 15 }}>
          {joining ? 'Te metemos en el equipo…' : 'Preparando la invitación…'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingHorizontal: 24, backgroundColor: c.bg, justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Entrar al equipo' }} />
        <Ionicons name="alert-circle-outline" size={48} color={c.danger} />
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '900', marginTop: 20 }}>No has podido entrar</Text>
        <Text style={{ color: c.textDim, fontSize: 16, lineHeight: 23, marginTop: 8 }}>{error}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setAttempt(value => value + 1)}
          style={{ minHeight: 52, marginTop: 24, borderRadius: 14, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: c.brandInk, fontSize: 16, fontWeight: '800' }}>Probar otra vez</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 24, backgroundColor: c.bg, justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Invitación de equipo' }} />
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="people-outline" size={32} color={c.brand} />
      </View>
      <Text style={{ color: c.text, fontSize: 30, lineHeight: 34, fontWeight: '900', textTransform: 'uppercase', marginTop: 24 }}>
        Te quieren en el equipo
      </Text>
      <Text style={{ color: c.textDim, fontSize: 16, lineHeight: 24, marginTop: 12 }}>
        Entra en Rondo y tendrás la lista y cada partido semanal en el mismo sitio.
      </Text>
      <View style={{ gap: 12, marginTop: 32 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/login')}
          style={{ minHeight: 52, borderRadius: 14, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: c.brandInk, fontSize: 16, fontWeight: '800' }}>Ya tengo cuenta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/register')}
          style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
