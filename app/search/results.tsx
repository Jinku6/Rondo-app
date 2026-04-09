import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Match } from '@/types/database';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/empty-state';

export default function SearchResultsScreen() {
  const { location, date } = useLocalSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function fetchMatches() {
    let query = supabase
      .from('matches')
      .select('*, organizer:users(*)')
      .eq('status', 'open')
      .order('date_time', { ascending: true });

    if (location && typeof location === 'string') {
      query = query.ilike('location', `%${location}%`);
    }

    if (date && typeof date === 'string') {
      const startDate = new Date();
      if (date === 'today') {
        // Filter from now to avoid showing past matches today
      } else {
        // Expected format DD/MM/YYYY
        const [day, month, year] = date.split('/');
        if (day && month && year) {
          startDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
          startDate.setHours(0, 0, 0, 0);
        }
      }
      
      // Always exclude past matches even if a past date was somehow selected
      const now = new Date();
      const filterDate = startDate < now ? now : startDate;
      query = query.gte('date_time', filterDate.toISOString());
    } else {
      // If no date specified, search from now onwards
      query = query.gte('date_time', new Date().toISOString());
    }

    const { data, error } = await query;

    if (!error && data) {
      setMatches(data as Match[]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetchMatches();
  }, [location, date]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

  const renderMatchCard = ({ item }: { item: Match }) => {
    const d = new Date(item.date_time);
    const dateString = d.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const maxPlayers = item.requested_positions 
      ? Object.values(item.requested_positions).reduce((a: any, b: any) => a + b, 0) 
      : 0;

    return (
      <TouchableOpacity 
        onPress={() => router.push(`/match/${item.id}`)}
        className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-4 shadow-sm border border-gray-200 dark:border-gray-800"
      >
        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1">{item.title}</Text>
          <View className="flex-row gap-1 mr-2 items-center">
            {item.team_a_color && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.team_a_color }} />}
            {item.team_b_color && <View className="w-3 h-3 rounded-full" style={{ backgroundColor: item.team_b_color }} />}
          </View>
          <View className="bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">
            <Text className="text-green-800 dark:text-green-200 font-medium">Abierto</Text>
          </View>
        </View>

        <View className="space-y-2 mb-4">
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={18} color="#64748b" />
            <Text className="text-slate-600 dark:text-slate-300 ml-2">{item.location}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={18} color="#64748b" />
            <Text className="text-slate-600 dark:text-slate-300 ml-2">{dateString} - {timeString}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={18} color="#64748b" />
            <Text className="text-slate-600 dark:text-slate-300 ml-2">Buscan {maxPlayers} jugadores</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-3">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 justify-center items-center mr-2">
              <Text className="font-bold text-slate-500 dark:text-slate-400">
                {item.organizer?.full_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text className="text-slate-700 dark:text-slate-300">
              Org: {item.organizer?.full_name || item.organizer?.username}
            </Text>
          </View>
          <Text className="font-bold text-emerald-600 dark:text-emerald-400">
            {item.price_per_player > 0 ? `$${item.price_per_player}` : 'Gratis'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Resultados de búsqueda' }} />
      {loading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" /></View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchCard}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No hay partidos para esta búsqueda."
              description="Intenta buscar en otra ubicación o cambia la fecha."
            />
          }
        />
      )}
    </View>
  );
}
