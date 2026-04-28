import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Match } from '@/types/database';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';

const c = Colors;

type MyMatch = Match & { _role: 'organizer' | 'player'; _pendingCount?: number };

const ACTIVE_STATUSES = ['open', 'full'];
const ARCHIVED_STATUSES = ['completed', 'cancelled'];

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

  const statusLabel = (status: string) => {
    if (status === 'open') return 'Abierto';
    if (status === 'full') return 'Completo';
    if (status === 'completed') return 'Finalizado';
    return 'Cancelado';
  };

  const statusColor = (status: string) => {
    if (status === 'open') return c.brand;
    if (status === 'full') return c.info;
    return c.textMuted;
  };

  const renderCard = ({ item }: { item: MyMatch }) => {
    const date = new Date(item.date_time);
    const dateString = date.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const isOrganizer = item._role === 'organizer';
    const isArchived = ARCHIVED_STATUSES.includes(item.status);
    const accentColor = isOrganizer ? '#A855F7' : c.brand;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/match/${item.id}`)}
        style={{
          backgroundColor: c.bgElev,
          borderRadius: 18,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
          opacity: isArchived ? 0.65 : 1,
        }}
      >
        {/* Top accent bar */}
        <View style={{ height: 3, backgroundColor: accentColor }} />

        <View style={{ padding: 16 }}>
          {/* Title + role badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, flex: 1, marginRight: 12 }} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isOrganizer && (item._pendingCount ?? 0) > 0 && (
                <View style={{ backgroundColor: c.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{item._pendingCount}</Text>
                </View>
              )}
              <View style={{ backgroundColor: isOrganizer ? 'rgba(168,85,247,0.15)' : c.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: isOrganizer ? 'rgba(168,85,247,0.3)' : c.brand + '44' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: accentColor, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {isOrganizer ? 'Organizo' : 'Jugador'}
                </Text>
              </View>
            </View>
          </View>

          {/* Details */}
          <View style={{ gap: 6, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={14} color={c.textDim} />
              <Text style={{ color: c.textDim, marginLeft: 6, fontSize: 13 }} numberOfLines={1}>{item.location}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={14} color={c.textDim} />
              <Text style={{ color: c.textDim, marginLeft: 6, fontSize: 13, textTransform: 'capitalize' }}>
                {dateString} · {timeString}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.team_a_color && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.team_a_color }} />}
              {item.team_b_color && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.team_b_color }} />}
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor(item.status), textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  const hasAny = matches.length > 0;
  const hasActive = activeMatches.length > 0;
  const hasArchived = archivedMatches.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={visibleMatches}
        keyExtractor={item => item.id + item._role}
        renderItem={renderCard}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 16, marginBottom: 20 }}>
            {/* Eyebrow + title */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
              AGENDA
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 28, fontWeight: '900', color: c.text, letterSpacing: -0.5 }}>
                Mis partidos
              </Text>
              {filter !== 'all' && (
                <TouchableOpacity
                  onPress={() => setFilter('all')}
                  style={{ backgroundColor: c.bgSurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: c.border }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: c.textDim }}>Quitar filtro ✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Active / Archived toggle */}
            {hasAny && (
              <View style={{ flexDirection: 'row', backgroundColor: c.bgElev, borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: c.border }}>
                {[
                  { label: `Activos${hasActive ? ` (${activeMatches.length})` : ''}`, active: !showArchived, onPress: () => setShowArchived(false) },
                  { label: `Archivados${hasArchived ? ` (${archivedMatches.length})` : ''}`, active: showArchived, onPress: () => setShowArchived(true) },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.label}
                    onPress={tab.onPress}
                    style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11, backgroundColor: tab.active ? c.bgSurface : 'transparent' }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: tab.active ? c.text : c.textDim }}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Role stat cards */}
            {(showArchived ? hasArchived : hasActive) && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                <TouchableOpacity
                  onPress={() => setFilter(filter === 'organizer' ? 'all' : 'organizer')}
                  style={{
                    flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center',
                    backgroundColor: filter === 'organizer' ? 'rgba(168,85,247,0.15)' : c.bgElev,
                    borderColor: filter === 'organizer' ? 'rgba(168,85,247,0.5)' : c.border,
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '800', color: filter === 'organizer' ? '#A855F7' : c.text }}>
                    {(showArchived ? archivedMatches : activeMatches).filter(m => m._role === 'organizer').length}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: filter === 'organizer' ? '#A855F7' : c.textDim, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Organizo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilter(filter === 'player' ? 'all' : 'player')}
                  style={{
                    flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center',
                    backgroundColor: filter === 'player' ? c.brandSoft : c.bgElev,
                    borderColor: filter === 'player' ? c.brand : c.border,
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '800', color: filter === 'player' ? c.brand : c.text }}>
                    {(showArchived ? archivedMatches : activeMatches).filter(m => m._role === 'player').length}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: filter === 'player' ? c.brand : c.textDim, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Apuntado
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.bgElev, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="calendar-outline" size={36} color={c.textMuted} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 }}>
              {showArchived ? 'Sin partidos archivados' : 'Sin partidos activos'}
            </Text>
            <Text style={{ color: c.textDim, textAlign: 'center', fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              {showArchived
                ? 'Los partidos finalizados o cancelados aparecerán aquí.'
                : 'Crea un partido o únete a uno existente para empezar.'}
            </Text>
            {!showArchived && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/create')}
                  style={{ backgroundColor: c.brand, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Crear partido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/' as any)}
                  style={{ backgroundColor: c.bgElev, borderWidth: 1, borderColor: c.border, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="search-outline" size={16} color={c.textDim} />
                  <Text style={{ color: c.textDim, fontWeight: '700', fontSize: 13 }}>Buscar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
