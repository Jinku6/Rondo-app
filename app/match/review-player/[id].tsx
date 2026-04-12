import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface PersonReview {
  user_id: string;
  name: string;
  username: string;
  isOrganizer: boolean;
  levelRating: number;
  attitude: string | null;
}

export default function ReviewPlayerScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchTitle, setMatchTitle] = useState('');
  const [people, setPeople] = useState<PersonReview[]>([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    // Fetch match + organizer
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('title, organizer_id, organizer:users(full_name, username)')
      .eq('id', id)
      .single();

    if (matchError || !match) {
      Alert.alert('Error', 'No se pudo cargar el partido');
      router.back();
      return;
    }

    setMatchTitle(match.title);

    // Fetch participants (excluding current user)
    const { data: participants, error: pError } = await supabase
      .from('match_participants')
      .select('user_id, user:users(full_name, username)')
      .eq('match_id', id)
      .in('status', ['joined', 'approved'])
      .neq('user_id', user?.id);

    if (pError) {
      Alert.alert('Error', pError.message);
      router.back();
      return;
    }

    const organizer = match.organizer as any;
    const list: PersonReview[] = [];

    // Add organizer first (if not the current user)
    if (match.organizer_id !== user?.id) {
      list.push({
        user_id: match.organizer_id,
        name: organizer?.full_name || 'Organizador',
        username: organizer?.username || '',
        isOrganizer: true,
        levelRating: 0,
        attitude: null,
      });
    }

    // Add other participants (skip organizer to avoid duplicates)
    for (const p of participants || []) {
      if (p.user_id === match.organizer_id) continue;
      const u = p.user as any;
      list.push({
        user_id: p.user_id,
        name: u?.full_name || 'Jugador',
        username: u?.username || '',
        isOrganizer: false,
        levelRating: 0,
        attitude: null,
      });
    }

    setPeople(list);
    setLoading(false);
  };

  const setLevel = (userId: string, val: number) => {
    setPeople(prev => prev.map(p => p.user_id === userId ? { ...p, levelRating: val } : p));
  };

  const setAttitude = (userId: string, val: string) => {
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
      for (const p of people) {
        await supabase.from('match_reviews').insert({
          match_id: id,
          reviewer_id: user.id,
          reviewee_id: p.user_id,
          level_rating: p.levelRating,
          attitude: p.attitude,
          attended: true,
        });
      }

      // Mark notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('match_id', id)
        .eq('type', 'pending_player_review');

      Alert.alert('¡Gracias!', 'Has valorado a todos los participantes.', [
        { text: 'Aceptar', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
              {/* Header */}
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

              {/* Stars */}
              <View className="mb-3">
                <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Nivel</Text>
                {renderStars(p.levelRating, (val) => setLevel(p.user_id, val))}
              </View>

              {/* Attitude */}
              <View>
                <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Actitud</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { val: 'positive', label: '🤩 Positiva' },
                    { val: 'neutral', label: '😐 Neutral' },
                    { val: 'negative', label: '😠 Negativa' },
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
