import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { Match } from '@/types/database';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/empty-state';
import { isValidCoords, firstParam } from '@/lib/utils';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatchCard } from '@/components/rondo/MatchCard';
import { ScreenTitle } from '@/components/ui/ScreenTitle';

const c = Colors;
const SEARCH_RADIUS_KM = 20;

const VALID_POSITIONS = new Set(['cualquiera', 'portero', 'defensa', 'mediocentro', 'delantero']);

const POSITION_LABELS: Record<string, string> = {
  cualquiera:  'Cualquiera',
  portero:     'Portero',
  defensa:     'Defensa',
  mediocentro: 'Mediocentro',
  delantero:   'Delantero',
};

function buildEyebrow(ciudad: string, dateStr: string, dateRangeStr: string, position: string): string {
  const parts: string[] = [];

  if (ciudad) parts.push(ciudad.slice(0, 20));

  if (dateRangeStr === 'this_week') {
    parts.push('Esta semana');
  } else if (dateRangeStr === 'next_week') {
    parts.push('Próx. semana');
  } else if (dateStr === 'today') {
    parts.push('Hoy');
  } else if (dateStr) {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      parts.push(d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }));
    } else {
      parts.push('Próximos días');
    }
  } else {
    parts.push('Próximos días');
  }

  parts.push(POSITION_LABELS[position] ?? 'Cualquiera');
  return parts.join(' · ');
}

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
      const { data: rpcData } = await supabase.rpc('partidos_cerca', { lat: parsedLat, lng: parsedLng, radio_km: SEARCH_RADIUS_KM });
      nearbyIds = (rpcData || []).map((r: { id: string }) => r.id);
      if (!nearbyIds || nearbyIds.length === 0) {
        setMatches([]); setLoading(false); setRefreshing(false); return;
      }
    }

    let query = supabase
      .from('matches')
      .select(`*, organizer:users(${PUBLIC_USER_SELECT}), participants:match_participants(status)`)
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
  const dateStr = firstParam(date as string | string[]) ?? '';
  const dateRangeStr = firstParam(dateRange as string | string[]) ?? '';
  const positionStr = firstParam(position as string | string[]) ?? 'cualquiera';

  const eyebrow = buildEyebrow(ciudadLabel, dateStr, dateRangeStr, positionStr);
  const titleText = loading ? 'Buscando…' : `${matches.length} ${matches.length === 1 ? 'partido' : 'partidos'}`;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <View style={{ paddingTop: insets.top, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
          {/* Back + title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={24} color={c.textDim} />
            </TouchableOpacity>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', color: c.textDim }}>
                {eyebrow}
              </Text>
              <ScreenTitle style={{ marginTop: 3 }} numberOfLines={1}>
                {titleText}
              </ScreenTitle>
            </View>
          </View>
        </View>

        {/* Modify search button */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: '100%', minHeight: 44, backgroundColor: c.bgSurface,
              borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.textDim }}>
              🔄 Modificar búsqueda
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.brand} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MatchCard
              match={item as any}
              onPress={() => router.push(`/match/${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} />
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
