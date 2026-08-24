import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MatchCard } from '@/components/rondo/MatchCard';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { buildSeriesInviteUrl } from '@/lib/seriesInvite';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import type { MatchSeries, SeriesMatch, SeriesMember } from '@/types/series';

type MatchWithCardJoins = SeriesMatch & {
  participants?: { status: string }[];
  organizer?: { full_name?: string; username?: string } | null;
};

function parseLocalDateTime(dateText: string, timeText: string): Date | null {
  const dateMatch = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = timeText.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const value = new Date(year, month - 1, day, hours, minutes);

  if (
    value.getFullYear() !== year
    || value.getMonth() !== month - 1
    || value.getDate() !== day
    || value.getHours() !== hours
    || value.getMinutes() !== minutes
  ) return null;

  return value;
}

function CreateMatchModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (dateText: string, timeText: string) => void;
}) {
  const { colors: c } = useTheme();
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');

  useEffect(() => {
    if (!visible) return;
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setDateText(nextWeek.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    setTimeText('20:00');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim }}>
        <View style={{ backgroundColor: c.bgElev, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingBottom: 36 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 21, fontWeight: '900' }}>Crear esta semana</Text>
              <Text style={{ color: c.textDim, fontSize: 14, marginTop: 4 }}>La plantilla empezará pendiente de confirmar.</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              disabled={submitting}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={24} color={c.textDim} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>DÍA</Text>
              <TextInput
                accessibilityLabel="Día del partido"
                value={dateText}
                onChangeText={setDateText}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={10}
                style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg, color: c.text, paddingHorizontal: 14, fontSize: 16 }}
              />
            </View>
            <View style={{ width: 116 }}>
              <Text style={{ color: c.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>HORA</Text>
              <TextInput
                accessibilityLabel="Hora del partido"
                value={timeText}
                onChangeText={setTimeText}
                placeholder="HH:MM"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={5}
                style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg, color: c.text, paddingHorizontal: 14, fontSize: 16 }}
              />
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onSubmit(dateText, timeText)}
            disabled={submitting}
            style={{ minHeight: 52, borderRadius: 14, marginTop: 24, backgroundColor: c.brand, opacity: submitting ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }}
          >
            {submitting ? <ActivityIndicator color={c.brandInk} /> : (
              <Text style={{ color: c.brandInk, fontSize: 16, fontWeight: '900' }}>Crear partido</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [group, setGroup] = useState<MatchSeries | null>(null);
  const [members, setMembers] = useState<SeriesMember[]>([]);
  const [matches, setMatches] = useState<MatchWithCardJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const loadGroup = useCallback(async (refresh = false) => {
    if (!id) {
      setError('No encontramos ese grupo.');
      setLoading(false);
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [groupResult, membersResult, matchesResult] = await Promise.all([
        supabase
          .from('match_series')
          .select('*, venue:venues(canonical_name,address,city)')
          .eq('id', id)
          .single(),
        supabase
          .from('series_members')
          .select(`*, user:users(${PUBLIC_USER_SELECT})`)
          .eq('series_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: true }),
        supabase
          .from('matches')
          .select(`*, organizer:users(id,full_name,username), participants:match_participants(status)`)
          .eq('series_id', id)
          .in('status', ['open', 'full'])
          .gte('date_time', new Date().toISOString())
          .order('date_time', { ascending: true }),
      ]);

      if (groupResult.error) throw groupResult.error;
      if (membersResult.error) throw membersResult.error;
      if (matchesResult.error) throw matchesResult.error;

      setGroup(groupResult.data as MatchSeries);
      setMembers((membersResult.data ?? []) as SeriesMember[]);
      setMatches((matchesResult.data ?? []) as MatchWithCardJoins[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No hemos podido cargar el grupo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const isOrganizer = !!group && group.organizer_id === user?.id;

  const shareInvite = async () => {
    if (!group) return;
    try {
      await Share.share({
        message: `Te queremos en ${group.title}. Entra al grupo de Rondo: ${buildSeriesInviteUrl(group.invite_code)}`,
      });
    } catch (shareError) {
      Alert.alert('No se pudo compartir', shareError instanceof Error ? shareError.message : 'Prueba de nuevo.');
    }
  };

  const toggleGroup = async () => {
    if (!group || !isOrganizer) return;
    setSavingGroup(true);
    try {
      const { error: updateError } = await supabase
        .from('match_series')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);
      if (updateError) throw updateError;
      setGroup({ ...group, is_active: !group.is_active });
    } catch (updateError) {
      Alert.alert('No se pudo guardar', updateError instanceof Error ? updateError.message : 'Prueba de nuevo.');
    } finally {
      setSavingGroup(false);
    }
  };

  const createManualMatch = async (dateText: string, timeText: string) => {
    if (!group) return;
    const dateTime = parseLocalDateTime(dateText, timeText);
    if (!dateTime || dateTime.getTime() <= Date.now()) {
      Alert.alert('Fecha incorrecta', 'Usa DD/MM/AAAA y HH:MM con una fecha futura.');
      return;
    }

    setCreatingMatch(true);
    try {
      const { data, error: createError } = await supabase.rpc('create_manual_series_match', {
        p_series_id: group.id,
        p_date_time: dateTime.toISOString(),
      });
      if (createError) throw createError;
      if (typeof data !== 'string') throw new Error('No se recibió el partido creado.');
      setCreateModalVisible(false);
      await loadGroup();
      router.push(`/match/${data}` as never);
    } catch (createError) {
      Alert.alert('No se pudo crear', createError instanceof Error ? createError.message : 'Prueba de nuevo.');
    } finally {
      setCreatingMatch(false);
    }
  };

  const removeMember = (member: SeriesMember) => {
    if (!isOrganizer) return;
    const name = member.user?.full_name || member.user?.username || 'este jugador';
    Alert.alert('Quitar del grupo', `¿Quitamos a ${name} de la plantilla?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error: removeError } = await supabase
              .from('series_members')
              .update({ status: 'removed' })
              .eq('id', member.id);
            if (removeError) throw removeError;
            setMembers(current => current.filter(item => item.id !== member.id));
          } catch (removeError) {
            Alert.alert('No se pudo quitar', removeError instanceof Error ? removeError.message : 'Prueba de nuevo.');
          }
        },
      },
    ]);
  };

  if (loading && !group) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingHorizontal: 24, justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Grupo' }} />
        <Ionicons name="alert-circle-outline" size={48} color={c.danger} />
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '900', marginTop: 20 }}>No carga el grupo</Text>
        <Text style={{ color: c.textDim, lineHeight: 22, marginTop: 8 }}>{error}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void loadGroup()}
          style={{ minHeight: 52, backgroundColor: c.brand, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}
        >
          <Text style={{ color: c.brandInk, fontWeight: '900' }}>Probar otra vez</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: group.title }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadGroup(true)} tintColor={c.brand} />}
      >
        <ScreenTitle>{group.title}</ScreenTitle>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: c.brandSoft }}>
            <Text style={{ color: c.brand, fontSize: 11, fontWeight: '800' }}>MODO MANUAL</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: group.is_active ? c.brandSoft : c.inputBg }}>
            <Text style={{ color: group.is_active ? c.brand : c.textDim, fontSize: 11, fontWeight: '800' }}>
              {group.is_active ? 'ACTIVO' : 'PAUSADO'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 24, padding: 18, borderRadius: 20, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Ionicons name="location-outline" size={22} color={c.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{group.venue?.canonical_name}</Text>
              <Text style={{ color: c.textDim, fontSize: 13, lineHeight: 19, marginTop: 3 }}>
                {[group.venue?.address, group.venue?.city].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border }}>
            <Text style={{ color: c.textDim }}>{members.length} en la plantilla</Text>
            <Text style={{ color: c.textDim }}>Mínimo {group.min_players}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          {isOrganizer && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setCreateModalVisible(true)}
              disabled={!group.is_active}
              style={{ minHeight: 52, flex: 1, borderRadius: 14, backgroundColor: c.brand, opacity: group.is_active ? 1 : 0.45, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={22} color={c.brandInk} />
              <Text style={{ color: c.brandInk, fontWeight: '900' }}>Crear esta semana</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void shareInvite()}
            style={{ minHeight: 52, flex: isOrganizer ? 0 : 1, minWidth: 52, paddingHorizontal: isOrganizer ? 0 : 18, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={21} color={c.text} />
            {!isOrganizer && <Text style={{ color: c.text, fontWeight: '800' }}>Invitar al grupo</Text>}
          </TouchableOpacity>
        </View>

        <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 32, marginBottom: 14 }}>Próximos partidos</Text>
        {matches.length === 0 ? (
          <View style={{ padding: 20, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong }}>
            <Text style={{ color: c.text, fontWeight: '800' }}>Aún no hay pachanga preparada</Text>
            <Text style={{ color: c.textDim, lineHeight: 20, marginTop: 6 }}>
              {isOrganizer ? 'Cuando sepáis el día, crea el partido y todos quedarán pendientes de confirmar.' : 'El capitán publicará aquí el próximo partido.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {matches.map(match => (
              <MatchCard key={match.id} match={match} onPress={() => router.push(`/match/${match.id}` as never)} />
            ))}
          </View>
        )}

        <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 32, marginBottom: 14 }}>Plantilla</Text>
        {members.length === 0 ? (
          <View style={{ padding: 20, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong }}>
            <Text style={{ color: c.text, fontWeight: '800' }}>Comparte el enlace con el vestuario</Text>
            <Text style={{ color: c.textDim, lineHeight: 20, marginTop: 6 }}>Cada jugador que entre aparecerá aquí.</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
            {members.map((member, index) => {
              const name = member.user?.full_name || member.user?.username || 'Jugador de Rondo';
              return (
                <View key={member.id} style={{ minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.bgSurface, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.border }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: c.brand, fontWeight: '900' }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '800' }}>{name}</Text>
                    <Text style={{ color: c.textDim, fontSize: 12, marginTop: 2 }}>{member.user?.preferred_position || 'Agente libre'}</Text>
                  </View>
                  {isOrganizer && member.user_id !== user?.id && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar a ${name}`}
                      onPress={() => removeMember(member)}
                      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="person-remove-outline" size={20} color={c.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {isOrganizer && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void toggleGroup()}
            disabled={savingGroup}
            style={{ minHeight: 52, marginTop: 32, borderRadius: 14, borderWidth: 1, borderColor: group.is_active ? c.danger : c.brand, alignItems: 'center', justifyContent: 'center', opacity: savingGroup ? 0.5 : 1 }}
          >
            {savingGroup ? <ActivityIndicator color={c.text} /> : (
              <Text style={{ color: group.is_active ? c.danger : c.brand, fontWeight: '900' }}>
                {group.is_active ? 'Pausar grupo' : 'Volver a activar'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <CreateMatchModal
        visible={createModalVisible}
        submitting={creatingMatch}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={(dateText, timeText) => void createManualMatch(dateText, timeText)}
      />
    </View>
  );
}
