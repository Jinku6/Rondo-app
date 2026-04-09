import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function ReviewPlayerScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [match, setMatch] = useState<any>(null);
  
  const [levelRating, setLevelRating] = useState(0);
  const [attitudeRating, setAttitudeRating] = useState(0);

  useEffect(() => {
    fetchMatchData();
  }, [id]);

  const fetchMatchData = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*, organizer:users(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'No se pudo cargar el partido');
      router.back();
      return;
    }
    setMatch(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (levelRating === 0 || attitudeRating === 0) {
      Alert.alert('Aviso', 'Por favor, puntúa el nivel y la actitud antes de guardar.');
      return;
    }

    if (!user || !match) return;
    setSaving(true);

    try {
      // Create review for the organizer/match
      await supabase.from('match_reviews').insert({
        match_id: id,
        reviewer_id: user.id,
        reviewee_id: match.organizer_id,
        level_rating: levelRating,
        attitude_rating: attitudeRating
      });

      // Delete notification
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('match_id', id)
        .eq('type', 'pending_player_review');

      Alert.alert('¡Gracias!', 'Has valorado este partido.');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderStars = (rating: number, onSelect: (val: number) => void) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onSelect(star)} className="px-1">
            <Ionicons
              name={rating >= star ? 'star' : 'star-outline'}
              size={40}
              color={rating >= star ? '#eab308' : '#cbd5e1'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
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
      <Stack.Screen options={{ title: 'Valorar Partido' }} />

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          ¿Qué tal estuvo el partido?
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 mb-8">
          Ayuda a mejorar la comunidad valorando el nivel general y la actitud de los organizadores y jugadores.
        </Text>

        <View className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 items-center mb-6">
          <Text className="text-slate-700 dark:text-slate-300 font-bold text-lg mb-4">Nivel del partido</Text>
          {renderStars(levelRating, setLevelRating)}
          <Text className="text-slate-400 dark:text-slate-500 text-sm mt-3 text-center">
            {levelRating === 1 && "Muy bajo para lo prometido"}
            {levelRating === 2 && "Bajo"}
            {levelRating === 3 && "Correcto, en lo esperado"}
            {levelRating === 4 && "Buen nivel"}
            {levelRating === 5 && "Excelente, muy parejo"}
          </Text>
        </View>

        <View className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 items-center">
          <Text className="text-slate-700 dark:text-slate-300 font-bold text-lg mb-4">Actitud y deportividad</Text>
          {renderStars(attitudeRating, setAttitudeRating)}
          <Text className="text-slate-400 dark:text-slate-500 text-sm mt-3 text-center">
            {attitudeRating === 1 && "Muy mala (conflictivo)"}
            {attitudeRating === 2 && "Regular"}
            {attitudeRating === 3 && "Normal"}
            {attitudeRating === 4 && "Buena actitud"}
            {attitudeRating === 5 && "Excepcional"}
          </Text>
        </View>
      </ScrollView>

      <View className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <TouchableOpacity 
          className="bg-green-500 rounded-xl p-4 items-center" 
          onPress={handleSave}
          disabled={saving}
          style={{ minHeight: 48 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-bold text-lg">Enviar Valoración</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
