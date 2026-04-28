import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Match } from '@/types/database';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/empty-state';
import { isValidCoords, firstParam } from '@/lib/utils';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const c = Colors;

const VALID_POSITIONS = new Set(['cualquiera', 'portero', 'defensa', 'mediocentro', 'delantero']);

export default function SearchResultsScreen() {
  const { lat, lng, ciudad, date, position, dateRange } = useLocalSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function fetchMatches() {
    let nearbyIds: string[] | null = null;
    const latStr = firstParam(lat as string | string[]);
    const lngStr = firstParam(lng as string | string[]);
    if (latStr && lngStr) {
      const parsedLat = parseFloat(latStr);
      const parsedLng = parseFloat(lngStr);
      if (!isValidCoords(parsedLat, parsedLng)) {
        setMatches([]); setLoading(false); setRefreshing(false); return;
      }
      const { data: rpcData } = await supabase.rpc('partidos_cerca', { lat: parsedLat, lng: parsedLng, radio_km: 30 });
      nearbyIds = (rpcData || []).map((r: { id: string }) => r.id);
      if (!nearbyIds || nearbyIds.length === 0) {
        setMatches([]); setLoading(false); setRefreshing(false); return;
      }
    }

    let query = supabase
      .from('matches')
      .select('*, organizer:users(*), participants:match_participants(status)')
      .eq('status', 'open')
      .order('date_time', { ascending: true });

    if (nearbyIds !== null) query = query.in('id', nearbyIds);

    const dateRangeStr = firstParam(dateRange as string | string[]);
    const dateStr = firstParam(date as string | string[]);

    if (dateRangeStr === 'this_week') {
      const startOfTarget = new Date();
      const endOfTarget = new Date();
      const currentDay = endOfTarget.getDay();
      const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
      endOfTarget.setDate(endOfTarget.getDate() + daysUntilSunday);
      endOfTarget.setHours(23, 59, 59, 999);
      query = query.gte('date_time', startOfTarget.toISOString()).lte('date_time', endOfTarget.toISOString());
    } else if (dateRangeStr === 'next_week') {
      const now = new Date();
      const currentDay = now.getDay();
      const daysUntilNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
      const startOfNextWeek = new Date(now);
      startOfNextWeek.setDate(now.getDate() + daysUntilNextMonday);
      startOfNextWeek.setHours(0, 0, 0, 0);
      const endOfNextWeek = new Date(startOfNextWeek);
      endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
      endOfNextWeek.setHours(23, 59, 59, 999);
      query = query.gte('date_time', startOfNextWeek.toISOString()).lte('date_time', endOfNextWeek.toISOString());
    } else if (dateStr) {
      const startOfTarget = new Date();
      startOfTarget.setHours(0, 0, 0, 0);
      const endOfTarget = new Date();
      endOfTarget.setHours(23, 59, 59, 999);

      if (dateStr !== 'today') {
        const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1;
          const year = parseInt(dateMatch[3], 10);
          const candidate = new Date(year, month, day);
          if (!isNaN(candidate.getTime()) && candidate.getDate() === day && candidate.getMonth() === month && candidate.getFullYear() === year) {
            startOfTarget.setFullYear(year, month, day);
            endOfTarget.setFullYear(year, month, day);
          } else {
            setMatches([]); setLoading(false); setRefreshing(false); return;
          }
        } else {
          setMatches([]); setLoading(false); setRefreshing(false); return;
        }
      }

      const now = new Date();
      const filterStart = startOfTarget < now ? now : startOfTarget;
      query = query.gte('date_time', filterStart.toISOString()).lte('date_time', endOfTarget.toISOString());
    } else {
      query = query.gte('date_time', new Date().toISOString());
    }

    const { data, error } = await query;

    if (!error && data) {
      let filteredData = data as Match[];
      const targetPosition = firstParam(position as string | string[]);
      if (targetPosition && VALID_POSITIONS.has(targetPosition) && targetPosition !== 'cualquiera') {
        filteredData = filteredData.filter(m => {
          if (!m.requested_positions) return false;
          const rq = m.requested_positions as any;
          return (rq[targetPosition] && rq[targetPosition] > 0) || (rq['cualquiera'] && rq['cualquiera'] > 0);
        });
      }
      setMatches(filteredData);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetchMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, date, dateRange]);

  const onRefresh = () => { setRefreshing(true); fetchMatches(); };

  const ciudadLabel = ciudad ? firstParam(ciudad as string | string[]).slice(0, 50) : '';

  const renderMatchCard = ({ item }: { item: Match & { participants?: any[] } }) => {
    const d = new Date(item.date_time);
    const dateString = d.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const maxPlayers = item.requested_positions
      ? Object.values(item.requested_positions).reduce((a: any, b: any) => a + b, 0)
      : 0;

    const approvedCount = item.participants?.filter(p => p.status === 'approved').length || 0;
    const isFull = approvedCount >= maxPlayers;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/match/${item.id}`)}
        style={{
          backgroundColor: c.bgElev,
          borderRadius: 20,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
        }}
      >
        {/* Top accent */}
        <View style={{ height: 3, backgroundColor: isFull ? c.textMuted : c.brand }} />

        <View style={{ padding: 16 }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, flex: 1, marginRight: 12 }} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.team_a_color && <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: item.team_a_color }} />}
              {item.team_b_color && <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: item.team_b_color }} />}
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
                backgroundColor: isFull ? 'rgba(255,255,255,0.06)' : c.brandSoft,
                borderWidth: 1, borderColor: isFull ? c.border : c.brand + '44',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: isFull ? c.textMuted : c.brand, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isFull ? 'Completo' : 'Abierto'}
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
              <Text style={{ color: c.textDim, marginLeft: 6, fontSize: 13 }}>{dateString} · {timeString}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={14} color={c.textDim} />
              <Text style={{ color: c.textDim, marginLeft: 6, fontSize: 13 }}>Buscan {maxPlayers} jugadores</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: c.brandSoft, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                <Text style={{ fontWeight: '800', color: c.brand, fontSize: 12 }}>
                  {item.organizer?.full_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={{ color: c.textDim, fontSize: 13 }} numberOfLines={1}>
                {item.organizer?.full_name || item.organizer?.username}
              </Text>
            </View>
            <Text style={{ fontWeight: '800', color: item.price_per_player > 0 ? c.brand : c.textDim, fontSize: 14 }}>
              {item.price_per_player > 0 ? `${item.price_per_player}€` : 'Gratis'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const headerTitle = ciudadLabel ? `Partidos en ${ciudadLabel}` : 'Resultados';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{
        title: headerTitle,
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700', color: c.text },
        headerShadowVisible: false,
      }} />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.brand} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchCard}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} />}
          ListHeaderComponent={
            matches.length > 0 ? (
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>
                {matches.length} {matches.length === 1 ? 'PARTIDO' : 'PARTIDOS'}
              </Text>
            ) : null
          }
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
