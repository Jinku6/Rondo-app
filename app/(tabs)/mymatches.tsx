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
import { ProfileAvatar } from '@/components/match/MatchDetailParts';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage, logSupabaseError } from '@/lib/supabaseErrors';

type MyMatch = Match & { _role: 'organizer' | 'player'; _pendingCount?: number };
type MyGroup = {
  id: string;
  organizer_id: string;
  title: string;
  city: string | null;
  avatar_url: string | null;
};

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
  const { colors } = useTheme();
  const [matches, setMatches] = useState<MyMatch[]>([]);
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'organizer' | 'player'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const router = useRouter();

  async function fetchMyMatches() {
    if (!user) {
      setMatches([]);
      setGroups([]);
      setGroupsError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setGroupsError(null);
      const [organizedResult, groupsResult] = await Promise.all([
        supabase
          .from('matches')
          .select(`*, organizer:users(${PUBLIC_USER_SELECT})`)
          .eq('organizer_id', user.id)
          .order('date_time', { ascending: true }),
        supabase
          .from('match_series')
          .select('id,organizer_id,title,city,avatar_url')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (organizedResult.error) throw organizedResult.error;
      if (groupsResult.error) {
        logSupabaseError('load groups in my matches', groupsResult.error);
        setGroupsError(getErrorMessage(groupsResult.error, 'No hemos podido cargar tus equipos.'));
      } else {
        setGroups((groupsResult.data ?? []) as MyGroup[]);
      }

      const organizedList = (organizedResult.data as Match[] || []);

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

      const allMatchIds = [...organizedList, ...played].map(m => m.id);
      const participantCounts =
        allMatchIds.length > 0
          ? await supabase
              .from('match_participants')
              .select('match_id')
              .in('match_id', allMatchIds)
              .in('status', ['joined', 'approved'])
          : { data: [] };

      const participantCountMap: Record<string, number> = {};
      (participantCounts.data || []).forEach(p => {
        participantCountMap[p.match_id] = (participantCountMap[p.match_id] || 0) + 1;
      });

      const pendingCountMap: Record<string, number> = {};
      (pendingData.data || []).forEach(p => {
        pendingCountMap[p.match_id] = (pendingCountMap[p.match_id] || 0) + 1;
      });

      const organizedTagged: MyMatch[] = organizedList.map(m => ({
        ...m,
        _role: 'organizer',
        _pendingCount: pendingCountMap[m.id] || 0,
        participant_count: participantCountMap[m.id] || 0,
      }));
      const playedTagged: MyMatch[] = played.map(m => ({
        ...m,
        _role: 'player',
        participant_count: participantCountMap[m.id] || 0,
      }));

      const combined = [...organizedTagged, ...playedTagged].sort(
        (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
      );

      setMatches(combined);
    } catch (error) {
      if (__DEV__) console.warn('fetch my matches error:', error);
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
        className={`flex-row bg-surface rounded-xl overflow-hidden mb-4 border border-border border-t-4 ${borderColorClass} ${isArchived ? 'opacity-60' : 'opacity-100'}`}
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
            <Ionicons name="location-outline" size={14} color={colors.textDim} />
            <Text className="font-body text-ink-dim text-xs ml-1 flex-1" numberOfLines={1}>
              {item.location}
            </Text>
          </View>

          {/* Separator */}
          <View className="border-t border-dashed border-border mb-3" />

          {/* Footer Row */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              {/* Stack Avatars */}
              <View className="flex-row items-center">
                <View className="w-6 h-6 rounded-full bg-surface2 border border-surface z-20 items-center justify-center">
                  <Ionicons name="person" size={12} color={colors.textDim} />
                </View>
                <View className="w-6 h-6 rounded-full bg-surface2 border border-surface z-10 -ml-2 items-center justify-center">
                  <Ionicons name="person" size={12} color={colors.textDim} />
                </View>
                <View className="w-6 h-6 rounded-full bg-surface2 border border-surface z-0 -ml-2 items-center justify-center">
                  <Ionicons name="person" size={12} color={colors.textDim} />
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

            <View className="mb-6">
              <Text className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-dim mb-3">
                Mis equipos
              </Text>
              {groupsError && (
                <View className="rounded-xl border border-danger/30 bg-danger/10 p-4 mb-3">
                  <Text className="font-body text-sm font-semibold text-danger">No hemos podido cargar tus equipos.</Text>
                  <Text className="font-body text-xs leading-5 text-ink-dim mt-1">{groupsError}</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar la carga de equipos"
                    activeOpacity={0.7}
                    onPress={() => void fetchMyMatches()}
                    className="min-h-12 self-start flex-row items-center justify-center mt-2"
                  >
                    <Ionicons name="refresh-outline" size={18} color={colors.danger} />
                    <Text className="font-body text-sm font-bold text-danger ml-2">Probar otra vez</Text>
                  </TouchableOpacity>
                </View>
              )}
              {groups.length === 0 ? (
                !groupsError && <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Crear el primer equipo"
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/create')}
                  className="min-h-[72px] flex-row items-center rounded-xl border border-dashed border-border-strong bg-surface px-4 py-3"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
                    <Ionicons name="people-outline" size={22} color={colors.brand} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-display text-sm font-extrabold text-ink">Monta tu equipo</Text>
                    <Text className="font-body text-xs leading-5 text-ink-dim">La plantilla de cada pachanga, siempre a mano.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={colors.textDim} />
                </TouchableOpacity>
              ) : (
                <View className="gap-2">
                  {groups.map(group => {
                    const organizesGroup = group.organizer_id === user?.id;
                    return (
                      <TouchableOpacity
                        key={group.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir equipo ${group.title}`}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/group/${group.id}` as never)}
                        className="min-h-[72px] flex-row items-center rounded-xl border border-border bg-surface px-4 py-3"
                      >
                        <ProfileAvatar name={group.title} avatarUrl={group.avatar_url} size={44} textSize={14} />
                        <View className="ml-3 flex-1 min-w-0">
                          <Text className="font-display text-[15px] font-extrabold text-ink" numberOfLines={1}>{group.title}</Text>
                          <Text className="font-body text-xs text-ink-dim mt-1" numberOfLines={1}>
                            {group.city || 'Sin ciudad definida'}
                          </Text>
                        </View>
                        <View className={`ml-3 rounded-full border px-2 py-1 ${organizesGroup ? 'border-warning/30 bg-warning/10' : 'border-brand/30 bg-brand/10'}`}>
                          <Text className={`font-mono text-[9px] font-bold uppercase tracking-wider ${organizesGroup ? 'text-warning' : 'text-brand'}`}>
                            {organizesGroup ? 'Organizo' : 'Plantilla'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textDim} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* SegmentedTabs */}
            <View className="flex-row bg-surface p-1 rounded-xl mb-6">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowArchived(false)}
                className={`flex-1 items-center justify-center py-3 rounded-lg ${!showArchived ? 'bg-brand border border-brand' : 'bg-input/5 border border-border'}`}
              >
                <Text className={`font-display uppercase text-xs tracking-wider ${!showArchived ? 'text-white' : 'text-ink-dim'}`}>Activos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowArchived(true)}
                className={`flex-1 items-center justify-center py-3 rounded-lg ${showArchived ? 'bg-input/15 border border-border-strong' : 'bg-input/5 border border-border'}`}
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
                  className="bg-surface border border-border px-5 py-3 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name="search-outline" size={18} color={colors.textDim} />
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
