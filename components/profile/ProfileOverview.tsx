import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { UserProfile } from '@/types/database';
import { calculateAge, isSafeUrl } from '@/lib/utils';
import {
  formatMemberSince,
  getAttitudeEmoji,
  getReliabilityInfo,
  POSITION_LABELS,
} from '@/components/profile/profileDisplay';

const c = Colors;

interface ProfileOverviewProps {
  profile: UserProfile;
  uploading?: boolean;
  onPickImage?: () => void;
}

export function ProfileOverview({ profile, uploading = false, onPickImage }: ProfileOverviewProps) {
  const age = calculateAge(profile.birthday);
  const reliability = getReliabilityInfo(profile.reliability_score);

  return (
    <>
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={{ position: 'relative' }}>
          {isSafeUrl(profile.avatar_url) ? (
            <Image
              source={{ uri: profile.avatar_url! }}
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                borderWidth: 3,
                borderColor: c.brand,
                marginBottom: 16,
              }}
            />
          ) : (
            <View style={{
              width: 132,
              height: 132,
              borderRadius: 66,
              backgroundColor: c.brandSoft,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 3,
              borderColor: c.brand,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 52, color: c.brand, fontWeight: '800' }}>
                {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          {onPickImage && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
              activeOpacity={0.75}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 0,
                backgroundColor: c.brand,
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: c.bgElev,
              }}
              onPress={onPickImage}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={18} color="#fff" />}
            </TouchableOpacity>
          )}
        </View>

        <Text style={{
          fontFamily: 'Archivo_900Black',
          fontSize: 34,
          fontWeight: '900',
          color: c.text,
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

      <View style={{
        flexDirection: 'row',
        backgroundColor: c.bgElev,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.border,
        marginBottom: 14,
        overflow: 'hidden',
      }}>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Edad
          </Text>
          <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 22, fontWeight: '900', color: c.text }}>
            {age !== null ? age : '-'}
          </Text>
        </View>

        <View style={{ width: 1, backgroundColor: c.border, marginVertical: 14 }} />

        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Posición
          </Text>
          <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: c.text, textAlign: 'center' }}>
            {profile.preferred_position
              ? POSITION_LABELS[profile.preferred_position] ?? profile.preferred_position
              : '-'}
          </Text>
        </View>

        <View style={{ width: 1, backgroundColor: c.border, marginVertical: 14 }} />

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
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: c.textMuted }}>-</Text>
          )}
        </View>
      </View>

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
          <Text style={{ fontSize: 15, fontWeight: '800', color: c.brand, marginBottom: 4 }}>
            Jugador en crecimiento
          </Text>
          <Text style={{ fontSize: 13, color: c.textDim, textAlign: 'center', lineHeight: 20 }}>
            Las estadísticas se desbloquean al completar 3 partidos valorados ({profile.matches_played}/3).
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
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
              {profile.average_level > 0 ? profile.average_level.toFixed(1) : '-'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
              Nivel
            </Text>
          </View>
        </View>
      )}
    </>
  );
}
