import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/theme';
import type { Match } from '@/types/database';

const c = Colors;

interface MatchCardProps {
  match: Match & {
    participants?: { status: string }[];
    organizer?: { full_name?: string; username?: string } | null;
  };
  onPress: () => void;
}

const LEVEL_CONFIG = {
  tranquilo:   { emoji: '😌', label: 'Tranquilo',   bg: 'rgba(34,197,94,0.13)',  color: c.brand,   border: 'rgba(34,197,94,0.3)'  },
  medio:       { emoji: '⚽', label: 'Medio',       bg: 'rgba(245,158,11,0.13)', color: c.warning, border: 'rgba(245,158,11,0.3)' },
  competitivo: { emoji: '🔥', label: 'Competitivo', bg: 'rgba(239,68,68,0.12)',  color: c.danger,  border: 'rgba(239,68,68,0.3)'  },
} as const;

const DOW_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  const d = new Date(match.date_time);
  const dow = DOW_ES[d.getDay()];
  const day = d.getDate();
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const maxPlayers = match.requested_positions
    ? Object.values(match.requested_positions as Record<string, number>).reduce((a, b) => a + b, 0)
    : 0;
  const joinedCount = match.participants?.filter(
    p => p.status === 'joined' || p.status === 'approved',
  ).length ?? 0;

  const level = LEVEL_CONFIG[match.level] ?? LEVEL_CONFIG.medio;

  const organizerInitial = (
    match.organizer?.full_name ?? match.organizer?.username ?? '?'
  ).charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: c.bgSurface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
      }}
    >
      {/* Date block — gradient simulated with overlay */}
      <View style={{ width: 68, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4 }}>
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', backgroundColor: '#22C55E', opacity: 0.6 }}
          pointerEvents="none"
        />
        <Text style={{ fontFamily: Fonts.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' }}>
          {dow}
        </Text>
        <Text style={{ fontFamily: Fonts.display, fontSize: 28, fontWeight: '900', lineHeight: 30, color: '#fff', marginVertical: 2 }}>
          {day}
        </Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, fontWeight: '700', color: '#fff' }}>
          {time}
        </Text>
      </View>

      {/* Card body */}
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 13, paddingVertical: 11, gap: 5 }}>

        {/* Row 1: title + level badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <Text
            style={{ fontFamily: Fonts.display, fontSize: 15, fontWeight: '800', textTransform: 'uppercase', lineHeight: 17, color: c.text, flex: 1 }}
            numberOfLines={1}
          >
            {match.title}
          </Text>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
            backgroundColor: level.bg, borderWidth: 1, borderColor: level.border,
            flexShrink: 0,
          }}>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 10, fontWeight: '700', color: level.color, letterSpacing: 0.6 }}>
              {level.emoji} {level.label}
            </Text>
          </View>
        </View>

        {/* Row 2: location */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="location-outline" size={12} color={c.textDim} />
          <Text style={{ fontSize: 11, color: c.textDim, flex: 1 }} numberOfLines={1}>
            {match.location}
          </Text>
        </View>

        {/* Row 3: avatar stack + slots + price */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 6, borderTopWidth: 1, borderTopColor: c.border,
          borderStyle: 'dashed', marginTop: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {/* Avatar stack */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: c.brandSoft, borderWidth: 2, borderColor: c.bgSurface,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: Fonts.display, fontSize: 10, fontWeight: '900', color: c.brand }}>
                  {organizerInitial}
                </Text>
              </View>
              {joinedCount > 1 && (
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: c.brand, borderWidth: 2, borderColor: c.bgSurface,
                  alignItems: 'center', justifyContent: 'center', marginLeft: -8,
                }}>
                  <Text style={{ fontFamily: Fonts.display, fontSize: 9, fontWeight: '900', color: '#0a140d' }}>
                    +{joinedCount}
                  </Text>
                </View>
              )}
            </View>
            {/* Slot count */}
            <Text style={{ fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700' }}>
              <Text style={{ color: c.brand }}>{joinedCount}</Text>
              <Text style={{ color: c.textMuted }}>/{maxPlayers}</Text>
            </Text>
          </View>

          {/* Price */}
          <Text style={{ fontFamily: Fonts.display, fontSize: 14, fontWeight: '900', color: c.brand }}>
            {match.price_per_player > 0 ? `${match.price_per_player}€` : 'Gratis'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};
