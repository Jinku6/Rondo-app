import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Match } from '@/types/database';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/ui/empty-state';
import { isValidCoords, firstParam } from '@/lib/utils';

const VALID_POSITIONS = new Set(['cualquiera', 'portero', 'defensa', 'mediocentro', 'delantero']);

export default function SearchResultsScreen() {
  const { lat, lng, ciudad, date, position, dateRange } = useLocalSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function fetchMatches() {
    // Validar y parsear lat/lng — rechazar si están fuera de rango geográfico
    let nearbyIds: string[] | null = null;
    const latStr = firstParam(lat as string | string[]);
    const lngStr = firstParam(lng as string | string[]);
    if (latStr && lngStr) {
      const parsedLat = parseFloat(latStr);
      const parsedLng = parseFloat(lngStr);
      if (!isValidCoords(parsedLat, parsedLng)) {
        setMatches([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const { data: rpcData } = await supabase.rpc('partidos_cerca', {
        lat: parsedLat,
        lng: parsedLng,
        radio_km: 30,
      });
      nearbyIds = (rpcData || []).map((r: { id: string }) => r.id);
      if (!nearbyIds || nearbyIds.length === 0) {
        setMatches([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
    }

    let query = supabase
      .from('matches')
      .select('*, organizer:users(*), participants:match_participants(status)')
      .eq('status', 'open')
      .order('date_time', { ascending: true });

    if (nearbyIds !== null) {
      query = query.in('id', nearbyIds);
    }

    const dateRangeStr = firstParam(dateRange as string | string[]);
    const dateStr = firstParam(date as string | string[]);

    if (dateRangeStr === 'this_week') {
      const startOfTarget = new Date();
      const endOfTarget = new Date();
      const currentDay = endOfTarget.getDay();
      const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
      endOfTarget.setDate(endOfTarget.getDate() + daysUntilSunday);
      endOfTarget.setHours(23, 59, 59, 999);
      query = query
        .gte('date_time', startOfTarget.toISOString())
        .lte('date_time', endOfTarget.toISOString());
    } else if (dateStr) {
      const startOfTarget = new Date();
      startOfTarget.setHours(0, 0, 0, 0);
      const endOfTarget = new Date();
      endOfTarget.setHours(23, 59, 59, 999);

      if (dateStr !== 'today') {
        // Validar formato DD/MM/YYYY estrictamente antes de parsear
        const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1;
          const year = parseInt(dateMatch[3], 10);
          // Validar que los valores produzcan una fecha real
          const candidate = new Date(year, month, day);
          if (
            !isNaN(candidate.getTime()) &&
            candidate.getDate() === day &&
            candidate.getMonth() === month &&
            candidate.getFullYear() === year
          ) {
            startOfTarget.setFullYear(year, month, day);
            endOfTarget.setFullYear(year, month, day);
          } else {
            // Fecha inválida — mostrar vacío en lugar de crashear
            setMatches([]);
            setLoading(false);
            setRefreshing(false);
            return;
          }
        } else {
          setMatches([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const now = new Date();
      const filterStart = startOfTarget < now ? now : startOfTarget;
      query = query
        .gte('date_time', filterStart.toISOString())
        .lte('date_time', endOfTarget.toISOString());
    } else {
      query = query.gte('date_time', new Date().toISOString());
    }

    const { data, error } = await query;

    if (!error && data) {
      let filteredData = data as Match[];

      // Allowlist de posiciones válidas — rechazar valores no conocidos
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
  }, [lat, lng, date, dateRange]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

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
        className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-4 shadow-sm border border-gray-200 dark:border-gray-800"
      >
        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-xl font-bold text-slate-900 dark:text-white flex-1">{item.title}</Text>
          <View className="flex-row gap-1 mr-2 items-center">
            {item.team_a_color && <View className="w-4 h-4 rounded-full" style={{ backgroundColor: item.team_a_color }} />}
            {item.team_b_color && <View className="w-4 h-4 rounded-full" style={{ backgroundColor: item.team_b_color }} />}
          </View>
          <View className={`px-3 py-1 rounded-full ${isFull ? 'bg-slate-200 dark:bg-gray-900' : 'bg-green-100 dark:bg-green-900'}`}>
            <Text className={`font-medium ${isFull ? 'text-slate-600 dark:text-slate-400' : 'text-green-800 dark:text-green-200'}`}>
              {isFull ? 'Completo' : 'Abierto'}
            </Text>
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

        <View className="flex-row justify-between items-center border-t border-slate-100 dark:border-gray-800 pt-3">
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
          <Text className="font-bold text-green-600 dark:text-green-400">
            {item.price_per_player > 0 ? `${item.price_per_player}€` : 'Gratis'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-neutral-950">
      <Stack.Screen options={{ title: ciudad ? `Partidos en ${firstParam(ciudad as string | string[]).slice(0, 50)}` : 'Resultados de búsqueda' }} />
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
