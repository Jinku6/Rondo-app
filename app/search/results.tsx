import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { MATCH_CARD_SELECT } from '@/lib/supabase/selects';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/empty-state';
import { isValidCoords, firstParam } from '@/lib/utils';
import { Fonts, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatchCard, type MatchCardData } from '@/components/rondo/MatchCard';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { useTheme } from '@/hooks/use-theme';
import { logSupabaseError } from '@/lib/supabaseErrors';

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
  const { colors: c } = useTheme();
  const [matches, setMatches] = useState<MatchCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const latStr = firstParam(lat as string | string[]);
  const lngStr = firstParam(lng as string | string[]);
  const ciudadLabel = ciudad ? firstParam(ciudad as string | string[]).slice(0, 50) : '';
  const dateStr = firstParam(date as string | string[]) ?? '';
  const dateRangeStr = firstParam(dateRange as string | string[]) ?? '';
  const positionStr = firstParam(position as string | string[]) ?? 'cualquiera';

  const fetchMatches = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      let nearbyIds: string[] | null = null;
      if (latStr && lngStr) {
        const parsedLat = Number.parseFloat(latStr);
        const parsedLng = Number.parseFloat(lngStr);
        if (!isValidCoords(parsedLat, parsedLng)) {
          setMatches([]);
          return;
        }
        const { data: rpcData, error: nearbyError } = await supabase.rpc('partidos_cerca', {
          lat: parsedLat,
          lng: parsedLng,
          radio_km: SEARCH_RADIUS_KM,
        });
        if (nearbyError) throw nearbyError;
        const nextNearbyIds = (rpcData ?? []).map((result: { id: string }) => result.id);
        if (nextNearbyIds.length === 0) {
          setMatches([]);
          return;
        }
        nearbyIds = nextNearbyIds;
      }

      let query = supabase
        .from('matches')
        .select(MATCH_CARD_SELECT)
        .eq('status', 'open')
        .order('date_time', { ascending: true });

      if (nearbyIds !== null) query = query.in('id', nearbyIds);

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
          if (!dateMatch) {
            setMatches([]);
            return;
          }
          const day = Number.parseInt(dateMatch[1], 10);
          const month = Number.parseInt(dateMatch[2], 10) - 1;
          const year = Number.parseInt(dateMatch[3], 10);
          const candidate = new Date(year, month, day);
          if (
            Number.isNaN(candidate.getTime())
            || candidate.getDate() !== day
            || candidate.getMonth() !== month
            || candidate.getFullYear() !== year
          ) {
            setMatches([]);
            return;
          }
          startOfTarget.setFullYear(year, month, day);
          endOfTarget.setFullYear(year, month, day);
        }

        const now = new Date();
        const filterStart = startOfTarget < now ? now : startOfTarget;
        query = query.gte('date_time', filterStart.toISOString()).lte('date_time', endOfTarget.toISOString());
      } else {
        query = query.gte('date_time', new Date().toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = (data ?? []) as MatchCardData[];
      if (VALID_POSITIONS.has(positionStr) && positionStr !== 'cualquiera') {
        const targetPosition = positionStr as keyof MatchCardData['requested_positions'];
        filteredData = filteredData.filter(match => (
          match.requested_positions[targetPosition] > 0
          || match.requested_positions.cualquiera > 0
        ));
      }
      setMatches(filteredData);
    } catch (error) {
      logSupabaseError('search matches', error);
      setMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRangeStr, dateStr, latStr, lngStr, positionStr]);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  const onRefresh = useCallback(() => {
    void fetchMatches(true);
  }, [fetchMatches]);
  const openMatch = useCallback((matchId: string) => {
    router.push(`/match/${matchId}`);
  }, [router]);
  const renderMatch = useCallback(({ item }: { item: MatchCardData }) => (
    <MatchCard match={item} onPress={openMatch} />
  ), [openMatch]);

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
          renderItem={renderMatch}
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
