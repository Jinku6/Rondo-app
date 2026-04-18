import React, { useEffect, useRef, useState } from 'react';
import { Image, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking, ActionSheetIOS, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Match, MatchParticipant } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { isSafeUrl } from '@/lib/utils';
import CancelMatchModal, { CancelWindow } from '@/components/CancelMatchModal';

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

const LEVEL_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  tranquilo: { label: 'Tranquilo',   emoji: '😌', color: 'text-green-600' },
  medio:     { label: 'Medio',       emoji: '⚽', color: 'text-amber-600'   },
  competitivo:{ label: 'Competitivo', emoji: '🔥', color: 'text-red-600'     },
};

const POSITION_LABELS: Record<string, string> = {
  portero: 'Portero', defensa: 'Defensa', mediocentro: 'Medio', delantero: 'Delantero', cualquiera: 'Cualquiera',
};

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

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

      if (partError) {
        if (__DEV__) console.error('Error fetching participants:', partError.message);
      } else if (partData) {
        setParticipants(partData as MatchParticipant[]);
      }
    } catch (e) {
      if (__DEV__) console.error('fetchMatchDetails error:', e);
      Alert.alert('Error de conexión', 'No se pudieron cargar los detalles del partido.');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchMatchDetails(); }, [id]);

  const handleJoin = async () => {
    if (!user || !match || joiningRef.current) return;
    joiningRef.current = true;
    setActionLoading(true);
    const status = match.requires_approval ? 'pending' : 'joined';
    const { error } = await supabase.from('match_participants').insert({
      match_id: match.id, user_id: user.id, status
    });
    joiningRef.current = false;
    setActionLoading(false);
    if (error) {
      Alert.alert('Error al unirse', error.message);
    } else {
      Alert.alert('¡Listo!', match.requires_approval ? 'Solicitud enviada al organizador' : '¡Te has unido al partido!');
      fetchMatchDetails();
    }
  };

  const handleLeave = () => {
    if (!user || !match) return;
    const win = getCancelWindow(new Date(match.date_time).getTime());

    if (win === '48h_plus') {
      Alert.alert(
        'Abandonar partido',
        '¿Seguro que quieres darte de baja?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Darme de baja', style: 'destructive', onPress: () => executeLeave(win) },
        ]
      );
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

  const handleApprove = async (participantId: string, _userId: string) => {
    const { error } = await supabase.from('match_participants').update({ status: 'approved' }).eq('id', participantId);
    if (error) {
      Alert.alert('Error', 'No se pudo aprobar al jugador');
      if (__DEV__) console.error('Error approving participant:', error.message);
      return;
    }
    fetchMatchDetails();
  };

  const handleReject = async (participantId: string) => {
    const { error } = await supabase.from('match_participants').update({ status: 'rejected' }).eq('id', participantId);
    if (error) {
      Alert.alert('Error', 'No se pudo rechazar al jugador');
      if (__DEV__) console.error('Error rejecting participant:', error.message);
      return;
    }
    fetchMatchDetails();
  };



  if (loading || !match) {
    return <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-neutral-950"><ActivityIndicator size="large" color="#22C55E" /></View>;
  }

  const isOrganizer = user?.id === match.organizer_id;
  const isArchived = match.status === 'completed' || match.status === 'cancelled';
  const myParticipation = participants.find(p => p.user_id === user?.id);
  const maxPlayers = match.requested_positions
    ? Object.values(match.requested_positions).reduce((a: number, b: number) => a + b, 0)
    : 0;
  const approvedParticipants = participants.filter(p => p.status === 'joined' || p.status === 'approved');
  const pendingParticipants = participants.filter(p => p.status === 'pending');
  
  // Exclude organizer from players list (#14)
  const nonOrganizerApproved = approvedParticipants.filter(p => p.user_id !== match.organizer_id);
  
  const isFull = approvedParticipants.length >= maxPlayers;
  const calcAge = (birthday: string | null | undefined): number | null => {
    if (!birthday) return null;
    const birth = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const date = new Date(match.date_time);
  const dateString = date.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeString = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const levelInfo = LEVEL_CONFIG[match.level] || LEVEL_CONFIG.medio;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top', 'bottom']}>
      {/* Android: custom map picker modal */}
      <Modal
        visible={mapModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setMapModalVisible(false)}
        >
          <View style={{ backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Abrir en...</Text>
            {mapOptions.map((op) => (
              <TouchableOpacity
                key={op.titulo}
                style={{ backgroundColor: '#1f2937', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => { setMapModalVisible(false); abrirOpcionMapa(op); }}
              >
                <Ionicons name="navigate-circle-outline" size={22} color="#22C55E" style={{ marginRight: 12 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{op.titulo}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={{ backgroundColor: '#374151', borderRadius: 12, padding: 14, marginTop: 4, alignItems: 'center' }}
              onPress={() => setMapModalVisible(false)}
            >
              <Text style={{ color: '#9ca3af', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    <ScrollView className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <Stack.Screen options={{
        title: 'Detalles del Partido',
        headerRight: () => isOrganizer ? (
          <TouchableOpacity onPress={() => router.push(`/match/edit/${match.id}` as any)} className="mr-4">
            <Ionicons name="pencil-outline" size={22} color="#22C55E" />
          </TouchableOpacity>
        ) : null,
      }} />



      {/* Header */}
      <View className="bg-white dark:bg-gray-900 p-6 mb-4 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <Text className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{match.title}</Text>

        {/* Level pill */}
        <View className="flex-row items-center mb-4">
          <Text className={`text-base font-semibold ${levelInfo.color}`}>{levelInfo.emoji} Nivel {levelInfo.label}</Text>
        </View>

        {/* Description */}
        {match.description ? (
          <Text className="text-slate-600 dark:text-slate-400 mb-4 italic">&ldquo;{match.description}&rdquo;</Text>
        ) : null}

        <View className="space-y-3 mb-5">
          {match.location_lat && match.location_lng ? (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => {
                const opciones = buildMapOptions(match.location_lat!, match.location_lng!);
                if (Platform.OS === 'ios') {
                  ActionSheetIOS.showActionSheetWithOptions(
                    { options: [...opciones.map(o => o.titulo), 'Cancelar'], cancelButtonIndex: opciones.length, title: 'Abrir en...' },
                    (index) => { if (index < opciones.length) abrirOpcionMapa(opciones[index]); }
                  );
                } else {
                  setMapOptions(opciones);
                  setMapModalVisible(true);
                }
              }}
            >
              <View className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-full justify-center items-center mr-3">
                <Ionicons name="navigate" size={20} color="#22C55E" />
              </View>
              <View className="flex-1">
                <Text className="text-lg text-slate-700 dark:text-slate-300">{match.location}</Text>
                <Text className="text-xs text-green-600 dark:text-green-500 mt-0.5">Toca para abrir en mapas →</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full justify-center items-center mr-3">
                <Ionicons name="location" size={20} color="#22C55E" />
              </View>
              <Text className="text-lg text-slate-700 dark:text-slate-300 flex-1">{match.location}</Text>
            </View>
          )}
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full justify-center items-center mr-3">
              <Ionicons name="calendar" size={20} color="#22C55E" />
            </View>
            <View>
              <Text className="text-lg text-slate-700 dark:text-slate-300 capitalize">{dateString}</Text>
              <Text className="text-slate-500 dark:text-slate-400">{timeString}</Text>
            </View>
          </View>
        </View>

        {/* Stats bar */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800 flex-row justify-between items-center mb-5">
          <View className="items-center">
            <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Precio</Text>
            <Text className="text-lg font-bold text-green-600 dark:text-green-400">
              {match.price_per_player > 0 ? `${match.price_per_player}€` : 'Gratis'}
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Equipos</Text>
            <View className="flex-row gap-2 items-center">
              {match.team_a_color && <View className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: match.team_a_color }} />}
              <Text className="text-slate-400">vs</Text>
              {match.team_b_color && <View className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: match.team_b_color }} />}
            </View>
          </View>
          <View className="items-center">
            <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cupos</Text>
            <Text className="text-lg font-bold text-slate-900 dark:text-white">
              {approvedParticipants.length} / {maxPlayers}
            </Text>
          </View>
        </View>

        {/* Posiciones solicitadas (#9) */}
        {match.requested_positions && (
          <View className="mb-5">
            <Text className="text-slate-700 dark:text-slate-300 font-bold mb-3">Posiciones solicitadas</Text>
            <View className="flex-row flex-wrap gap-2">
              {Object.entries(match.requested_positions)
                .filter(([, count]) => (count as number) > 0)
                .map(([pos, count]) => (
                  <View key={pos} className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-3 py-2 rounded-lg flex-row items-center">
                    <Text className="text-green-700 dark:text-green-300 font-semibold text-sm">{count as number}x</Text>
                    <Text className="text-green-600 dark:text-green-400 text-sm ml-1 capitalize">{POSITION_LABELS[pos] || pos}</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Organizador */}
        {match.organizer && (
          <View className="mb-6">
            <Text className="text-slate-700 dark:text-slate-300 font-bold mb-3">Organizado por</Text>
            <TouchableOpacity onPress={() => router.push(`/user/${match.organizer?.id}` as any)} className="bg-white dark:bg-gray-900 p-3 rounded-xl flex-row items-center border border-slate-200 dark:border-slate-800 shadow-sm">
              {isSafeUrl(match.organizer?.avatar_url) ? (
                <Image source={{ uri: `${match.organizer?.avatar_url}?t=${Date.now()}` }} className="w-10 h-10 rounded-full mr-3 border border-slate-200" />
              ) : (
                <View className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 justify-center items-center mr-3">
                  <Text className="font-bold text-slate-500 dark:text-slate-300 text-base">
                    {match.organizer?.full_name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="font-bold text-slate-900 dark:text-white">{match.organizer?.full_name}</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs">@{match.organizer?.username}</Text>
                {/* @ts-ignore - phone_data injected via join */}
                {match.organizer?.phone_data?.[0]?.phone && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="call-outline" size={12} color="#22C55E" />
                    <Text className="text-green-600 dark:text-green-400 text-xs font-bold ml-1">
                      {/* @ts-ignore */}
                      {match.organizer.phone_data[0].phone}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        )}

        {/* Acción jugador */}
        {!isOrganizer && (
          <View>
            {match.status === 'cancelled' ? (
              <View className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
                <Text className="text-red-600 dark:text-red-400 font-semibold text-center">🚫 Este partido ha sido cancelado por el organizador</Text>
              </View>
            ) : match.status === 'completed' ? (
              <View className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                <Text className="text-green-600 dark:text-green-400 font-semibold text-center">✅ Este partido ha finalizado</Text>
              </View>
            ) : !myParticipation ? (
              <View className="space-y-3">
                <TouchableOpacity
                  className={`w-full p-4 rounded-xl items-center shadow-sm min-h-[48px] ${isFull ? 'bg-slate-300 dark:bg-gray-900' : 'bg-green-500'}`}
                  onPress={isFull ? undefined : handleJoin}
                  disabled={actionLoading || isFull}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> :
                    <Text className={`${isFull ? 'text-slate-500 dark:text-slate-400' : 'text-white'} font-bold text-lg`}>{isFull ? 'Partido Completo' : (match.requires_approval ? 'Solicitar Unirse' : '¡Unirse al Partido!')}</Text>
                  }
                </TouchableOpacity>

                {match.organizer && (
                  <TouchableOpacity
                    className="w-full p-3 rounded-xl items-center border border-green-500 flex-row justify-center"
                    onPress={() => router.push(`/chat/${match.id}/${user!.id}` as any)}
                  >
                    <Ionicons name="chatbubbles-outline" size={20} color="#22C55E" style={{ marginRight: 8 }} />
                    <Text className="text-green-600 dark:text-green-500 font-bold">Chatear con {match.organizer.full_name?.split(' ')[0]}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : myParticipation.status === 'pending' ? (
              <View>
                <View className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-xl border border-amber-200 dark:border-amber-700 mb-3">
                  <Text className="text-amber-800 dark:text-amber-400 font-semibold text-center">⏳ Solicitud pendiente de aprobación</Text>
                  <TouchableOpacity className="mt-3 py-2" onPress={handleLeave}>
                    <Text className="text-red-500 font-medium text-center">Cancelar solicitud</Text>
                  </TouchableOpacity>
                </View>
                {match.organizer && (
                  <TouchableOpacity
                    className="w-full p-3 rounded-xl items-center border border-green-500 flex-row justify-center"
                    onPress={() => router.push(`/chat/${match.id}/${user!.id}` as any)}
                  >
                    <Ionicons name="chatbubbles-outline" size={20} color="#22C55E" style={{ marginRight: 8 }} />
                    <Text className="text-green-600 dark:text-green-500 font-bold">Chatear con {match.organizer.full_name?.split(' ')[0]}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View>
                <View className="bg-green-100 dark:bg-green-900/30 p-4 rounded-t-xl border border-green-200 dark:border-green-800 border-b-0">
                  <Text className="text-green-800 dark:text-green-400 font-semibold text-center">✅ ¡Estás dentro del partido!</Text>
                </View>
                <View className="flex-row">
                  <TouchableOpacity
                    className="flex-1 bg-white dark:bg-gray-900 p-3 rounded-bl-xl border border-green-200 dark:border-green-800 items-center justify-center flex-row"
                    onPress={() => router.push(`/chat/${match.id}/${user!.id}` as any)}
                  >
                    <Ionicons name="chatbubbles-outline" size={18} color="#22C55E" style={{ marginRight: 6 }} />
                    <Text className="text-green-600 dark:text-green-400 font-medium">Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-white dark:bg-gray-900 p-3 rounded-br-xl border-t border-b border-r border-green-200 dark:border-green-800 items-center justify-center"
                    onPress={handleLeave}
                    disabled={actionLoading}
                  >
                    <Text className="text-red-500 font-medium">Darme de baja</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Panel organizador */}
        {isOrganizer && (
          <View className="bg-green-100 dark:bg-green-900/30 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <Text className="text-green-800 dark:text-green-300 font-bold text-center mb-3">👑 Eres el organizador</Text>
            
            {(match.status === 'open' || match.status === 'full') && (
              <View className="gap-3">
                <TouchableOpacity
                  className="bg-green-500 rounded-xl p-4 items-center flex-row justify-center"
                  style={{ minHeight: 48 }}
                  disabled={actionLoading}
                  onPress={() => {
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
                              // 1. Update match status
                              const { error: updateError } = await supabase
                                .from('matches')
                                .update({ status: 'completed' })
                                .eq('id', match.id);
                              if (updateError) throw updateError;

                              // 2. Rechazar automáticamente las solicitudes pendientes
                              await supabase
                                .from('match_participants')
                                .update({ status: 'rejected' })
                                .eq('match_id', match.id)
                                .eq('status', 'pending');

                              // 3. Notificación solo para el organizador (pasa lista)
                              // Las notificaciones de los jugadores se crean tras confirmar asistencia
                              await supabase.from('notifications').insert({
                                user_id: user!.id,
                                match_id: match.id,
                                type: 'pending_organizer_review'
                              });

                              Alert.alert('✅ Partido finalizado', 'Ahora puedes pasar lista y confirmar quién asistió.', [
                                { text: 'Pasar Lista', onPress: () => router.replace(`/match/review-organizer/${match.id}` as any) },
                              ]);
                            } catch (error) {
                              Alert.alert('Error', error instanceof Error ? error.message : String(error));
                            } finally {
                              setActionLoading(false);
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="flag-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                      <Text className="text-white font-bold text-lg">Finalizar Partido</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl p-4 items-center flex-row justify-center"
                  style={{ minHeight: 48 }}
                  disabled={actionLoading}
                  onPress={() => {
                    Alert.alert(
                      'Cancelar Partido',
                      getCancelWindow(new Date(match.date_time).getTime()) !== '48h_plus'
                        ? 'Cancelas con menos de 48h de antelación. Esto quedará registrado en tu historial de organizador.\n\nSi hay jugadores con pago aprobado, recibirán un reembolso automático del 100%.'
                        : 'Al cancelar, todos los jugadores serán notificados. Si hay pagos aprobados, recibirán un reembolso automático del 100%.',
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

                              // Rechazar automáticamente las solicitudes pendientes
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
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={22} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text className="text-red-500 dark:text-red-400 font-bold text-base">Cancelar Partido</Text>
                </TouchableOpacity>
              </View>
            )}

            {match.status === 'completed' && (
              <View className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <Text className="text-green-700 dark:text-green-400 text-center font-semibold text-sm">✅ Partido finalizado</Text>
              </View>
            )}

            {match.status === 'cancelled' && (
              <View className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <Text className="text-red-600 dark:text-red-400 text-center font-semibold text-sm">🚫 Partido cancelado</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Panel de solicitudes pendientes para el organizador (#10) */}
      {isOrganizer && !isArchived && pendingParticipants.length > 0 && (
        <View className="mx-4 mb-4">
          <Text className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            Solicitudes pendientes ({pendingParticipants.length})
          </Text>
          {pendingParticipants.map(p => (
            <TouchableOpacity onPress={() => router.push(`/user/${p.user?.id}` as any)} key={p.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-3 border border-amber-200 dark:border-amber-800 shadow-sm">
              <View className="flex-row items-center mb-3">
                {isSafeUrl(p.user?.avatar_url) ? (
                  <Image source={{ uri: `${p.user.avatar_url}?t=${Date.now()}` }} className="w-12 h-12 rounded-full mr-3 border border-slate-200" />
                ) : (
                  <View className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 justify-center items-center mr-3">
                    <Text className="font-bold text-amber-600 dark:text-amber-300 text-lg">
                      {p.user?.full_name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white">{p.user?.full_name}</Text>
                  <View className="flex-row items-center flex-wrap gap-x-2">
                    <Text className="text-slate-500 dark:text-slate-400 text-sm">@{p.user?.username}</Text>
                    {/* @ts-ignore */}
                    {calcAge(p.user?.birthday) !== null && (
                      <Text className="text-slate-400 dark:text-slate-500 text-xs">
                        {/* @ts-ignore */}
                        {calcAge(p.user?.birthday)} años
                      </Text>
                    )}
                  </View>
                  {p.user?.preferred_position && (
                    <Text className="text-green-600 dark:text-green-400 text-xs capitalize mt-0.5">
                      Posición: {p.user.preferred_position}
                    </Text>
                  )}
                  {/* @ts-ignore */}
                  {p.user?.phone_data?.[0]?.phone && (
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="call" size={12} color="#22C55E" />
                      <Text className="text-green-600 dark:text-green-400 text-xs font-bold ml-1">
                        {/* @ts-ignore */}
                        {p.user.phone_data[0].phone}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="items-end">
                  {(p.user?.reliability_score ?? 0) > 0 && (() => {
                    const s = p.user!.reliability_score!;
                    const { label, icon, color } =
                      s >= 90 ? { label: 'Nunca falta',        icon: '✅', color: 'text-green-500'  } :
                      s >= 75 ? { label: 'Casi nunca falta',   icon: '🌟', color: 'text-amber-500'  } :
                      s >= 50 ? { label: 'Falta con frecuencia', icon: '⚠️', color: 'text-orange-500' } :
                                { label: 'Falta casi siempre', icon: '🚫', color: 'text-red-600'    };
                    return (
                      <Text className={`text-xs font-bold ${color}`}>{icon} {label}</Text>
                    );
                  })()}
                  {(p.user?.matches_played ?? 0) > 0 && (
                    <Text className="text-xs text-slate-400">{p.user?.matches_played} partidos</Text>
                  )}
                </View>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-green-500 p-3 rounded-xl items-center"
                  onPress={() => handleApprove(p.id, p.user_id)}
                >
                  <Text className="text-white font-bold">✅ Aprobar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-3 rounded-lg items-center"
                  onPress={() => handleReject(p.id)}
                >
                  <Text className="text-red-600 dark:text-red-400 font-bold">❌ Rechazar</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Lista de Jugadores (#14: sin el organizador) */}
      <View className="p-4 pb-10">
        <Text className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Jugadores Apuntados ({nonOrganizerApproved.length})
        </Text>
        {nonOrganizerApproved.map(p => (
          <TouchableOpacity onPress={() => router.push(`/user/${p.user?.id}` as any)} key={p.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-3 flex-row items-center shadow-sm border border-gray-200 dark:border-gray-800">
            {isSafeUrl(p.user?.avatar_url) ? (
              <Image source={{ uri: `${p.user.avatar_url}?t=${Date.now()}` }} className="w-12 h-12 rounded-full mr-4 border border-slate-200" />
            ) : (
              <View className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 justify-center items-center mr-4">
                <Text className="font-bold text-slate-500 dark:text-slate-400 text-lg">
                  {p.user?.full_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="font-bold text-slate-900 dark:text-white">{p.user?.full_name}</Text>
              <Text className="text-slate-500 dark:text-slate-400 text-sm">@{p.user?.username}</Text>
              {/* @ts-ignore */}
              {p.user?.phone_data?.[0]?.phone && (
                <View className="flex-row items-center mt-1">
                  <Ionicons name="call-outline" size={12} color="#22C55E" />
                  <Text className="text-green-600 dark:text-green-400 text-xs font-bold ml-1">
                    {/* @ts-ignore */}
                    {p.user.phone_data[0].phone}
                  </Text>
                </View>
              )}
            </View>
            {p.user?.preferred_position && (
              <View className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                <Text className="text-xs font-medium text-slate-500 dark:text-slate-300 capitalize">{p.user.preferred_position}</Text>
              </View>
            )}
            {isOrganizer && (
              <TouchableOpacity 
                className="ml-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-full"
                onPress={() => router.push(`/chat/${match.id}/${p.user_id}` as any)}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color="#22C55E" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
        {nonOrganizerApproved.length === 0 && (
          <Text className="text-slate-400 italic text-center mt-4">Aún no hay jugadores apuntados</Text>
        )}
      </View>
    </ScrollView>

    <CancelMatchModal
      visible={cancelModalVisible}
      window={cancelWindow}
      onCancel={() => setCancelModalVisible(false)}
      onConfirm={() => {
        setCancelModalVisible(false);
        executeLeave(cancelWindow);
      }}
    />
    </SafeAreaView>
  );
}
