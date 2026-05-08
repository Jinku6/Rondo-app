import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { useAuth } from '@/contexts/AuthContext';
import { MatchParticipant, UserProfile } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';

type ReviewParticipant = MatchParticipant & {
  user: UserProfile;
  attitude: 'positive' | 'neutral' | 'negative' | null;
  level_rating: number;
};

export default function ReviewOrganizerScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [participants, setParticipants] = useState<ReviewParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    // Check if 48h have passed since match was completed
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('completed_at')
      .eq('id', id)
      .single();

    if (!matchError && match?.completed_at) {
      const elapsed = Date.now() - new Date(match.completed_at).getTime();
      if (elapsed > 48 * 60 * 60 * 1000) {
        setAttendanceLocked(true);
      }
    }

    const { data, error } = await supabase
      .from('match_participants')
      .select(`*, user:users(${PUBLIC_USER_SELECT})`)
      .eq('match_id', id)
      .in('status', ['joined', 'approved'])
      .neq('user_id', user?.id);

    if (error) {
      Alert.alert('Error', error.message);
      router.back();
      return;
    }

    // Si la asistencia está bloqueada (auto-confirm), todos están como attended=true
    const initialized: ReviewParticipant[] = data.map(p => ({
      ...p,
      attended: p.attended !== null ? p.attended : true,
      attitude: null,
      level_rating: 0
    }));

    setParticipants(initialized);
    setLoading(false);
  };

  const toggleAttendance = (participantId: string) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) return { ...p, attended: !p.attended };
      return p;
    }));
  };

  const setParticipantAttitude = (participantId: string, attitude: ReviewParticipant['attitude']) => {
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, attitude } : p));
  };

  const setParticipantLevel = (participantId: string, level: number) => {
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, level_rating: level } : p));
  };

  const saveReviews = async () => {
    if (!user || savingRef.current) return;
    const missing = participants.find(p => p.attended && (p.level_rating === 0 || !p.attitude));
    if (missing) {
      Alert.alert('Atención', 'Por favor, completa el nivel y la actitud de todos los jugadores que asistieron antes de guardar.');
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      // 1. Actualizar asistencias en paralelo (solo si no está bloqueada)
      if (!attendanceLocked) {
        await Promise.all(
          participants.map(p =>
            supabase.from('match_participants').update({ attended: p.attended }).eq('id', p.id)
          )
        );
      }

      // 2. Bulk insert de todas las reviews en una sola llamada (atómico)
      const reviewsToInsert = participants.map(p => ({
        match_id: id as string,
        reviewer_id: user.id,
        reviewee_id: p.user_id,
        level_rating: p.attended ? p.level_rating : null,
        attitude: p.attended ? p.attitude : null,
        attended: p.attended,
      }));

      const { error: reviewError } = await supabase.from('match_reviews').insert(reviewsToInsert);
      if (reviewError) throw reviewError;

      // 3. Crear notificaciones pending_player_review (solo si el organizador pasó lista manualmente)
      // Si attendanceLocked=true, la Edge Function ya las creó automáticamente
      if (!attendanceLocked) {
        const attendedParticipants = participants.filter(p => p.attended);
        if (attendedParticipants.length > 0) {
          await supabase.from('notifications').insert(
            attendedParticipants.map(p => ({
              user_id: p.user_id,
              match_id: id,
              type: 'pending_player_review'
            }))
          );
        }
      }

      // 4. Marcar notificación del organizador como leída
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('match_id', id)
        .eq('type', 'pending_organizer_review');

      Alert.alert('Éxito', 'Lista guardada. Los jugadores que asistieron recibirán una notificación para valorar el partido.', [
        { text: 'Aceptar', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-neutral-950 justify-center items-center">
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Pasar Lista' }} />
      
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {attendanceLocked ? 'Valora a los jugadores' : 'Comprueba la asistencia'}
        </Text>
        {attendanceLocked ? (
          <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-6">
            <Text className="text-amber-600 dark:text-amber-400 text-sm">
              ⏰ Han pasado más de 48h desde que finalizó el partido. La asistencia se ha confirmado automáticamente para todos los jugadores.
            </Text>
          </View>
        ) : (
          <Text className="text-slate-500 dark:text-slate-400 mb-6">
            Marca quién asistió al partido y valora su nivel y actitud.
          </Text>
        )}

        {participants.length === 0 ? (
          <View className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 items-center">
            <Text className="text-slate-500 dark:text-slate-400">No hubo jugadores en este partido.</Text>
          </View>
        ) : (
          participants.map(p => (
            <View key={p.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
              <View className="flex-row items-center border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                <View className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full justify-center items-center mr-3">
                  <Text className="font-bold text-slate-500 dark:text-slate-400">
                    {p.user?.full_name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white text-base">{p.user?.full_name}</Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-sm">@{p.user?.username}</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-slate-700 dark:text-slate-300 font-medium">Asistió al partido</Text>
                <Switch
                  value={p.attended ?? false}
                  onValueChange={() => { if (!attendanceLocked) toggleAttendance(p.id); }}
                  disabled={attendanceLocked}
                  trackColor={{ false: '#ef4444', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>

              {p.attended && (
                <View className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-4">
                  <View>
                    <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Valoración General</Text>
                    <View className="flex-row space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setParticipantLevel(p.id, star)} className="px-1">
                          <Ionicons
                            name={p.level_rating >= star ? 'star' : 'star-outline'}
                            size={32}
                            color={p.level_rating >= star ? '#eab308' : '#cbd5e1'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  
                  <View>
                    <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Actitud</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {[
                        { val: 'positive', label: '🤩 Positiva' },
                        { val: 'neutral', label: '😐 Neutral' },
                        { val: 'negative', label: '😠 Negativa' }
                      ].map(opt => {
                        const isActive = p.attitude === opt.val;
                        return (
                          <TouchableOpacity
                            key={opt.val}
                            onPress={() => setParticipantAttitude(p.id, opt.val as 'positive' | 'neutral' | 'negative')}
                            className={`px-3 py-2 rounded-full border ${isActive ? 'bg-green-500/20 border-green-500' : 'bg-transparent border-gray-200 dark:border-gray-700'}`}
                          >
                            <Text className={`font-semibold text-sm ${isActive ? 'text-green-600 dark:text-green-500' : 'text-slate-600 dark:text-slate-300'}`}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <TouchableOpacity 
          className="bg-green-500 rounded-xl p-4 items-center flex-row justify-center" 
          onPress={saveReviews}
          disabled={saving}
          style={{ minHeight: 48 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text className="text-white font-bold text-lg">Guardar Lista</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
