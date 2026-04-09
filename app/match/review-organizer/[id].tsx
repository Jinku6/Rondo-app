import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function ReviewOrganizerScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchParticipants();
  }, [id]);

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from('match_participants')
      .select('*, user:users(*)')
      .eq('match_id', id)
      .in('status', ['joined', 'approved'])
      .neq('user_id', user?.id);

    if (error) {
      Alert.alert('Error', error.message);
      router.back();
      return;
    }

    // Por defecto todos asistieron y con actitud normal (5 estrellas virtuales). 
    // Usaremos attended=true y bad_attitude=false
    const initialized = data.map(p => ({
      ...p,
      attended: p.attended !== null ? p.attended : true,
      bad_attitude: false
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

  const toggleAttitude = (participantId: string) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) return { ...p, bad_attitude: !p.bad_attitude };
      return p;
    }));
  };

  const saveReviews = async () => {
    if (!user) return;
    setSaving(true);
    
    try {
      // 1. Guardar la asistencia
      for (const p of participants) {
        await supabase
          .from('match_participants')
          .update({ attended: p.attended })
          .eq('id', p.id);

        // Si hay actitud problemática, guardamos un review negativo de 1 estrella.
        if (p.bad_attitude) {
          await supabase.from('match_reviews').insert({
            match_id: id,
            reviewer_id: user.id,
            reviewee_id: p.user_id,
            level_rating: 3, // neutral
            attitude_rating: 1 // problematic
          });
        }
      }

      // 2. Marcar notificación como leída
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('match_id', id)
        .eq('type', 'pending_organizer_review');

      Alert.alert('Éxito', 'Valoraciones guardadas correctamente');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
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
        <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">Comprueba la asistencia</Text>
        <Text className="text-slate-500 dark:text-slate-400 mb-6">
          Marca quién asistió al partido. Si alguien tuvo mal comportamiento, puedes reportarlo.
        </Text>

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

              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-slate-700 dark:text-slate-300 font-medium">Asistió al partido</Text>
                <Switch
                  value={p.attended}
                  onValueChange={() => toggleAttendance(p.id)}
                  trackColor={{ false: '#ef4444', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-slate-700 dark:text-slate-300 font-medium">Reportar mal comportamiento</Text>
                <Switch
                  value={p.bad_attitude}
                  onValueChange={() => toggleAttitude(p.id)}
                  trackColor={{ false: '#e2e8f0', true: '#ef4444' }}
                  thumbColor="#ffffff"
                />
              </View>
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
