import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { useAuth } from '@/contexts/AuthContext';
import {
  Match,
  MatchParticipant,
} from '@/types/database';
import CancelMatchModal, { CancelWindow } from '@/components/CancelMatchModal';
import { useTheme } from '@/hooks/use-theme';
import { openDirections } from '@/lib/location/openDirections';
import {
  formatDate,
  formatTime,
  getCancelWindow,
} from '@/components/match/MatchDetailParts';
import { MatchDetailContent } from '@/components/match/MatchDetailContent';

type SeriesMatch = Match & {
  series_id?: string | null;
  is_private?: boolean;
  recruiting_public?: boolean;
};

type SeriesResponse = 'pending' | 'joined' | 'declined';

// ─── screen ───────────────────────────────────────────────────────────────────

export default function MatchDetailScreen() {
  const { colors: c } = useTheme();
  const s = createStyles(c);
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [match, setMatch] = useState<SeriesMatch | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelWindow, setCancelWindow] = useState<CancelWindow>('48h_plus');
  const joiningRef = useRef(false);

  const fetchMatchDetails = useCallback(async () => {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`*, organizer:users(${PUBLIC_USER_SELECT})`)
        .eq('id', id)
        .single();

      if (matchError || !matchData) {
        Alert.alert('Error', 'No se pudo cargar el partido');
        router.back();
        return;
      }

      setMatch(matchData as SeriesMatch);

      const { data: partData, error: partError } = await supabase
        .from('match_participants')
        .select(`*, user:users(${PUBLIC_USER_SELECT})`)
        .eq('match_id', id);

      if (!partError && partData) {
        setParticipants(partData as MatchParticipant[]);
      }
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los detalles del partido.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchMatchDetails();
  }, [fetchMatchDetails]);

  const handleJoin = async () => {
    if (!user || !match || joiningRef.current) return;
    joiningRef.current = true;
    setActionLoading(true);
    try {
      const status = match.requires_approval ? 'pending' : 'joined';
      const { error } = await supabase.from('match_participants').insert({
        match_id: match.id,
        user_id: user.id,
        status,
      });
      if (error) throw error;

      Alert.alert(
        '¡Listo!',
        match.requires_approval
          ? 'Solicitud enviada al organizador'
          : '¡Te has unido al partido!'
      );
      await fetchMatchDetails();
    } catch (error) {
      Alert.alert(
        'Error al unirse',
        error instanceof Error ? error.message : 'No se pudo completar la solicitud',
      );
    } finally {
      joiningRef.current = false;
      setActionLoading(false);
    }
  };

  const handleSeriesResponse = async (response: Exclude<SeriesResponse, 'pending'>) => {
    if (!user || !match?.series_id) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('respond_to_series_match', {
        p_match_id: match.id,
        p_response: response,
      });
      if (error) throw error;
      await fetchMatchDetails();
    } catch (error) {
      Alert.alert(
        'No pudimos guardar tu respuesta',
        error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishTeamMatch = () => {
    if (!match?.series_id) return;

    Alert.alert(
      'Publicar plazas libres',
      'Los miembros que sigan pendientes o hayan dicho que no perderán su reserva. Después, cualquiera en Rondo podrá pedir plaza y este cambio no se puede deshacer.',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Publicar plazas',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data, error } = await supabase.rpc('publish_team_match', {
                p_match_id: match.id,
              });
              if (error) throw error;
              await fetchMatchDetails();
              Alert.alert(
                'Partido público',
                `Ya funciona como cualquier partido de Rondo. Quedan ${Number(data)} plazas libres.`,
              );
            } catch (error) {
              Alert.alert(
                'No se pudieron publicar las plazas',
                error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
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
      const participant = participants.find(p => p.match_id === match.id && p.user_id === user.id);
      if (!participant) throw new Error('No se encontrÃ³ tu participaciÃ³n en este partido.');
      const { error } = await supabase.functions.invoke('cancel-participation', {
        body: { match_participant_id: participant.id, cancellation_window: win },
      });
      if (error) throw error;
      fetchMatchDetails();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo procesar la baja');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('match_participants')
        .update({ status: 'joined' })
        .eq('id', participantId);
      if (error) throw error;
      await fetchMatchDetails();
    } catch {
      Alert.alert('Error', 'No se pudo aprobar al jugador');
    }
  };

  const handleReject = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('match_participants')
        .update({ status: 'rejected' })
        .eq('id', participantId);
      if (error) throw error;
      await fetchMatchDetails();
    } catch {
      Alert.alert('Error', 'No se pudo rechazar al jugador');
    }
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
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', match.id);
              if (updateError) throw updateError;

              await supabase
                .from('match_participants')
                .update({ status: 'rejected' })
                .eq('match_id', match.id)
                .eq('status', 'pending');

              const { error: notificationError } = await supabase.from('notifications').upsert(
                {
                  user_id: user!.id,
                  match_id: match.id,
                  type: 'pending_organizer_review',
                },
                { onConflict: 'user_id,match_id,type', ignoreDuplicates: true }
              );

              if (notificationError && __DEV__) console.warn('pending organizer review notification error:', notificationError);

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
              const { error } = await supabase.functions.invoke('cancel-match', {
                body: { match_id: match.id },
              });
              if (error) throw error;

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

  const openMaps = async () => {
    if (!match) return;
    const matchWithSnapshots = match as Match & {
      latitude_snapshot?: number | null;
      longitude_snapshot?: number | null;
      location_name_snapshot?: string | null;
    };
    const latitude = matchWithSnapshots.latitude_snapshot ?? match.location_lat;
    const longitude = matchWithSnapshots.longitude_snapshot ?? match.location_lng;
    const label = matchWithSnapshots.location_name_snapshot || match.location;

    if (!latitude || !longitude) {
      Alert.alert('No hemos podido abrir la app de mapas.');
      return;
    }

    try {
      await openDirections({ latitude, longitude, label });
    } catch {
      Alert.alert('No hemos podido abrir la app de mapas.');
    }
  };

  const handleShare = async () => {
    if (!match) return;

    try {
      const matchUrl = `https://rondofc.app/match/${match.id}`;
      const message = [
        `Partido en Rondo: ${match.title}`,
        `${formatDate(match.date_time)} a las ${formatTime(match.date_time)}`,
        (match as any).location_name_snapshot || match.location,
        matchUrl,
      ].join('\n');

      await Share.share({
        title: match.title,
        message,
      });
    } catch (error) {
      Alert.alert(
        'No se pudo compartir',
        error instanceof Error ? error.message : 'Intentalo de nuevo en unos segundos.',
      );
    }
  };

  if (loading || !match) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.loadingRoot}>
          <ActivityIndicator size="large" color={c.brand} />
        </View>
      </>
    );
  }

  const isOrganizer = user?.id === match.organizer_id;
  const isArchived = match.status === 'completed' || match.status === 'cancelled';
  const myParticipation = participants.find(p => p.user_id === user?.id);
  const isSeriesMatch = Boolean(match.series_id);
  const isPrivateTeamMatch = isSeriesMatch && match.is_private === true && match.recruiting_public !== true;
  const rawSeriesResponse = myParticipation?.status as string | undefined;
  const seriesResponse: SeriesResponse | null = isPrivateTeamMatch &&
    (rawSeriesResponse === 'pending' || rawSeriesResponse === 'joined' || rawSeriesResponse === 'declined')
    ? rawSeriesResponse
    : null;
  const isJoined = myParticipation?.status === 'joined' || myParticipation?.status === 'approved';
  const isPending = myParticipation?.status === 'pending';
  const isRejected = myParticipation?.status === 'rejected';

  const matchWithSnapshots = match as Match & {
    location_name_snapshot?: string | null;
  };
  const locationLabel = matchWithSnapshots.location_name_snapshot || match.location;

  const ctaDisabled =
    isPrivateTeamMatch || isJoined || isOrganizer || isPending || isRejected || match.status === 'full' || match.status !== 'open' || isArchived;
  
  const getCtaLabel = () => {
    if (isArchived) return match.status === 'completed' ? 'Partido Finalizado' : 'Partido Cancelado';
    if (isJoined) return '✓ Apuntado';
    if (isPending) return '⏳ Pendiente';
    if (isRejected) return 'Solicitud rechazada';
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
        <MatchDetailContent
          match={match}
          participants={participants}
          isOrganizer={isOrganizer}
          isArchived={isArchived}
          isJoined={isJoined}
          isPending={isPending}
          isSeriesMatch={isSeriesMatch}
          isPrivateTeamMatch={isPrivateTeamMatch}
          seriesResponse={seriesResponse}
          ctaDisabled={ctaDisabled}
          actionLoading={actionLoading}
          locationLabel={locationLabel}
          getCtaLabel={getCtaLabel}
          onOpenMaps={openMaps}
          onOrganizerPress={organizerId => router.push(`/user/${organizerId}` as any)}
          onOrganizerChatPress={() => router.push(`/chat/${match.id}/${user!.id}` as any)}
          onJoin={handleJoin}
          onSeriesResponse={handleSeriesResponse}
          onPublishTeamMatch={handlePublishTeamMatch}
          onLeave={handleLeave}
          onFinalize={handleFinalize}
          onCancelMatch={handleCancelMatch}
          onShare={handleShare}
          onApprove={handleApprove}
          onReject={handleReject}
          onPlayerPress={playerId => {
            if (playerId) router.push(`/user/${playerId}` as any);
          }}
          onPlayerChatPress={playerId => router.push(`/chat/${match.id}/${playerId}` as any)}
        />
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
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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
});
