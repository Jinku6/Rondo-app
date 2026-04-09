import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Match } from '@/types/database';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/empty-state';

type MyMatch = Match & { _role: 'organizer' | 'player' };

export default function MyMatchesScreen() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'organizer' | 'player'>('all');
  const router = useRouter();

  async function fetchMyMatches() {
    if (!user) return;

    // Partidos organizados
    const { data: organized } = await supabase
      .from('matches')
      .select('*, organizer:users(*)')
      .eq('organizer_id', user.id)
      .order('date_time', { ascending: true });

    // IDs de partidos en que estoy apuntado (no como org)
    const { data: participations } = await supabase
      .from('match_participants')
      .select('match_id')
      .eq('user_id', user.id)
      .in('status', ['joined', 'approved', 'pending']);

    const participatedIds = (participations || []).map(p => p.match_id);
    const organizedIds = (organized || []).map(m => m.id);
    const onlyParticipatedIds = participatedIds.filter(pid => !organizedIds.includes(pid));

    let played: Match[] = [];
    if (onlyParticipatedIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select('*, organizer:users(*)')
        .in('id', onlyParticipatedIds)
        .order('date_time', { ascending: true });
      played = (data as Match[]) || [];
    }

    const organizedTagged: MyMatch[] = (organized as Match[] || []).map(m => ({ ...m, _role: 'organizer' }));
    const playedTagged: MyMatch[] = played.map(m => ({ ...m, _role: 'player' }));

    // Sort combined by date
    const combined = [...organizedTagged, ...playedTagged].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );

    setMatches(combined);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { fetchMyMatches(); }, [user]));

  const onRefresh = () => { setRefreshing(true); fetchMyMatches(); };

  const renderCard = ({ item }: { item: MyMatch }) => {
    const date = new Date(item.date_time);
    const dateString = date.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const maxPlayers = item.requested_positions
      ? Object.values(item.requested_positions).reduce((a: number, b: number) => a + b, 0)
      : 0;

    const isOrganizer = item._role === 'organizer';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/match/${item.id}`)}
        className="bg-white dark:bg-gray-900 rounded-xl mb-4 shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
      >
        {/* Role stripe */}
        <View className={`h-1.5 w-full ${isOrganizer ? 'bg-purple-500' : 'bg-emerald-500'}`} />

        <View className="p-4">
          <View className="flex-row justify-between items-start mb-3">
            <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1 mr-3">{item.title}</Text>
            <View className={`px-3 py-1 rounded-full ${isOrganizer ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}`}>
              <Text className={`text-xs font-bold ${isOrganizer ? 'text-purple-700 dark:text-purple-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {isOrganizer ? '👑 Organizador' : '⚽ Jugador'}
              </Text>
            </View>
          </View>

          <View className="space-y-1.5 mb-3">
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={16} color="#64748b" />
              <Text className="text-slate-600 dark:text-slate-300 ml-2 text-sm">{item.location}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="#64748b" />
              <Text className="text-slate-600 dark:text-slate-300 ml-2 text-sm capitalize">{dateString} · {timeString}</Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-slate-700 pt-3">
            <View className="flex-row items-center gap-2">
              {item.team_a_color && <View className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: item.team_a_color }} />}
              {item.team_b_color && <View className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: item.team_b_color }} />}
              <Text className="text-slate-400 text-sm">{maxPlayers} jugadores</Text>
            </View>

            <View className={`px-2 py-1 rounded-full ${item.status === 'open' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-slate-100 dark:bg-slate-700'}`}>
              <Text className={`text-xs font-medium ${item.status === 'open' ? 'text-green-700 dark:text-green-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {item.status === 'open' ? 'Abierto' : item.status === 'full' ? 'Completo' : item.status === 'completed' ? 'Finalizado' : 'Cancelado'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-neutral-950"><ActivityIndicator size="large" color="#22C55E" /></View>;
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <FlatList
        data={matches.filter(m => filter === 'all' || m._role === filter)}
        keyExtractor={item => item.id + item._role}
        renderItem={renderCard}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          matches.length > 0 ? (
            <View className="mb-5">
               <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-slate-700 dark:text-slate-300 font-bold ml-1">Tus Partidos Rondo</Text>
                  {filter !== 'all' && (
                    <TouchableOpacity onPress={() => setFilter('all')} className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                      <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quitar Filtro ✕</Text>
                    </TouchableOpacity>
                  )}
               </View>
               <View className="flex-row gap-4">
                  <TouchableOpacity onPress={() => setFilter(filter === 'organizer' ? 'all' : 'organizer')} className={`flex-1 border rounded-xl p-3 items-center ${filter === 'organizer' ? 'bg-purple-500 border-purple-500' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'}`}>
                    <Text className={`text-2xl font-bold ${filter === 'organizer' ? 'text-white' : 'text-purple-700 dark:text-purple-300'}`}>
                      {matches.filter(m => m._role === 'organizer').length}
                    </Text>
                    <Text className={`text-xs mt-1 ${filter === 'organizer' ? 'text-white/80' : 'text-purple-600 dark:text-purple-400'}`}>Organizo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFilter(filter === 'player' ? 'all' : 'player')} className={`flex-1 border rounded-xl p-3 items-center ${filter === 'player' ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                    <Text className={`text-2xl font-bold ${filter === 'player' ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      {matches.filter(m => m._role === 'player').length}
                    </Text>
                    <Text className={`text-xs mt-1 ${filter === 'player' ? 'text-white/80' : 'text-emerald-600 dark:text-emerald-400'}`}>Apuntado</Text>
                  </TouchableOpacity>
               </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="Sin partidos aún"
            description="Crea un partido o únete a uno existente."
            action={{
              label: 'Crear mi primer partido',
              onClick: () => router.push('/(tabs)/create')
            }}
          />
        }
      />
    </View>
  );
}
