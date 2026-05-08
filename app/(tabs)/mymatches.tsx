import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { Match } from '@/types/database';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { StatCard } from '@/components/ui/StatCard';

type MyMatch = Match & { _role: 'organizer' | 'player'; _pendingCount?: number };

const ACTIVE_STATUSES = ['open', 'full'];
const ARCHIVED_STATUSES = ['completed', 'cancelled'];

const formatDayName = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
};

const formatDayNumber = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.getDate().toString();
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export default function MyMatchesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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
      .select(`*, organizer:users(${PUBLIC_USER_SELECT})`)
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
        .select(`*, organizer:users(${PUBLIC_USER_SELECT})`)
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
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    );

    setMatches(combined);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => { fetchMyMatches(); }, [user]),
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
    const isOrganizer = item._role === 'organizer';
    const isArchived = ARCHIVED_STATUSES.includes(item.status);

    const borderColorClass = isOrganizer ? 'border-t-warning' : 'border-t-brand';
    const badgeColorClass = isOrganizer ? 'bg-warning/10 border-warning/30' : 'bg-brand/10 border-brand/30';
    const badgeTextClass = isOrganizer ? 'text-warning' : 'text-brand';
    const badgeLabel = isOrganizer ? '👑 ORGANIZO' : '⚽ APUNTADO';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/match/${item.id}`)}
        className={`flex-row bg-surface rounded-xl overflow-hidden mb-4 border border-white/5 border-t-4 ${borderColorClass} ${isArchived ? 'opacity-60' : 'opacity-100'}`}
      >
        {/* Left Block (Date/Time) */}
        <View className="bg-brand w-20 items-center justify-center py-4">
          <Text className="font-display text-white/90 text-sm tracking-wider">{formatDayName(item.date_time)}</Text>
          <Text className="font-display text-white text-3xl leading-tight -mt-1">{formatDayNumber(item.date_time)}</Text>
          <Text className="font-mono text-white/80 text-xs mt-1">{formatTime(item.date_time)}</Text>
        </View>

        {/* Right Block (Content) */}
        <View className="flex-1 p-3 px-4 justify-between">
          {/* Header row */}
          <View className="flex-row justify-between items-start mb-2">
            <Text className="font-display text-ink text-base leading-tight flex-1 mr-2" numberOfLines={2}>
              {item.title}
            </Text>
            <View className={`px-2 py-1 rounded-md border ${badgeColorClass}`}>
              <Text className={`font-display text-[10px] tracking-wider uppercase ${badgeTextClass}`}>
                {badgeLabel}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-3">
            <Ionicons name="location-outline" size={14} color="#8A938F" />
            <Text className="font-body text-ink-dim text-xs ml-1 flex-1" numberOfLines={1}>
              {item.location}
            </Text>
          </View>

          {/* Separator */}
          <View className="border-t border-dashed border-white/10 mb-3" />

          {/* Footer Row */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              {/* Stack Avatars */}
              <View className="flex-row items-center">
                <View className="w-6 h-6 rounded-full bg-surface2 border border-surface z-20 items-center justify-center">
                  <Ionicons name="person" size={12} color="#8A938F" />
                </View>
                <View className="w-6 h-6 rounded-full bg-surface2 border border-surface z-10 -ml-2 items-center justify-center">
                  <Ionicons name="person" size={12} color="#8A938F" />
                </View>
                <View className="w-6 h-6 rounded-full bg-surface2 border border-surface z-0 -ml-2 items-center justify-center">
                  <Ionicons name="person" size={12} color="#8A938F" />
                </View>
              </View>
              <Text className="font-mono text-ink-dim text-xs ml-2">{item.participant_count || 0}/{Object.values(item.requested_positions || {}).reduce((a, b) => a + (b as number), 0)}</Text>
            </View>

            {/* Status Badges */}
            <View className="flex-row items-center gap-2">
              {isOrganizer && (item._pendingCount ?? 0) > 0 && (
                <View className="bg-warning/20 px-2 py-0.5 rounded border border-warning/30">
                  <Text className="font-body text-warning text-[10px] font-semibold">{item._pendingCount} pend.</Text>
                </View>
              )}
              <View className="bg-brand/20 px-2 py-0.5 rounded border border-brand/30">
                <Text className="font-display text-brand text-[10px] uppercase">
                  {item.status === 'open' ? 'ABIERTO' : item.status === 'full' ? 'COMPLETO' : item.status}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-bg justify-center items-center">
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  const organizedCount = (showArchived ? archivedMatches : activeMatches).filter(m => m._role === 'organizer').length;
  const playerCount = (showArchived ? archivedMatches : activeMatches).filter(m => m._role === 'player').length;

  return (
    <View className="flex-1 bg-bg">
      <FlatList
        data={visibleMatches}
        keyExtractor={item => item.id + item._role}
        renderItem={renderCard}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" colors={['#22C55E']} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 16, marginBottom: 20 }}>
            {/* Header: Eyebrow + title */}
            <Text className="font-mono text-xs text-ink-dim tracking-[0.2em] uppercase mb-1">
              AGENDA
            </Text>
            <View className="flex-row justify-between items-center mb-6">
              <ScreenTitle>
                Mis Partidos
              </ScreenTitle>
            </View>

            {/* SegmentedTabs */}
            <View className="flex-row bg-surface p-1 rounded-xl mb-6">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowArchived(false)}
                className={`flex-1 items-center justify-center py-3 rounded-lg ${!showArchived ? 'bg-brand border border-brand' : 'bg-white/5 border border-white/5'}`}
              >
                <Text className={`font-display uppercase text-xs tracking-wider ${!showArchived ? 'text-white' : 'text-ink-dim'}`}>Activos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowArchived(true)}
                className={`flex-1 items-center justify-center py-3 rounded-lg ${showArchived ? 'bg-white/15 border border-white/20' : 'bg-white/5 border border-white/5'}`}
              >
                <Text className={`font-display uppercase text-xs tracking-wider ${showArchived ? 'text-white' : 'text-ink-dim'}`}>Archivados</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Cards */}
            <View className="flex-row gap-4 mb-4">
              {/* Organizo */}
              <StatCard
                label="Organizo"
                value={organizedCount}
                tone="warning"
                selected={filter === 'organizer'}
                accessibilityLabel="Filtrar partidos que organizo"
                onPress={() => setFilter(filter === 'organizer' ? 'all' : 'organizer')}
              />
              <StatCard
                label="Apuntado"
                value={playerCount}
                tone="brand"
                selected={filter === 'player'}
                accessibilityLabel="Filtrar partidos en los que estoy apuntado"
                onPress={() => setFilter(filter === 'player' ? 'all' : 'player')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center pt-10 px-6">
            <Text className="text-5xl mb-4">⚽</Text>
            <Text className="font-display text-ink-dim text-xl uppercase tracking-wider mb-2 text-center">
              ¿Listo para más?
            </Text>
            <Text className="font-body text-ink-muted text-sm text-center leading-5 mb-8">
              Busca partidos cerca de ti o publica uno nuevo para organizar con tus amigos.
            </Text>
            {!showArchived && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/create')}
                  className="bg-brand px-5 py-3 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text className="text-white font-display uppercase text-xs tracking-wider">Crear partido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/' as any)}
                  className="bg-surface border border-white/10 px-5 py-3 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name="search-outline" size={18} color="#8A938F" />
                  <Text className="text-ink-dim font-display uppercase text-xs tracking-wider">Buscar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
