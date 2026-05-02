import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { firstParam, isValidUUID } from '@/lib/utils';
import { getErrorMessage, logSupabaseError } from '@/lib/supabaseErrors';

type Attitude = 'positive' | 'neutral' | 'negative';

interface PersonReview {
  user_id: string;
  name: string;
  username: string;
  isOrganizer: boolean;
  levelRating: number;
  attitude: Attitude | null;
}

export default function ReviewPlayerScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchTitle, setMatchTitle] = useState('');
  const [people, setPeople] = useState<PersonReview[]>([]);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const clearPlayerReviewNotification = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('match_id', id)
      .eq('type', 'pending_player_review');

    if (error) logSupabaseError('review-player clear notification error', error);
  };

  const fetchData = async () => {
    if (!user) return;

    if (!isValidUUID(id)) {
      Alert.alert('Error', 'Partido no valido');
      router.back();
      return;
    }

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('title, status, organizer_id, organizer:users(full_name, username)')
      .eq('id', id)
      .single();

    if (matchError || !match) {
      logSupabaseError('review-player match fetch error', matchError);
      Alert.alert('Error', 'No se pudo cargar el partido');
      router.back();
      return;
    }

    if (match.status !== 'completed') {
      Alert.alert('Aviso', 'Este partido todavia no esta listo para valorar.');
      router.back();
      return;
    }

    setMatchTitle(match.title);

    const { data: participants, error: participantsError } = await supabase
      .from('match_participants')
      .select('user_id, attended, user:users(full_name, username)')
      .eq('match_id', id)
      .in('status', ['joined', 'approved'])
      .neq('user_id', user.id);

    if (participantsError) {
      logSupabaseError('review-player participants fetch error', participantsError);
      Alert.alert('Error', getErrorMessage(participantsError, 'No se pudieron cargar los participantes.'));
      router.back();
      return;
    }

    const { data: existingReviews, error: reviewsError } = await supabase
      .from('match_reviews')
      .select('reviewee_id')
      .eq('match_id', id)
      .eq('reviewer_id', user.id);

    if (reviewsError) {
      logSupabaseError('review-player existing reviews fetch error', reviewsError);
      Alert.alert('Error', getErrorMessage(reviewsError, 'No se pudo comprobar que valoraciones ya enviaste.'));
      router.back();
      return;
    }

    const reviewedIds = new Set((existingReviews || []).map(r => r.reviewee_id as string));
    const organizer = match.organizer as { full_name?: string | null; username?: string | null } | null;
    const listByUserId = new Map<string, PersonReview>();

    if (match.organizer_id !== user.id && !reviewedIds.has(match.organizer_id)) {
      listByUserId.set(match.organizer_id, {
        user_id: match.organizer_id,
        name: organizer?.full_name || 'Organizador',
        username: organizer?.username || '',
        isOrganizer: true,
        levelRating: 0,
        attitude: null,
      });
    }

    for (const participant of participants || []) {
      if (participant.user_id === match.organizer_id) continue;
      if (participant.attended === false) continue;
      if (reviewedIds.has(participant.user_id)) continue;

      const participantUser = participant.user as { full_name?: string | null; username?: string | null } | null;
      listByUserId.set(participant.user_id, {
        user_id: participant.user_id,
        name: participantUser?.full_name || 'Jugador',
        username: participantUser?.username || '',
        isOrganizer: false,
        levelRating: 0,
        attitude: null,
      });
    }

    const list = Array.from(listByUserId.values());
    if (list.length === 0) await clearPlayerReviewNotification();

    setPeople(list);
    setLoading(false);
  };

  const setLevel = (userId: string, val: number) => {
    setPeople(prev => prev.map(p => p.user_id === userId ? { ...p, levelRating: val } : p));
  };

  const setAttitude = (userId: string, val: Attitude) => {
    setPeople(prev => prev.map(p => p.user_id === userId ? { ...p, attitude: val } : p));
  };

  const handleSave = async () => {
    const missing = people.find(p => p.levelRating === 0 || !p.attitude);
    if (missing) {
      Alert.alert('Aviso', 'Por favor, valora a todos los participantes antes de guardar.');
      return;
    }

    if (!user) return;
    setSaving(true);

    try {
      const reviewsToInsert = people.map(p => ({
        match_id: id,
        reviewer_id: user.id,
        reviewee_id: p.user_id,
        level_rating: p.levelRating,
        attitude: p.attitude,
        attended: true,
      }));

      const { error } = await supabase.from('match_reviews').insert(reviewsToInsert);
      if (error) throw error;

      await clearPlayerReviewNotification();

      Alert.alert('Gracias', 'Has valorado a todos los participantes.', [
        { text: 'Aceptar', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error) {
      logSupabaseError('review-player save error', error);
      Alert.alert('Error', getErrorMessage(error, 'No se pudieron guardar las valoraciones.'));
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating: number, onSelect: (val: number) => void) => (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onSelect(star)} className="px-1">
          <Ionicons
            name={rating >= star ? 'star' : 'star-outline'}
            size={30}
            color={rating >= star ? '#eab308' : '#cbd5e1'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-neutral-950 justify-center items-center">
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Valorar Partido' }} />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          Valora a los participantes
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 mb-6">
          {matchTitle}
        </Text>

        {people.length === 0 ? (
          <View className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 items-center">
            <Text className="text-slate-500 dark:text-slate-400">No hay participantes que valorar.</Text>
          </View>
        ) : (
          people.map((p) => (
            <View key={p.user_id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-4">
              <View className="flex-row items-center border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                <View className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full justify-center items-center mr-3">
                  <Text className="font-bold text-slate-500 dark:text-slate-400">
                    {p.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white text-base">{p.name}</Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-sm">
                    @{p.username}
                  </Text>
                </View>
              </View>

              <View className="mb-3">
                <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Nivel</Text>
                {renderStars(p.levelRating, (val) => setLevel(p.user_id, val))}
              </View>

              <View>
                <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Actitud</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { val: 'positive' as const, label: 'Positiva' },
                    { val: 'neutral' as const, label: 'Neutral' },
                    { val: 'negative' as const, label: 'Negativa' },
                  ].map((opt) => {
                    const isActive = p.attitude === opt.val;
                    return (
                      <TouchableOpacity
                        key={opt.val}
                        onPress={() => setAttitude(p.user_id, opt.val)}
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
          ))
        )}
      </ScrollView>

      <View className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <TouchableOpacity
          className="bg-green-500 rounded-xl p-4 items-center flex-row justify-center"
          onPress={handleSave}
          disabled={saving}
          style={{ minHeight: 48 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text className="text-white font-bold text-lg">Enviar Valoraciones</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
