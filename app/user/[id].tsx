import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
        
      if (!error && data) {
        setProfile(data as UserProfile);
      }
      setLoading(false);
    }
    fetchUser();
  }, [id]);

  const getAttitudeEmojis = (rating: number) => {
    if (rating === 0) return 'Sin valorar';
    const full = Math.floor(rating);
    return '⭐'.repeat(full) || '⭐';
  };

  if (loading) return <View className="flex-1 justify-center items-center bg-neutral-950"><ActivityIndicator size="large" color="#22C55E" /></View>;
  if (!profile) return <View className="flex-1 justify-center items-center bg-neutral-950"><Text className="text-white">Usuario no encontrado</Text></View>;

  return (
    <ScrollView className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ title: 'Perfil de Jugador' }} />
      
      {/* Header Profile */}
      <View className="items-center pt-10 pb-6 border-b border-gray-800">
        {profile.avatar_url ? (
          <Image 
            source={{ uri: `${profile.avatar_url}?t=${Date.now()}` }} 
            className="w-32 h-32 rounded-full mb-4 border-4 border-green-500/30" 
          />
        ) : (
          <View className="w-32 h-32 rounded-full bg-green-900/50 justify-center items-center mb-4 border-4 border-gray-800">
            <Text className="text-5xl text-green-400 font-bold uppercase">
              {profile.full_name?.charAt(0) || '?'}
            </Text>
          </View>
        )}
        
        <Text className="text-2xl font-bold text-white mb-1">{profile.full_name}</Text>
        <Text className="text-slate-400 text-lg mb-3">@{profile.username}</Text>
        
        {profile.preferred_position && (
          <View className="bg-green-600/20 border border-green-500/30 px-4 py-2 rounded-full">
            <Text className="text-green-400 font-medium capitalize">
              Juega de {profile.preferred_position}
            </Text>
          </View>
        )}
      </View>

      {/* Stats Dashboard */}
      <View className="p-6 space-y-4">
        <Text className="text-white font-bold text-xl mb-2">Estadísticas en Rondo</Text>
        
        <View className="flex-row gap-4 mb-2">
          {/* Partidos Jugados */}
          <View className="flex-1 bg-gray-900 p-4 rounded-2xl border border-gray-800 items-center">
            <Ionicons name="football" size={28} color="#94a3b8" className="mb-2" />
            <Text className="text-3xl font-black text-white mt-2">{profile.matches_played}</Text>
            <Text className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold">Partidos</Text>
          </View>

          {/* Fiabilidad */}
          <View className="flex-1 bg-gray-900 p-4 rounded-2xl border border-gray-800 items-center">
            <Ionicons name="checkmark-circle" size={28} color="#10b981" className="mb-2" />
            <Text className="text-3xl font-black text-emerald-400 mt-2">{profile.reliability_score}%</Text>
            <Text className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold">Asistencia</Text>
          </View>
        </View>

        <View className="bg-gray-900 p-5 rounded-2xl border border-gray-800 mt-2">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-slate-400 text-sm font-semibold uppercase mb-1">Nivel Técnico</Text>
              <Text className="text-3xl font-black text-amber-400">
                {profile.average_level > 0 ? profile.average_level.toFixed(1) : 'N/A'}
              </Text>
            </View>
            <Ionicons name="speedometer-outline" size={40} color="#fbbf24" style={{ opacity: 0.5 }} />
          </View>
          
          <View className="h-px bg-gray-800 w-full mb-6" />

          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-slate-400 text-sm font-semibold uppercase mb-1">Actitud en pista</Text>
              <Text className="text-2xl">{getAttitudeEmojis(profile.average_attitude)}</Text>
            </View>
            <Ionicons name="happy-outline" size={40} color="#fbbf24" style={{ opacity: 0.5 }} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
