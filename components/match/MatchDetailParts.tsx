import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type {
  MatchLevel,
  MatchParticipant,
  PositionKey,
  RequestedPositions,
} from '@/types/database';
import type { CancelWindow } from '@/components/CancelMatchModal';

const c = Colors;

export const LEVEL_CONFIG: Record<
  MatchLevel,
  { label: string; color: string; bg: string; border: string }
> = {
  tranquilo: {
    label: 'Tranquilo',
    color: c.brand,
    bg: c.brandSoft,
    border: 'rgba(34,197,94,0.3)',
  },
  medio: {
    label: 'Nivel Medio',
    color: c.warning,
    bg: 'rgba(245,158,11,0.13)',
    border: 'rgba(245,158,11,0.3)',
  },
  competitivo: {
    label: 'Competitivo',
    color: c.danger,
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
  },
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  open: {
    label: 'Abierto',
    color: c.brand,
    bg: c.brandSoft,
    border: 'rgba(34,197,94,0.3)',
  },
  full: {
    label: 'Completo',
    color: c.warning,
    bg: 'rgba(245,158,11,0.13)',
    border: 'rgba(245,158,11,0.3)',
  },
  completed: {
    label: 'Finalizado',
    color: c.textDim,
    bg: 'rgba(255,255,255,0.06)',
    border: c.border,
  },
  cancelled: {
    label: 'Cancelado',
    color: c.danger,
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.3)',
  },
};

export const POSITION_CONFIG: Record<PositionKey, { icon: string; label: string }> = {
  portero: { icon: '🧤', label: 'Portero' },
  defensa: { icon: '🛡️', label: 'Defensa' },
  mediocentro: { icon: '⚙️', label: 'Mediocentro' },
  delantero: { icon: '⚡', label: 'Delantero' },
  cualquiera: { icon: '🎯', label: 'Cualquiera' },
};

const AVATAR_COLORS = [
  '#a855f7', '#f59e0b', '#10b981', '#3b82f6',
  '#ec4899', '#ef4444', '#06b6d4', '#84cc16',
];

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function reliabilityLabel(score: number, matchesPlayed: number): string {
  if (matchesPlayed < 3) return 'Jugador en crecimiento';
  if (score >= 90) return '✅ Nunca falta';
  if (score >= 75) return '🌟 Casi nunca falta';
  if (score >= 50) return '⚠️ Falta con frecuencia';
  return '🚫 Falta casi siempre';
}

export function totalSlots(req: RequestedPositions): number {
  return Object.values(req).reduce((acc, n) => acc + (n as number), 0);
}

export function positionChips(req: RequestedPositions): { key: PositionKey; count: number }[] {
  return (Object.entries(req) as [PositionKey, number][]).filter(([, n]) => n > 0).map(
    ([key, count]) => ({ key, count }),
  );
}

export const getCancelWindow = (matchTime: number): CancelWindow => {
  const hoursLeft = (matchTime - Date.now()) / 3600000;
  if (hoursLeft > 48) return '48h_plus';
  if (hoursLeft > 24) return '24_48h';
  if (hoursLeft > 4) return '4_24h';
  return 'sub_4h';
};

export function Badge({
  label,
  color,
  bg,
  border,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function InfoCell({
  label,
  flex,
  children,
}: {
  label: string;
  flex?: number;
  children: ReactNode;
}) {
  return (
    <View style={[styles.infoCell, flex != null && { flex }]}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function ProfileAvatar({
  name,
  avatarUrl,
  size,
  textSize,
}: {
  name: string;
  avatarUrl?: string | null;
  size: number;
  textSize: number;
}) {
  const label = initials(name);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        backgroundColor: avatarColor(name),
      }}
    >
      {!!avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontFamily: 'Archivo_900Black',
            fontSize: textSize,
            fontWeight: '900',
            color: '#fff',
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

export function PlayerRow({
  participant,
  onPress,
  rightContent,
  isLast = false,
}: {
  participant?: MatchParticipant;
  onPress?: () => void;
  rightContent?: ReactNode;
  isLast?: boolean;
}) {
  const name = participant?.user?.full_name ?? 'Jugador';
  const pos = participant?.user?.preferred_position;
  const posCfg = pos ? POSITION_CONFIG[pos as PositionKey] : null;
  const positionLabel = posCfg?.label;
  const avatarUrl = participant?.user?.avatar_url;

  return (
    <Pressable
      className={`flex-row items-center justify-between py-3 ${isLast ? '' : 'border-b-[0.5px] border-white/10'}`}
      style={({ pressed }) => pressed && { opacity: 0.65 }}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Ver perfil de ${name}`}
    >
      <View className="flex-row items-center gap-3 flex-1 min-w-0">
        <ProfileAvatar
          name={name}
          avatarUrl={avatarUrl}
          size={36}
          textSize={13}
        />
        <View className="flex-1 min-w-0 flex-col">
          <Text className="text-[14px] font-semibold text-white" numberOfLines={1}>
            {name}
          </Text>
          {!!positionLabel && (
            <Text className="text-[11px] text-[#8A938F]" numberOfLines={1}>
              {positionLabel}
            </Text>
          )}
        </View>
      </View>
      <View className="ml-3 shrink-0">
        {rightContent || <ChevronRight size={16} color="#8A938F" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoCell: {
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  infoCellLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.5,
    color: c.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
});
