import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types/database';
import { isValidUUID, firstParam, isSafeUrl } from '@/lib/utils';
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';

const c = Colors;

const POSITION_LABELS: Record<string, string> = {
  portero: 'Portero',
  defensa: 'Defensa',
  mediocentro: 'Medio',
  delantero: 'Delantero',
};

function getReliabilityInfo(score: number): { label: string; icon: string; color: string } {
  if (score >= 90) return { label: 'Nunca falta', icon: '✅', color: c.brand };
  if (score >= 75) return { label: 'Casi nunca falta', icon: '🌟', color: c.warning };
  if (score >= 50) return { label: 'Falta con frecuencia', icon: '⚠️', color: '#F97316' };
  return { label: 'Falta casi siempre', icon: '🚫', color: c.danger };
}

function getAttitudeEmoji(rating: number): string {
  if (rating === 0) return '—';
  if (rating >= 4) return '🤩';
  if (rating >= 2.5) return '😐';
  return '😠';
}

function getAttitudeColor(rating: number): string {
  if (rating === 0) return c.textMuted;
  if (rating >= 4) return c.brand;
  if (rating >= 2.5) return c.warning;
  return c.danger;
}

function formatMemberSince(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      if (!isValidUUID(id)) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('users')
          .select(PUBLIC_USER_SELECT)
          .eq('id', id)
          .single();

        if (active && !error && data) setProfile({ ...data, birthday: null } as UserProfile);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProfile();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="person-outline" size={48} color={c.textMuted} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 6 }}>Usuario no encontrado</Text>
        <Text style={{ fontSize: 14, color: c.textDim, textAlign: 'center' }}>Este perfil no existe o ha sido eliminado.</Text>
      </View>
    );
  }

  const reliability = getReliabilityInfo(profile.reliability_score);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>

        <ScreenTitle style={{ flex: 1, textAlign: 'center' }}>
          Perfil
        </ScreenTitle>

        {isOwnProfile ? (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="settings-outline" size={22} color={c.textDim} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Identity ───────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          {isSafeUrl(profile.avatar_url) ? (
            <Image
              source={{ uri: profile.avatar_url! }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                borderWidth: 3,
                borderColor: c.brand,
                marginBottom: 16,
              }}
            />
          ) : (
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: c.brandSoft,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 3,
              borderColor: c.brand,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 40, color: c.brand, fontWeight: '800' }}>
                {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          <Text style={{
            fontFamily: 'Archivo_900Black',
            fontSize: 26,
            fontWeight: '900',
            color: c.text,
            letterSpacing: -0.5,
            marginBottom: 4,
            textAlign: 'center',
          }}>
            {profile.full_name}
          </Text>

          <Text style={{ fontSize: 14, color: c.textDim, marginBottom: 4 }}>
            @{profile.username}
          </Text>

          <Text style={{ fontSize: 12, color: c.textMuted }}>
            Jugador desde {formatMemberSince(profile.created_at)}
          </Text>
        </View>

        {/* ── Quick Stats Row ────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: c.bgElev,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          marginBottom: 14,
          overflow: 'hidden',
        }}>
          {/* Partidos */}
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Partidos
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 22, fontWeight: '900', color: c.text }}>
              {profile.matches_played}
            </Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: c.border, marginVertical: 14 }} />

          {/* Posición */}
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Posición
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: c.text, textAlign: 'center' }}>
              {profile.preferred_position
                ? POSITION_LABELS[profile.preferred_position] ?? profile.preferred_position
                : '—'}
            </Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: c.border, marginVertical: 14 }} />

          {/* Fiabilidad */}
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Fiabilidad
            </Text>
            {profile.matches_played >= 3 ? (
              <>
                <Text style={{ fontSize: 18, marginBottom: 2 }}>{reliability.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: reliability.color, textAlign: 'center', lineHeight: 14 }}>
                  {reliability.label}
                </Text>
              </>
            ) : (
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: c.textMuted }}>—</Text>
            )}
          </View>
        </View>

        {/* ── Sobre mí ───────────────────────────────────────────── */}
        <View style={{
          backgroundColor: c.bgElev,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          padding: 18,
          marginBottom: 14,
        }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: c.textDim,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            Sobre mí
          </Text>
          <Text style={{ fontSize: 14, color: profile.bio ? c.textDim : c.textMuted, lineHeight: 22, fontStyle: profile.bio ? 'normal' : 'italic' }}>
            {profile.bio ?? 'Sin descripción todavía.'}
          </Text>
        </View>

        {/* ── Estadísticas ───────────────────────────────────────── */}
        <Text style={{
          fontSize: 10,
          fontWeight: '700',
          color: c.textDim,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Estadísticas
        </Text>

        {profile.matches_played < 3 ? (
          <View style={{
            backgroundColor: c.brandSoft,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.brand + '33',
            padding: 20,
            alignItems: 'center',
            marginBottom: 14,
          }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: c.brand, marginBottom: 4 }}>Perfil en crecimiento</Text>
            <Text style={{ fontSize: 13, color: c.textDim, textAlign: 'center', lineHeight: 20 }}>
              Las estadísticas se desbloquean al completar 3 partidos valorados ({profile.matches_played}/3).
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {/* Partidos */}
            <View style={{
              flex: 1,
              backgroundColor: c.bgElev,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              alignItems: 'center',
            }}>
              <Ionicons name="football-outline" size={22} color={c.textMuted} style={{ marginBottom: 8 }} />
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 26, fontWeight: '900', color: c.text, marginBottom: 2 }}>
                {profile.matches_played}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                Partidos
              </Text>
            </View>

            {/* Nivel */}
            <View style={{
              flex: 1,
              backgroundColor: c.bgElev,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              alignItems: 'center',
            }}>
              <Ionicons name="speedometer-outline" size={22} color={c.warning} style={{ marginBottom: 8 }} />
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 26, fontWeight: '900', color: c.warning, marginBottom: 2 }}>
                {profile.average_level > 0 ? profile.average_level.toFixed(1) : '—'}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                Nivel
              </Text>
            </View>

            {/* Actitud */}
            <View style={{
              flex: 1,
              backgroundColor: c.bgElev,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>
                {getAttitudeEmoji(profile.average_attitude)}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                Actitud
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
