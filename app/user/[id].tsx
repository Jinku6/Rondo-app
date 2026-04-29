import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types/database';
import { isValidUUID, firstParam, isSafeUrl, calculateAge } from '@/lib/utils';
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';

const c = Colors;

const POSITION_LABELS: Record<string, string> = {
  portero: 'Portero',
  defensa: 'Defensa',
  mediocentro: 'Medio',
  delantero: 'Delantero',
};

function getReliabilityInfo(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excelente', color: c.brand };
  if (score >= 75) return { label: 'Buena', color: c.brand };
  if (score >= 50) return { label: 'Regular', color: c.warning };
  return { label: 'Baja', color: c.danger };
}

function getAttitudeLabel(rating: number): string {
  if (rating === 0) return 'N/A';
  if (rating >= 4) return 'Excelente';
  if (rating >= 2.5) return 'Normal';
  return 'Mejorable';
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
  const age = profile ? calculateAge(profile.birthday) : null;

  useEffect(() => {
    if (!isValidUUID(id)) { setLoading(false); return; }
    supabase.from('users').select('*').eq('id', id).single().then(({ data, error }) => {
      if (!error && data) setProfile(data as UserProfile);
      setLoading(false);
    });
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

        <Text style={{
          fontFamily: 'Archivo_900Black',
          fontSize: 17,
          fontWeight: '900',
          color: c.text,
          letterSpacing: -0.3,
        }}>
          Perfil
        </Text>

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
          {/* Años */}
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Años
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 22, fontWeight: '900', color: c.text }}>
              {age !== null ? age : '—'}
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
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Fiabilidad
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: reliability.color }}>
              {profile.matches_played >= 3 ? reliability.label : '—'}
            </Text>
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
            <Ionicons name="leaf-outline" size={32} color={c.brand} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: c.brand, marginBottom: 4 }}>Jugador nuevo</Text>
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
              <Ionicons name="happy-outline" size={22} color={getAttitudeColor(profile.average_attitude)} style={{ marginBottom: 8 }} />
              <Text style={{
                fontFamily: 'Archivo_900Black',
                fontSize: 18,
                fontWeight: '900',
                color: getAttitudeColor(profile.average_attitude),
                marginBottom: 2,
                textAlign: 'center',
              }}>
                {getAttitudeLabel(profile.average_attitude)}
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
