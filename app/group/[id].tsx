import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MatchCard } from '@/components/rondo/MatchCard';
import { Badge, InfoCell, PlayerRow } from '@/components/match/MatchDetailParts';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { buildSeriesInviteUrl } from '@/lib/seriesInvite';
import { supabase } from '@/lib/supabase';
import { getErrorMessage, logSupabaseError } from '@/lib/supabaseErrors';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import type { MatchSeries, SeriesMatch, SeriesMember } from '@/types/series';

type MatchWithCardJoins = SeriesMatch & {
  participants?: { status: string }[];
  organizer?: { full_name?: string; username?: string } | null;
};

export default function GroupDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = createStyles(c);
  const [group, setGroup] = useState<MatchSeries | null>(null);
  const [members, setMembers] = useState<SeriesMember[]>([]);
  const [matches, setMatches] = useState<MatchWithCardJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);

  const loadGroup = useCallback(async (refresh = false) => {
    if (!id) {
      setError('No encontramos ese equipo.');
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
          .select(`*, user:users!series_members_user_id_fkey(${PUBLIC_USER_SELECT})`)
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
      logSupabaseError('load recurring group', loadError);
      setError(getErrorMessage(loadError, 'No hemos podido cargar el equipo.'));
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
        message: `Te queremos en ${group.title}. Entra al equipo de Rondo: ${buildSeriesInviteUrl(group.invite_code)}`,
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

  const removeMember = (member: SeriesMember) => {
    if (!isOrganizer) return;
    const name = member.user?.full_name || member.user?.username || 'este jugador';
    Alert.alert('Quitar del equipo', `¿Quitamos a ${name} de la plantilla?`, [
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
      <View style={s.loadingRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  if (error || !group) {
    return (
      <View style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ height: insets.top }} />
        <View style={s.header}>
          <Pressable
            style={({ pressed }) => [s.headerBtn, pressed && s.pressed]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={20} color={c.textDim} />
          </Pressable>
        </View>
        <View style={s.errorContent}>
          <Ionicons name="alert-circle-outline" size={48} color={c.danger} />
          <Text style={s.errorTitle}>No carga el equipo</Text>
          <Text style={s.errorCopy}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadGroup()}
            style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}
          >
            <Text style={s.primaryButtonText}>Probar otra vez</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const cityLabel = group.city || group.venue?.city || 'Ciudad por definir';
  const locationCopy = group.venue
    ? [group.venue.canonical_name, group.venue.address].filter(Boolean).join(', ')
    : 'El campo se decide en cada pachanga.';

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: insets.top }} />

      <View style={s.header}>
        <Pressable
          style={({ pressed }) => [s.headerBtn, pressed && s.pressed]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={20} color={c.textDim} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.headerBtn, pressed && s.pressed]}
          onPress={() => void shareInvite()}
          accessibilityRole="button"
          accessibilityLabel="Compartir invitación del equipo"
        >
          <Ionicons name="share-outline" size={20} color={c.brand} />
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadGroup(true)} tintColor={c.brand} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.titleBlock}>
          <Text style={s.titleText}>{group.title}</Text>
          <View style={s.badgeRow}>
            <Badge
              label="Equipo"
              color={c.brand}
              bg={c.brandSoft}
              border="rgba(34,197,94,0.3)"
            />
            <Badge
              label={group.is_active ? 'Activo' : 'Pausado'}
              color={group.is_active ? c.brand : c.textDim}
              bg={group.is_active ? c.brandSoft : c.inputBg}
              border={group.is_active ? 'rgba(34,197,94,0.3)' : c.border}
            />
          </View>
        </View>

        <View style={s.infoSection}>
          <View style={s.locationCard}>
            <Ionicons name="location-outline" size={20} color={c.brand} style={s.locationIcon} />
            <View style={s.locationBody}>
              <Text style={s.locationName}>{cityLabel}</Text>
              <Text style={s.locationCopy}>{locationCopy}</Text>
            </View>
          </View>

          <View style={s.infoRow}>
            <InfoCell label="Plantilla">
              <Text style={s.infoCellValue}>{members.length}</Text>
            </InfoCell>
          </View>
        </View>

        {isOrganizer && (
          <View style={s.ctaBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Crear el partido de esta semana"
              onPress={() => router.push({ pathname: '/(tabs)/create', params: { teamId: group.id } } as never)}
              disabled={!group.is_active}
              style={({ pressed }) => [
                s.primaryButton,
                !group.is_active && s.disabled,
                pressed && group.is_active && s.pressed,
              ]}
            >
              <Ionicons name="add" size={20} color={c.brandInk} />
              <Text style={s.primaryButtonText}>Crear partido</Text>
            </Pressable>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>Próximos partidos ({matches.length})</Text>
          {matches.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Aún no hay pachanga preparada</Text>
              <Text style={s.emptyCopy}>
                {isOrganizer ? 'Cuando sepáis el día, crea el partido y todos quedarán pendientes de confirmar.' : 'El capitán publicará aquí el próximo partido.'}
              </Text>
            </View>
          ) : (
            <View style={s.cardList}>
              {matches.map(match => (
                <MatchCard key={match.id} match={match} onPress={() => router.push(`/match/${match.id}` as never)} />
              ))}
            </View>
          )}
        </View>

        <View style={[s.section, s.lastSection]}>
          <Text style={s.sectionLabel}>Plantilla ({members.length})</Text>
          {members.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Comparte el enlace con el vestuario</Text>
              <Text style={s.emptyCopy}>Cada jugador que entre aparecerá aquí.</Text>
            </View>
          ) : members.map((member, index) => {
            const name = member.user?.full_name || member.user?.username || 'Jugador de Rondo';
            return (
              <PlayerRow
                key={member.id}
                user={member.user}
                onPress={member.user_id ? () => router.push(`/user/${member.user_id}` as never) : undefined}
                isLast={index === members.length - 1}
                rightContent={isOrganizer && member.user_id !== user?.id ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar a ${name}`}
                    onPress={() => removeMember(member)}
                    style={({ pressed }) => [s.removeButton, pressed && s.pressed]}
                  >
                    <Ionicons name="person-remove-outline" size={20} color={c.danger} />
                  </Pressable>
                ) : undefined}
              />
            );
          })}
        </View>

        {isOrganizer && (
          <View style={s.organizerBlock}>
            <View style={s.organizerPanel}>
              <Text style={s.organizerTitle}>Panel del organizador</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={group.is_active ? 'Pausar equipo' : 'Volver a activar el equipo'}
                onPress={() => void toggleGroup()}
                disabled={savingGroup}
                style={({ pressed }) => [
                  s.toggleButton,
                  { borderColor: group.is_active ? c.danger : c.brand },
                  savingGroup && s.disabled,
                  pressed && !savingGroup && s.pressed,
                ]}
              >
                {savingGroup ? <ActivityIndicator color={c.text} /> : (
                  <Text style={[s.toggleButtonText, { color: group.is_active ? c.danger : c.brand }]}>
                    {group.is_active ? 'Pausar equipo' : 'Volver a activar'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.45,
  },
  scroll: {
    flex: 1,
  },
  errorContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  errorTitle: {
    color: c.text,
    fontFamily: 'Archivo_900Black',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
  },
  errorCopy: {
    color: c.textDim,
    lineHeight: 22,
    marginTop: 8,
  },
  titleBlock: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  titleText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 30,
    fontWeight: '900',
    color: c.text,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  infoSection: {
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.12)',
    borderRadius: 14,
    padding: 14,
  },
  locationIcon: {
    marginTop: 1,
  },
  locationBody: {
    flex: 1,
    minWidth: 0,
  },
  locationName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '700',
  },
  locationCopy: {
    color: c.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCellValue: {
    fontFamily: 'Archivo_900Black',
    fontSize: 18,
    fontWeight: '900',
    color: c.brand,
    textAlign: 'center',
  },
  ctaBlock: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  primaryButton: {
    minHeight: 52,
    width: '100%',
    borderRadius: 14,
    backgroundColor: c.brand,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: c.brandInk,
    fontFamily: 'Archivo_900Black',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  lastSection: {
    borderBottomWidth: 0,
  },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.5,
    color: c.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  emptyCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
    backgroundColor: c.bgSurface,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCopy: {
    color: c.textDim,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  cardList: {
    gap: 12,
  },
  removeButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  organizerBlock: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  organizerPanel: {
    backgroundColor: c.bgElev,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  organizerTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: c.brand,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggleButton: {
    minHeight: 48,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
