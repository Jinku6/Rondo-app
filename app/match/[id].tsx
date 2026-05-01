import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ArrowRight, ChevronRight, Share2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Match,
  MatchLevel,
  MatchParticipant,
  PositionKey,
  RequestedPositions,
} from '@/types/database';
import { Colors } from '@/constants/theme';
import CancelMatchModal, { CancelWindow } from '@/components/CancelMatchModal';

const c = Colors;

// ─── config maps ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
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

const STATUS_CONFIG: Record<
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

const POSITION_CONFIG: Record<PositionKey, { icon: string; label: string }> = {
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

const AVATAR_COLOR_CLASSES = [
  'bg-[#a855f7]',
  'bg-[#f59e0b]',
  'bg-[#10b981]',
  'bg-[#3b82f6]',
  'bg-[#ec4899]',
  'bg-[#ef4444]',
  'bg-[#06b6d4]',
  'bg-[#84cc16]',
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(iso: string): string {
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

function avatarColorClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLOR_CLASSES[Math.abs(h) % AVATAR_COLOR_CLASSES.length];
}

function initials(name: string): string {
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function reliabilityLabel(score: number): string {
  if (score >= 90) return '✅ Nunca falta';
  if (score >= 75) return '🌟 Casi nunca falta';
  if (score >= 50) return '⚠️ Falta con frecuencia';
  return '🚫 Falta casi siempre';
}

function totalSlots(req: RequestedPositions): number {
  return Object.values(req).reduce((acc, n) => acc + (n as number), 0);
}

function positionChips(req: RequestedPositions): { key: PositionKey; count: number }[] {
  return (Object.entries(req) as [PositionKey, number][]).filter(([, n]) => n > 0).map(
    ([key, count]) => ({ key, count }),
  );
}

const getCancelWindow = (matchTime: number): CancelWindow => {
  const hoursLeft = (matchTime - Date.now()) / 3600000;
  if (hoursLeft > 48) return '48h_plus';
  if (hoursLeft > 24) return '24_48h';
  if (hoursLeft > 4)  return '4_24h';
  return 'sub_4h';
};

interface MapOption { titulo: string; url: string; nativo: string }

function buildMapOptions(lat: number, lng: number): MapOption[] {
  return [
    {
      titulo: 'Google Maps',
      url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      nativo: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    },
    {
      titulo: 'Waze',
      url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      nativo: `waze://?ll=${lat},${lng}&navigate=yes`,
    },
    ...(Platform.OS === 'ios'
      ? [{ titulo: 'Apple Maps', url: `maps://?daddr=${lat},${lng}&dirflg=d`, nativo: `maps://?daddr=${lat},${lng}&dirflg=d` }]
      : []),
  ];
}

async function abrirOpcionMapa(opcion: MapOption) {
  const soportado = await Linking.canOpenURL(opcion.nativo);
  Linking.openURL(soportado ? opcion.nativo : opcion.url);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Badge({
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
    <View style={[s.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function InfoCell({
  label,
  flex,
  children,
}: {
  label: string;
  flex?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.infoCell, flex != null && { flex }]}>
      <Text style={s.infoCellLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PlayerRow({
  participant,
  onPress,
  rightContent,
  isLast = false,
  isOverflow = false,
  overflowCount = 0,
}: {
  participant?: MatchParticipant;
  onPress?: () => void;
  rightContent?: React.ReactNode;
  isLast?: boolean;
  isOverflow?: boolean;
  overflowCount?: number;
}) {
  const name = isOverflow ? 'Otros' : participant?.user?.full_name ?? 'Jugador';
  const pos = participant?.user?.preferred_position;
  const posCfg = pos ? POSITION_CONFIG[pos as PositionKey] : null;
  const positionLabel = isOverflow ? 'Ver todos' : posCfg?.label;
  const avatarText = isOverflow ? `+${overflowCount}` : initials(name);

  return (
    <Pressable
      className={`flex-row items-center justify-between py-3 ${isLast ? '' : 'border-b-[0.5px] border-white/10'} ${isOverflow ? 'opacity-50' : ''}`}
      style={({ pressed }) => pressed && { opacity: isOverflow ? 0.35 : 0.65 }}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={isOverflow ? 'Ver todos los jugadores apuntados' : `Ver perfil de ${name}`}
    >
      <View className="flex-row items-center gap-3 flex-1 min-w-0">
        <View className={`h-9 w-9 shrink-0 items-center justify-center rounded-full ${isOverflow ? 'bg-[#8A938F]' : avatarColorClass(name)}`}>
          <Text className="text-white text-[13px] font-black font-display">{avatarText}</Text>
        </View>
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

// ─── screen ───────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapOptions, setMapOptions] = useState<MapOption[]>([]);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelWindow, setCancelWindow] = useState<CancelWindow>('48h_plus');
  const joiningRef = useRef(false);

  async function fetchMatchDetails() {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*, organizer:users(*, phone_data:user_private_data(phone))')
        .eq('id', id)
        .single();

      if (matchError || !matchData) {
        Alert.alert('Error', 'No se pudo cargar el partido');
        router.back();
        return;
      }

      setMatch(matchData as Match);

      const { data: partData, error: partError } = await supabase
        .from('match_participants')
        .select('*, user:users(*, phone_data:user_private_data(phone))')
        .eq('match_id', id);

      if (!partError && partData) {
        setParticipants(partData as MatchParticipant[]);
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudieron cargar los detalles del partido.');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatchDetails();
  }, [id]);

  const handleJoin = async () => {
    if (!user || !match || joiningRef.current) return;
    joiningRef.current = true;
    setActionLoading(true);
    const status = match.requires_approval ? 'pending' : 'joined';
    const { error } = await supabase.from('match_participants').insert({
      match_id: match.id,
      user_id: user.id,
      status,
    });
    joiningRef.current = false;
    setActionLoading(false);
    if (error) {
      Alert.alert('Error al unirse', error.message);
    } else {
      Alert.alert(
        '¡Listo!',
        match.requires_approval
          ? 'Solicitud enviada al organizador'
          : '¡Te has unido al partido!'
      );
      fetchMatchDetails();
    }
  };

  const handleLeave = () => {
    if (!user || !match) return;
    const win = getCancelWindow(new Date(match.date_time).getTime());

    if (win === '48h_plus') {
      Alert.alert('Abandonar partido', '¿Seguro que quieres darte de baja?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Darme de baja', style: 'destructive', onPress: () => executeLeave(win) },
      ]);
    } else {
      setCancelWindow(win);
      setCancelModalVisible(true);
    }
  };

  const executeLeave = async (win: CancelWindow) => {
    if (!user || !match) return;
    setActionLoading(true);
    try {
      if (win === '48h_plus') {
        const { error } = await supabase
          .from('match_participants')
          .delete()
          .eq('match_id', match.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const attended = win === '24_48h';
        const { error } = await supabase
          .from('match_participants')
          .update({ status: 'dropped', attended })
          .eq('match_id', match.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      fetchMatchDetails();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo procesar la baja');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (participantId: string) => {
    const { error } = await supabase
      .from('match_participants')
      .update({ status: 'joined' })
      .eq('id', participantId);
    if (error) {
      Alert.alert('Error', 'No se pudo aprobar al jugador');
      return;
    }
    fetchMatchDetails();
  };

  const handleReject = async (participantId: string) => {
    const { error } = await supabase
      .from('match_participants')
      .update({ status: 'rejected' })
      .eq('id', participantId);
    if (error) {
      Alert.alert('Error', 'No se pudo rechazar al jugador');
      return;
    }
    fetchMatchDetails();
  };

  const handleFinalize = () => {
    if (!match) return;
    Alert.alert(
      'Finalizar Partido',
      '¿Estás seguro de que quieres finalizar este partido? Se generarán las notificaciones de valoración.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error: updateError } = await supabase
                .from('matches')
                .update({ status: 'completed' })
                .eq('id', match.id);
              if (updateError) throw updateError;

              await supabase
                .from('match_participants')
                .update({ status: 'rejected' })
                .eq('match_id', match.id)
                .eq('status', 'pending');

              await supabase.from('notifications').insert({
                user_id: user!.id,
                match_id: match.id,
                type: 'pending_organizer_review',
              });

              Alert.alert(
                '✅ Partido finalizado',
                'Ahora puedes pasar lista y confirmar quién asistió.',
                [
                  {
                    text: 'Pasar Lista',
                    onPress: () =>
                      router.replace(`/match/review-organizer/${match.id}` as any),
                  },
                ]
              );
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : String(error));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelMatch = () => {
    if (!match) return;
    Alert.alert(
      'Cancelar Partido',
      getCancelWindow(new Date(match.date_time).getTime()) !== '48h_plus'
        ? 'Cancelas con menos de 48h de antelación. Esto quedará registrado en tu historial de organizador.'
        : 'Al cancelar, todos los jugadores serán notificados.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar partido',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('matches')
                .update({ status: 'cancelled' })
                .eq('id', match.id);
              if (error) throw error;

              await supabase
                .from('match_participants')
                .update({ status: 'rejected' })
                .eq('match_id', match.id)
                .eq('status', 'pending');

              Alert.alert('Partido cancelado', 'El partido ha sido cancelado.', [
                { text: 'Aceptar', onPress: () => router.replace('/(tabs)/mymatches') },
              ]);
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : String(error));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openMaps = () => {
    if (!match) return;
    const lat = match.location_lat;
    const lng = match.location_lng;

    if (lat && lng) {
      const opciones = buildMapOptions(lat, lng);
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [...opciones.map(o => o.titulo), 'Cancelar'],
            cancelButtonIndex: opciones.length,
            title: 'Abrir en...',
          },
          index => {
            if (index < opciones.length) abrirOpcionMapa(opciones[index]);
          }
        );
      } else {
        setMapOptions(opciones);
        setMapModalVisible(true);
      }
    } else {
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(match.location)}`
      );
    }
  };

  const handleShare = () => {
    // Basic share implementation (could be more advanced)
    Alert.alert('Compartir', 'Función de compartir próximamente');
  };

  if (loading || !match) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  const isOrganizer = user?.id === match.organizer_id;
  const isArchived = match.status === 'completed' || match.status === 'cancelled';
  const myParticipation = participants.find(p => p.user_id === user?.id);
  const isJoined = myParticipation?.status === 'joined' || myParticipation?.status === 'approved';
  const isPending = myParticipation?.status === 'pending';

  const levelCfg = LEVEL_CONFIG[match.level];
  const statusCfg = STATUS_CONFIG[match.status] ?? STATUS_CONFIG.open;
  const organizer = match.organizer;
  const joinedParticipants = participants.filter(p => p.status === 'joined' || p.status === 'approved');
  const pendingParticipants = participants.filter(p => p.status === 'pending');
  
  // Exclude organizer from players list if needed (Stadium rule #14)
  const nonOrganizerApproved = joinedParticipants.filter(p => p.user_id !== match.organizer_id);
  const visiblePlayerLimit = 3;
  const visiblePlayers = nonOrganizerApproved.slice(0, visiblePlayerLimit);
  const hiddenPlayersCount = Math.max(nonOrganizerApproved.length - visiblePlayerLimit, 0);

  const slots = totalSlots(match.requested_positions);
  const filled = joinedParticipants.length;
  const slotsLeft = slots - filled;
  const lowSlots = slotsLeft <= 2 && slotsLeft > 0;
  const chips = positionChips(match.requested_positions);

  const ctaDisabled =
    isJoined || isOrganizer || isPending || match.status === 'full' || match.status !== 'open' || isArchived;
  
  const getCtaLabel = () => {
    if (isArchived) return match.status === 'completed' ? 'Partido Finalizado' : 'Partido Cancelado';
    if (isJoined) return '✓ Apuntado';
    if (isPending) return '⏳ Pendiente';
    if (isOrganizer) return 'Tu partido';
    if (match.status === 'full') return 'Partido Completo';
    return 'Me apunto →';
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top, backgroundColor: c.bg }} />
      
      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={c.textDim} />
        </Pressable>
        {isOrganizer && !isArchived && (
          <Pressable
            style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.push(`/match/edit/${match.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Editar partido"
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={20} color={c.brand} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Título + badges ─────────────────────────────────────────── */}
        <View style={s.titleBlock}>
          <Text style={s.titleText}>{match.title.toUpperCase()}</Text>
          <View style={s.badgeRow}>
            <Badge {...levelCfg} />
            <Badge {...statusCfg} />
          </View>
          {!!match.description && (
            <Text style={s.quote}>{`"${match.description}"`}</Text>
          )}
        </View>

        {/* ── Info grid ───────────────────────────────────────────────── */}
        <View style={s.infoSection}>
          <Pressable
            style={({ pressed }) => [s.locationCard, pressed && { opacity: 0.8 }]}
            onPress={openMaps}
            accessibilityRole="link"
            accessibilityLabel={`Abrir ${match.location} en Google Maps`}
          >
            <Ionicons name="location-outline" size={18} color={c.brand} style={s.locationIcon} />
            <View style={s.locationBody}>
              <Text style={s.locationName}>{match.location}</Text>
              {!!match.location_city && (
                <Text style={s.locationCity}>{match.location_city}</Text>
              )}
              <Text style={s.locationLink}>Ver en el mapa →</Text>
            </View>
          </Pressable>

          <View style={s.infoRow}>
            <InfoCell label="Fecha" flex={1}>
              <Text style={s.infoCellValue}>{formatDate(match.date_time)}</Text>
            </InfoCell>
            <InfoCell label="Hora" flex={1}>
              <Text style={s.infoCellValue}>{formatTime(match.date_time)}</Text>
            </InfoCell>
          </View>

          <View style={s.infoRow}>
            <InfoCell label="Precio" flex={1}>
              <Text
                style={[
                  s.infoCellValue,
                  { color: match.price_per_player > 0 ? c.brand : c.textDim },
                ]}
              >
                {match.price_per_player > 0 ? `${match.price_per_player}€` : 'Gratis'}
              </Text>
            </InfoCell>
            <InfoCell label="Colores" flex={1}>
              <View style={s.swatchRow}>
                {match.team_a_color ? (
                  <View style={[s.swatch, { backgroundColor: match.team_a_color }]} />
                ) : null}
                <Text style={{ color: c.textMuted, fontSize: 10 }}>VS</Text>
                {match.team_b_color ? (
                  <View style={[s.swatch, { backgroundColor: match.team_b_color }]} />
                ) : null}
              </View>
            </InfoCell>
          </View>

          <InfoCell label="Cupos">
            <Text style={[s.cuposValue, lowSlots && { color: c.danger }]}>
              {filled}
              <Text style={s.cuposTotal}>/{slots}</Text>
            </Text>
          </InfoCell>
        </View>

        {/* ── Posiciones solicitadas ──────────────────────────────────── */}
        {chips.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Posiciones solicitadas</Text>
            <View style={s.posRow}>
              {chips.map(({ key, count }) => {
                const cfg = POSITION_CONFIG[key];
                return (
                  <View key={key} style={s.posChip}>
                    <Text style={s.posChipCount}>{count}×</Text>
                    <Text style={s.posChipLabel}>
                      {cfg.icon} {cfg.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Organizador ─────────────────────────────────────────────── */}
        {organizer && (
          <View style={s.section}>
            <View style={s.orgRow}>
              <Pressable 
                style={s.orgLeft}
                onPress={() => router.push(`/user/${organizer.id}` as any)}
              >
                <View
                  style={[s.orgAvatar, { backgroundColor: avatarColor(organizer.full_name) }]}
                >
                  <Text style={s.orgAvatarText}>{initials(organizer.full_name)}</Text>
                </View>
                <View style={s.orgInfo}>
                  <Text style={s.orgLabel}>Organiza</Text>
                  <Text style={s.orgName}>{organizer.full_name}</Text>
                  <Text style={[s.orgReliability, { color: c.brand }]}>
                    {reliabilityLabel(organizer.reliability_score)}
                  </Text>
                </View>
              </Pressable>
              {!isOrganizer && (
                <Pressable
                  style={({ pressed }) => [s.chatChip, pressed && { opacity: 0.65 }]}
                  onPress={() => router.push(`/chat/${match.id}/${user!.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Chat con el organizador"
                >
                  <Ionicons name="chatbubble-outline" size={12} color={c.textDim} />
                  <Text style={s.chatChipText}>Chat</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── CTAs / User Context ──────────────────────────────────────── */}
        <View style={s.ctaBlock}>
          {isArchived ? (
            <View style={[s.statusBanner, { backgroundColor: match.status === 'completed' ? c.brandSoft : 'rgba(239,68,68,0.1)' }]}>
              <Text style={[s.statusBannerText, { color: match.status === 'completed' ? c.brand : c.danger }]}>
                {match.status === 'completed' ? '✅ Partido finalizado' : '🚫 Partido cancelado'}
              </Text>
            </View>
          ) : isPending ? (
            <View style={s.pendingBlock}>
              <View style={s.pendingBanner}>
                <Text style={s.pendingBannerText}>⏳ Solicitud pendiente de aprobación</Text>
              </View>
              <Pressable style={s.btnLeave} onPress={handleLeave}>
                <Text style={s.btnLeaveText}>Cancelar solicitud</Text>
              </Pressable>
            </View>
          ) : isJoined ? (
            <View style={s.joinedBlock}>
              <View style={s.joinedBanner}>
                <Text style={s.joinedBannerText}>✅ ¡Estás dentro del partido!</Text>
              </View>
              <View style={s.joinedActions}>
                <Pressable 
                  style={[s.joinedBtn, { borderRightWidth: 1, borderRightColor: c.border }]}
                  onPress={() => router.push(`/chat/${match.id}/${user!.id}` as any)}
                >
                  <Ionicons name="chatbubbles-outline" size={16} color={c.brand} />
                  <Text style={s.joinedBtnText}>Chat</Text>
                </Pressable>
                <Pressable style={s.joinedBtn} onPress={handleLeave}>
                  <Text style={[s.joinedBtnText, { color: c.danger }]}>Baja</Text>
                </Pressable>
              </View>
            </View>
          ) : !isOrganizer && (
            <>
              <Pressable
                className="min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-md-r bg-brand px-5 py-3.5"
                style={({ pressed }) => [
                  s.primaryCtaShadow,
                  (ctaDisabled || pressed) && { opacity: 0.65 },
                ]}
                onPress={!ctaDisabled ? handleJoin : undefined}
                disabled={ctaDisabled || actionLoading}
                accessibilityRole="button"
                accessibilityLabel={getCtaLabel()}
              >
                {actionLoading ? (
                  <ActivityIndicator color={c.brandInk} />
                ) : (
                  <>
                    <Text className="font-display text-base font-extrabold uppercase tracking-[0.64px] text-white">
                      {getCtaLabel().replace(' →', '')}
                    </Text>
                    {!ctaDisabled && <ArrowRight size={18} color={c.brandInk} />}
                  </>
                )}
              </Pressable>
              <Pressable
                className="min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-md-r border border-white/10 bg-bg-surface px-5 py-3.5"
                style={({ pressed }) => pressed && { opacity: 0.7 }}
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel="Compartir partido"
              >
                <Share2 size={18} color={c.text} />
                <Text className="font-display text-base font-extrabold uppercase tracking-[0.64px] text-[#F4F3EE]">
                  Compartir partido
                </Text>
              </Pressable>
            </>
          )}

          {/* Organizer Panel */}
          {isOrganizer && !isArchived && (
            <View style={s.orgPanel}>
              <Text style={s.orgPanelTitle}>Panel de Organizador</Text>
              <Pressable 
                style={[s.btnPrimary, { backgroundColor: c.brand }]}
                onPress={handleFinalize}
                disabled={actionLoading}
              >
                <View style={s.btnRow}>
                  <Ionicons name="flag-outline" size={18} color="#000" />
                  <Text style={s.btnPrimaryText}>Finalizar Partido</Text>
                </View>
              </Pressable>
              <Pressable 
                style={s.btnDangerGhost}
                onPress={handleCancelMatch}
                disabled={actionLoading}
              >
                <Text style={s.btnDangerGhostText}>Cancelar Partido</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Pending Requests (Organizer Only) ────────────────────────── */}
        {isOrganizer && pendingParticipants.length > 0 && !isArchived && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Solicitudes Pendientes ({pendingParticipants.length})</Text>
            {pendingParticipants.map(p => (
              <View key={p.id} style={s.pendingCard}>
                <PlayerRow 
                  participant={p} 
                  onPress={() => router.push(`/user/${p.user?.id}` as any)}
                  isLast
                  rightContent={
                    <View className="flex-row gap-2">
                      <Pressable 
                        style={s.actionBtnCheck} 
                        onPress={() => handleApprove(p.id)}
                      >
                        <Ionicons name="checkmark" size={18} color={c.brand} />
                      </Pressable>
                      <Pressable 
                        style={s.actionBtnClose} 
                        onPress={() => handleReject(p.id)}
                      >
                        <Ionicons name="close" size={18} color={c.danger} />
                      </Pressable>
                    </View>
                  }
                />
              </View>
            ))}
          </View>
        )}

        {/* ── Jugadores ───────────────────────────────────────────────── */}
        <View style={[s.section, { borderBottomWidth: 0 }]}>
          <Text className="mb-2.5 font-mono text-[9px] font-bold uppercase tracking-[1.5px] text-[#8A938F]">
            JUGADORES APUNTADOS ({filled})
          </Text>
          {visiblePlayers.map((p, index) => (
            <PlayerRow 
              key={p.id} 
              participant={p} 
              onPress={() => router.push(`/user/${p.user?.id}` as any)} 
              isLast={hiddenPlayersCount === 0 && index === visiblePlayers.length - 1}
              rightContent={
                isOrganizer ? (
                  <Pressable 
                    onPress={() => router.push(`/chat/${match.id}/${p.user_id}` as any)}
                    className="p-1.5"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={c.brand} />
                  </Pressable>
                ) : undefined
              }
            />
          ))}
          {hiddenPlayersCount > 0 && (
            <PlayerRow
              isOverflow
              isLast
              overflowCount={hiddenPlayersCount}
            />
          )}
          {nonOrganizerApproved.length === 0 && (
            <Text style={s.emptyText}>Aún no hay otros jugadores apuntados.</Text>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <CancelMatchModal
        visible={cancelModalVisible}
        window={cancelWindow}
        onCancel={() => setCancelModalVisible(false)}
        onConfirm={() => {
          setCancelModalVisible(false);
          executeLeave(cancelWindow);
        }}
      />

      {/* Android Map Picker */}
      <Modal
        visible={mapModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => setMapModalVisible(false)}
        >
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Abrir en...</Text>
            {mapOptions.map((op) => (
              <Pressable
                key={op.titulo}
                style={s.modalOption}
                onPress={() => { setMapModalVisible(false); abrirOpcionMapa(op); }}
              >
                <Ionicons name="navigate-circle-outline" size={22} color={c.brand} />
                <Text style={s.modalOptionText}>{op.titulo}</Text>
              </Pressable>
            ))}
            <Pressable
              style={s.modalCancel}
              onPress={() => setMapModalVisible(false)}
            >
              <Text style={s.modalCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },

  // Title
  titleBlock: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  titleText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 28,
    fontWeight: '900',
    color: c.text,
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
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
  quote: {
    fontSize: 12,
    color: c.textDim,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Info section
  infoSection: {
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.12)',
    borderRadius: 14,
    padding: 14,
  },
  locationIcon: {
    marginTop: 1,
  },
  locationBody: {
    flex: 1,
    minWidth: 0,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  locationCity: {
    fontSize: 12,
    color: c.textDim,
    marginTop: 2,
  },
  locationLink: {
    fontSize: 11,
    fontWeight: '600',
    color: c.brand,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
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
  infoCellValue: {
    fontFamily: 'Archivo_900Black',
    fontSize: 16,
    fontWeight: '900',
    color: c.text,
    textAlign: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  cuposValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
  },
  cuposTotal: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 12,
    color: c.textDim,
    fontWeight: '400',
  },

  // Section
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.5,
    color: c.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Position chips
  posRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  posChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: c.brandSoft,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  posChipCount: {
    fontFamily: 'Archivo_900Black',
    fontSize: 14,
    fontWeight: '900',
    color: c.brand,
  },
  posChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.brand,
  },

  // Organizer
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orgLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orgAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orgAvatarText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
  orgInfo: {
    flex: 1,
    minWidth: 0,
  },
  orgLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.2,
    color: c.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orgName: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
    marginTop: 2,
  },
  orgReliability: {
    fontSize: 11,
    marginTop: 2,
  },
  chatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: c.border,
    flexShrink: 0,
  },
  chatChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textDim,
  },

  // CTAs
  ctaBlock: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  primaryCtaShadow: {
    shadowColor: c.brandGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  btnPrimary: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brand,
    borderRadius: 14,
    shadowColor: c.brandGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  btnPrimaryText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 16,
    fontWeight: '800',
    color: c.brandInk,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  btnGhost: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  btnGhostText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Banners
  statusBanner: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerText: {
    fontWeight: '700',
    fontSize: 14,
  },

  // Pending State
  pendingBlock: {
    gap: 10,
  },
  pendingBanner: {
    padding: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
  },
  pendingBannerText: {
    color: c.warning,
    fontWeight: '700',
    fontSize: 13,
  },
  btnLeave: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  btnLeaveText: {
    color: c.danger,
    fontSize: 13,
    fontWeight: '600',
  },

  // Joined State
  joinedBlock: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  joinedBanner: {
    backgroundColor: c.brandSoft,
    padding: 12,
    alignItems: 'center',
  },
  joinedBannerText: {
    color: c.brand,
    fontWeight: '700',
    fontSize: 13,
  },
  joinedActions: {
    flexDirection: 'row',
    backgroundColor: c.bgSurface,
  },
  joinedBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  joinedBtnText: {
    color: c.brand,
    fontWeight: '700',
    fontSize: 14,
  },

  // Organizer Panel
  orgPanel: {
    backgroundColor: c.bgElev,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  orgPanelTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: c.brand,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  btnDangerGhost: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  btnDangerGhostText: {
    color: c.danger,
    fontWeight: '700',
    fontSize: 14,
  },

  // Pending Requests
  pendingCard: {
    backgroundColor: c.bgSurface,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.1)',
  },
  actionBtnCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Player rows
  emptyText: {
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Modal (Android Maps)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: c.bgElev,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Archivo_900Black',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bgSurface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  modalOptionText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancel: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: c.textDim,
    fontWeight: '600',
  },
});
