import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Match } from '@/types/database';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type MyMatch = Match & { _role: 'organizer' | 'player'; _pendingCount?: number };

const ACTIVE_STATUSES = ['open', 'full'];
const ARCHIVED_STATUSES = ['completed', 'cancelled'];

export default function MyMatchesScreen() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'organizer' | 'player'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const router = useRouter();

  async function fetchMyMatches() {
    if (!user) return;

    const { data: organized } = await supabase
      .from('matches')
      .select('*, organizer:users(*)')
      .eq('organizer_id', user.id)
      .order('date_time', { ascending: true });

    const organizedList = (organized as Match[] || []);

    const [participations, pendingData] = await Promise.all([
      supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id)
        .in('status', ['joined', 'approved', 'pending']),
      organizedList.length > 0
        ? supabase
            .from('match_participants')
            .select('match_id')
            .in('match_id', organizedList.map(m => m.id))
            .eq('status', 'pending')
        : Promise.resolve({ data: [] }),
    ]);

    const participatedIds = (participations.data || []).map(p => p.match_id);
    const organizedIds = organizedList.map(m => m.id);
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

    const pendingCountMap: Record<string, number> = {};
    (pendingData.data || []).forEach(p => {
      pendingCountMap[p.match_id] = (pendingCountMap[p.match_id] || 0) + 1;
    });

    const organizedTagged: MyMatch[] = organizedList.map(m => ({ ...m, _role: 'organizer', _pendingCount: pendingCountMap[m.id] || 0 }));
    const playedTagged: MyMatch[] = played.map(m => ({ ...m, _role: 'player' }));

    const combined = [...organizedTagged, ...playedTagged].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );

    setMatches(combined);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => { fetchMyMatches(); }, [user])
  );

  const onRefresh = () => { setRefreshing(true); fetchMyMatches(); };

  const activeMatches = matches.filter(m => ACTIVE_STATUSES.includes(m.status));
  const archivedMatches = matches.filter(m => ARCHIVED_STATUSES.includes(m.status));

  const applyRoleFilter = (list: MyMatch[]) =>
    filter === 'all' ? list : list.filter(m => m._role === filter);

  const visibleMatches = showArchived
    ? applyRoleFilter(archivedMatches)
    : applyRoleFilter(activeMatches);

  const renderCard = ({ item }: { item: MyMatch }) => {
    const date = new Date(item.date_time);
    const dateString = date.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const maxPlayers = item.requested_positions
      ? Object.values(item.requested_positions).reduce((a: number, b: number) => a + b, 0)
      : 0;

    const isOrganizer = item._role === 'organizer';
    const isArchived = ARCHIVED_STATUSES.includes(item.status);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/match/${item.id}`)}
        className={`bg-white dark:bg-gray-900 rounded-xl mb-4 shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden ${isArchived ? 'opacity-75' : ''}`}
      >
        <View className={`h-1.5 w-full ${isOrganizer ? 'bg-purple-600' : 'bg-green-500'}`} />

        <View className="p-4">
          <View className="flex-row justify-between items-start mb-3">
            <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1 mr-3">{item.title}</Text>
            <View className="flex-row items-center gap-2">
              {isOrganizer && (item._pendingCount ?? 0) > 0 && (
                <View className="bg-red-500 rounded-full min-w-[22px] h-[22px] justify-center items-center px-1.5">
                  <Text className="text-white text-xs font-bold">{item._pendingCount}</Text>
                </View>
              )}
              <View className={`px-3 py-1 rounded-full ${isOrganizer ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                <Text className={`text-xs font-bold ${isOrganizer ? 'text-purple-700 dark:text-purple-300' : 'text-green-700 dark:text-green-300'}`}>
                  {isOrganizer ? 'Organizador' : 'Jugador'}
                </Text>
              </View>
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

          <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-gray-800 pt-3">
            <View className="flex-row items-center gap-2">
              {item.team_a_color && <View className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: item.team_a_color }} />}
              {item.team_b_color && <View className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: item.team_b_color }} />}
              <Text className="text-slate-400 text-sm">{maxPlayers} jugadores</Text>
            </View>

            <View className={`px-2 py-1 rounded-full ${
              item.status === 'open' ? 'bg-green-100 dark:bg-green-900/40' :
              item.status === 'full' ? 'bg-blue-100 dark:bg-blue-900/40' :
              'bg-slate-100 dark:bg-slate-700'
            }`}>
              <Text className={`text-xs font-medium ${
                item.status === 'open' ? 'text-green-700 dark:text-green-300' :
                item.status === 'full' ? 'text-blue-700 dark:text-blue-300' :
                'text-slate-500 dark:text-slate-400'
              }`}>
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

  const hasAny = matches.length > 0;
  const hasActive = activeMatches.length > 0;
  const hasArchived = archivedMatches.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top', 'bottom']}>
      <FlatList
        data={visibleMatches}
        keyExtractor={item => item.id + item._role}
        renderItem={renderCard}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" colors={['#22C55E']} />}
        ListHeaderComponent={
          <View className="mb-5">
            {/* Title row */}
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-3xl font-bold text-slate-900 dark:text-white">Mis partidos</Text>
              {filter !== 'all' && (
                <TouchableOpacity onPress={() => setFilter('all')} className="bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                  <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quitar filtro ✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Active / Archived toggle */}
            {hasAny && (
              <View className="flex-row bg-slate-200 dark:bg-gray-800 rounded-xl p-1 mb-4 border border-slate-300 dark:border-slate-700">
                <TouchableOpacity
                  onPress={() => setShowArchived(false)}
                  className={`flex-1 rounded-lg py-2 items-center ${!showArchived ? 'bg-white dark:bg-gray-700' : ''}`}
                >
                  <Text className={`text-sm font-semibold ${!showArchived ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    Activos {hasActive ? `(${activeMatches.length})` : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowArchived(true)}
                  className={`flex-1 rounded-lg py-2 items-center ${showArchived ? 'bg-white dark:bg-gray-700' : ''}`}
                >
                  <Text className={`text-sm font-semibold ${showArchived ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    Archivados {hasArchived ? `(${archivedMatches.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Role filter pills — only shown when there are matches in the current view */}
            {(showArchived ? hasArchived : hasActive) && (
              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity
                  onPress={() => setFilter(filter === 'organizer' ? 'all' : 'organizer')}
                  className={`flex-1 border rounded-xl p-3 items-center ${filter === 'organizer' ? 'bg-purple-600 border-purple-600' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'}`}
                >
                  <Text className={`text-2xl font-bold ${filter === 'organizer' ? 'text-white' : 'text-purple-700 dark:text-purple-300'}`}>
                    {(showArchived ? archivedMatches : activeMatches).filter(m => m._role === 'organizer').length}
                  </Text>
                  <Text className={`text-xs mt-1 ${filter === 'organizer' ? 'text-white/80' : 'text-purple-600 dark:text-purple-400'}`}>Organizo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilter(filter === 'player' ? 'all' : 'player')}
                  className={`flex-1 border rounded-xl p-3 items-center ${filter === 'player' ? 'bg-green-500 border-green-500' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}
                >
                  <Text className={`text-2xl font-bold ${filter === 'player' ? 'text-white' : 'text-green-700 dark:text-green-300'}`}>
                    {(showArchived ? archivedMatches : activeMatches).filter(m => m._role === 'player').length}
                  </Text>
                  <Text className={`text-xs mt-1 ${filter === 'player' ? 'text-white/80' : 'text-green-600 dark:text-green-400'}`}>Apuntado</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center mt-16 px-6">
            <View className="bg-slate-200 dark:bg-gray-800 rounded-full w-20 h-20 justify-center items-center mb-4">
              <Ionicons name="calendar-outline" size={40} color="#9ca3af" />
            </View>
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {showArchived ? 'Sin partidos archivados' : 'Sin partidos activos'}
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">
              {showArchived
                ? 'Los partidos finalizados o cancelados aparecerán aquí.'
                : 'Crea un partido o únete a uno existente para empezar.'}
            </Text>
            {!showArchived && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/create')}
                  className="bg-green-500 px-5 py-3 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text className="text-white font-bold text-sm">Crear partido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/' as any)}
                  className="bg-slate-200 dark:bg-gray-800 px-5 py-3 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name="search-outline" size={18} color="#64748b" />
                  <Text className="text-slate-700 dark:text-slate-300 font-bold text-sm">Buscar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
