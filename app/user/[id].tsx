import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStats } from '@/components/ProfileStats';
import { isValidUUID, firstParam, isSafeUrl, calculateAge } from '@/lib/utils';

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const age = profile ? calculateAge(profile.birthday) : null;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isValidUUID(id)) {
      setLoading(false);
      return;
    }
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

  if (loading) return <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-neutral-950"><ActivityIndicator size="large" color="#22C55E" /></View>;
  if (!profile) return <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-neutral-950"><Text className="text-slate-900 dark:text-white">Usuario no encontrado</Text></View>;

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Perfil de Jugador' }} />
      
      {/* Header Profile */}
      <View className="items-center pt-10 pb-6 border-b border-slate-200 dark:border-gray-800">
        {isSafeUrl(profile.avatar_url) ? (
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
        
        <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{profile.full_name}</Text>
        <Text className="text-slate-500 dark:text-slate-400 text-lg mb-3">@{profile.username}</Text>

        <View className="flex-row gap-2 mb-2 flex-wrap justify-center">
          {age !== null && (
            <View className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full border border-blue-200 dark:border-blue-800">
              <Text className="text-blue-700 dark:text-blue-300 font-medium">{age} años</Text>
            </View>
          )}
          {profile.preferred_position && (
            <View className="bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-full border border-green-200 dark:border-green-800">
              <Text className="text-green-700 dark:text-green-300 font-medium capitalize">
                {profile.preferred_position}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Dashboard */}
      <View className="p-6 space-y-4">
        <Text className="text-slate-900 dark:text-white font-bold text-xl mb-4">Estadísticas en Rondo</Text>
        <ProfileStats profile={profile} />
      </View>
    </ScrollView>
  );
}
