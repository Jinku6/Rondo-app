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

import {
  Badge,
  formatDate,
  formatTime,
  InfoCell,
  PlayerRow,
  ProfileAvatar,
} from '@/components/match/MatchDetailParts';
import { MatchCard } from '@/components/rondo/MatchCard';
import { TeamEditModal, type TeamEditValues } from '@/components/team/TeamEditModal';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { uploadAvatar } from '@/lib/avatarUpload';
import { buildSeriesInviteUrl } from '@/lib/seriesInvite';
import { supabase } from '@/lib/supabase';
import { getErrorMessage, logSupabaseError } from '@/lib/supabaseErrors';
import { buildRecurrenceSummary } from '@/lib/teamRecurrence';
import type {
  MatchSeries,
  PublicTeamDetails,
  PublicTeamRosterMember,
  SeriesMatch,
  TeamMatchRecurrence,
} from '@/types/series';

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
  const [publicTeam, setPublicTeam] = useState<PublicTeamDetails | null>(null);
  const [privateTeam, setPrivateTeam] = useState<MatchSeries | null>(null);
  const [matches, setMatches] = useState<MatchWithCardJoins[]>([]);
  const [recurrences, setRecurrences] = useState<TeamMatchRecurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [cancellingRecurrenceId, setCancellingRecurrenceId] = useState<string | null>(null);

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
      const [publicResult, privateResult, matchesResult, recurrencesResult] = await Promise.all([
        supabase.rpc('get_public_team', { p_team_id: id }),
        supabase
          .from('match_series')
          .select('*, venue:venues(canonical_name,address,city)')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('matches')
          .select('*, organizer:users(id,full_name,username), participants:match_participants(status)')
          .eq('series_id', id)
          .in('status', ['open', 'full'])
          .gte('date_time', new Date().toISOString())
          .order('date_time', { ascending: true }),
        supabase
          .from('team_match_recurrences')
          .select('id,series_id,frequency,day_of_week,week_of_month,start_time,timezone,first_match_id,is_active,cancelled_at,created_at')
          .eq('series_id', id)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
      ]);

      if (publicResult.error) throw publicResult.error;
      if (privateResult.error) throw privateResult.error;
      if (matchesResult.error) throw matchesResult.error;
      if (recurrencesResult.error) throw recurrencesResult.error;

      const nextPublicTeam = publicResult.data as unknown as PublicTeamDetails;
      setPublicTeam({
        ...nextPublicTeam,
        completed_matches: Number(nextPublicTeam.completed_matches) || 0,
      });
      setPrivateTeam(privateResult.data as MatchSeries | null);
      setMatches((matchesResult.data ?? []) as MatchWithCardJoins[]);
      setRecurrences((recurrencesResult.data ?? []) as TeamMatchRecurrence[]);
    } catch (loadError) {
      logSupabaseError('load public team', loadError);
      setError(getErrorMessage(loadError, 'No hemos podido cargar el equipo.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const isCaptain = !!publicTeam && publicTeam.organizer_id === user?.id;
  const canManage = isCaptain && !!privateTeam;

  const shareInvite = async () => {
    if (!privateTeam || !canManage) return;
    try {
      await Share.share({
        message: `Te queremos en ${privateTeam.title}. Entra al equipo de Rondo: ${buildSeriesInviteUrl(privateTeam.invite_code)}`,
      });
    } catch (shareError) {
      Alert.alert('No se pudo compartir', shareError instanceof Error ? shareError.message : 'Prueba de nuevo.');
    }
  };

  const saveTeam = async (values: TeamEditValues) => {
    if (!privateTeam || !publicTeam || !canManage || !user?.id) return;
    setSavingTeam(true);
    try {
      const avatarUrl = values.avatarAsset
        ? await uploadAvatar({
          asset: values.avatarAsset,
          ownerId: user.id,
          folder: `teams/${privateTeam.id}`,
        })
        : values.avatarUrl;
      const { error: updateError } = await supabase.rpc('update_team_details', {
        p_team_id: privateTeam.id,
        p_title: values.title,
        p_city: values.city,
        p_price_per_player: values.pricePerPlayer,
        p_avatar_url: avatarUrl,
        p_description: values.description,
      });
      if (updateError) throw updateError;

      setPrivateTeam({
        ...privateTeam,
        title: values.title,
        city: values.city,
        description: values.description,
        price_per_player: values.pricePerPlayer,
        avatar_url: avatarUrl,
      });
      setPublicTeam({
        ...publicTeam,
        title: values.title,
        city: values.city,
        description: values.description,
        avatar_url: avatarUrl,
      });
      setEditVisible(false);
      Alert.alert('Equipo actualizado', 'Todo listo para el próximo partido.');
    } catch (updateError) {
      logSupabaseError('update team details', updateError);
      Alert.alert('No se pudo guardar', getErrorMessage(updateError, 'Revisa los datos y prueba de nuevo.'));
    } finally {
      setSavingTeam(false);
    }
  };

  const removeMember = (member: PublicTeamRosterMember) => {
    if (!privateTeam || !canManage || member.is_captain) return;
    const name = member.full_name || member.username || 'este jugador';
    Alert.alert(
      'Expulsar jugador',
      `${name} saldrá de la plantilla y perderá sus reservas pendientes en futuros partidos privados. Las plazas que ya confirmó se mantienen.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar',
          style: 'destructive',
          onPress: async () => {
            setRemovingMemberId(member.id);
            try {
              const { error: removeError } = await supabase.rpc('remove_team_member', {
                p_team_id: privateTeam.id,
                p_user_id: member.id,
              });
              if (removeError) throw removeError;
              setPublicTeam(current => current
                ? { ...current, roster: current.roster.filter(item => item.id !== member.id) }
                : current);
              Alert.alert('Jugador expulsado', `${name} ya no forma parte de la plantilla.`);
            } catch (removeError) {
              logSupabaseError('remove team member', removeError);
              Alert.alert('No se pudo expulsar', getErrorMessage(removeError, 'Prueba de nuevo.'));
            } finally {
              setRemovingMemberId(null);
            }
          },
        },
      ],
    );
  };

  const cancelRecurrence = (recurrence: TeamMatchRecurrence) => {
    if (!canManage) return;
    const nextMatch = matches.find(match => match.recurrence_id === recurrence.id);
    const currentMatchCopy = nextMatch
      ? `El partido del ${formatDate(nextMatch.date_time)} a las ${formatTime(nextMatch.date_time)} sigue en pie.`
      : 'Los partidos que ya están creados siguen en pie.';

    Alert.alert(
      'Anular recurrencia',
      `${currentMatchCopy} No se generarán los siguientes partidos de esta recurrencia.`,
      [
        { text: 'Mantener recurrencia', style: 'cancel' },
        {
          text: 'Anular recurrencia',
          style: 'destructive',
          onPress: async () => {
            setCancellingRecurrenceId(recurrence.id);
            try {
              const { error: cancelError } = await supabase.rpc('cancel_team_match_recurrence', {
                p_recurrence_id: recurrence.id,
              });
              if (cancelError) throw cancelError;
              setRecurrences(current => current.filter(item => item.id !== recurrence.id));
              Alert.alert('Recurrencia anulada', 'El partido que ya estaba preparado sigue en pie. No crearemos el siguiente.');
            } catch (cancelError) {
              logSupabaseError('cancel team match recurrence', cancelError);
              Alert.alert('No se pudo anular', getErrorMessage(cancelError, 'Prueba de nuevo en unos segundos.'));
            } finally {
              setCancellingRecurrenceId(null);
            }
          },
        },
      ],
    );
  };

  const deleteTeam = () => {
    if (!privateTeam || !canManage) return;
    if (matches.length > 0) {
      Alert.alert(
        'Aún hay partidos pendientes',
        'Cancela o finaliza los partidos futuros antes de eliminar el equipo.',
      );
      return;
    }

    Alert.alert(
      'Eliminar equipo',
      `${privateTeam.title} desaparecerá de Rondo y el enlace dejará de funcionar. El historial de partidos se conservará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar equipo',
          style: 'destructive',
          onPress: async () => {
            setDeletingTeam(true);
            try {
              const { error: deleteError } = await supabase.rpc('delete_team', {
                p_team_id: privateTeam.id,
              });
              if (deleteError) throw deleteError;
              Alert.alert('Equipo eliminado', 'El vestuario conserva el historial de sus partidos.', [
                { text: 'Aceptar', onPress: () => router.replace('/(tabs)/mymatches') },
              ]);
            } catch (deleteError) {
              logSupabaseError('delete team', deleteError);
              Alert.alert('No se pudo eliminar', getErrorMessage(deleteError, 'Prueba de nuevo.'));
            } finally {
              setDeletingTeam(false);
            }
          },
        },
      ],
    );
  };

  if (loading && !publicTeam) {
    return (
      <View style={s.loadingRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  if (error || !publicTeam) {
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

  const cityLabel = publicTeam.city || privateTeam?.venue?.city || 'Ciudad por definir';
  const locationCopy = privateTeam?.venue
    ? [privateTeam.venue.canonical_name, privateTeam.venue.address].filter(Boolean).join(', ')
    : 'El campo se decide en cada partido.';
  const metaParts = [cityLabel];
  if (privateTeam) {
    metaParts.push(privateTeam.price_per_player > 0
      ? `${privateTeam.price_per_player} € habituales`
      : 'Sin precio habitual');
  }

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
        {canManage ? (
          <Pressable
            style={({ pressed }) => [s.headerBtn, pressed && s.pressed]}
            onPress={() => void shareInvite()}
            accessibilityRole="button"
            accessibilityLabel="Compartir invitación del equipo"
          >
            <Ionicons name="share-outline" size={20} color={c.brand} />
          </Pressable>
        ) : <View style={s.headerBtn} />}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadGroup(true)} tintColor={c.brand} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.titleBlock}>
          <View style={s.identityRow}>
            <Pressable
              accessibilityRole={canManage ? 'button' : undefined}
              accessibilityLabel={canManage ? 'Editar foto del equipo' : undefined}
              disabled={!canManage}
              onPress={() => setEditVisible(true)}
              style={({ pressed }) => [s.teamAvatar, pressed && canManage && s.pressed]}
            >
              <ProfileAvatar name={publicTeam.title} avatarUrl={publicTeam.avatar_url} size={76} textSize={23} />
              {canManage && (
                <View style={s.cameraBadge}>
                  <Ionicons name="camera" size={14} color={c.brandInk} />
                </View>
              )}
            </Pressable>
            <View style={s.identityCopy}>
              <Badge
                label={isCaptain ? 'Equipo · Capitán' : 'Equipo'}
                color={c.brand}
                bg={c.brandSoft}
                border="rgba(34,197,94,0.3)"
              />
              <Text style={s.titleText}>{publicTeam.title}</Text>
              <Text style={s.teamMeta}>{metaParts.join(' · ')}</Text>
            </View>
          </View>
          {!!publicTeam.description && <Text style={s.description}>{publicTeam.description}</Text>}
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
            <InfoCell label="Plantilla" flex={1}>
              <Text style={s.infoCellValue}>{publicTeam.roster.length}</Text>
            </InfoCell>
            <InfoCell label="Partidos jugados" flex={1}>
              <Text style={s.infoCellValue}>{publicTeam.completed_matches}</Text>
            </InfoCell>
          </View>
        </View>

        {canManage && (
          <View style={s.ctaBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Crear un partido del equipo"
              onPress={() => router.push({ pathname: '/(tabs)/create', params: { teamId: publicTeam.id } } as never)}
              style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}
            >
              <View style={s.primaryButtonContent}>
                <Ionicons name="add-circle-outline" size={20} color={c.brand} />
                <Text style={s.primaryButtonText}>Crear partido</Text>
              </View>
            </Pressable>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>Próximos partidos ({matches.length})</Text>
          {matches.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>Aún no hay partido preparado</Text>
              <Text style={s.emptyCopy}>
                {isCaptain
                  ? 'Cuando sepáis el día, crea el partido y todos quedarán pendientes de confirmar.'
                  : 'El capitán publicará aquí el próximo partido visible para ti.'}
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

        <View style={s.section}>
          <Text style={s.sectionLabel}>Plantilla ({publicTeam.roster.length})</Text>
          {publicTeam.roster.map((member, index) => {
            const name = member.full_name || member.username || 'Jugador de Rondo';
            return (
              <PlayerRow
                key={member.id}
                user={{
                  full_name: name,
                  avatar_url: member.avatar_url,
                  preferred_position: member.preferred_position,
                }}
                onPress={() => router.push(`/user/${member.id}` as never)}
                isLast={index === publicTeam.roster.length - 1}
                rightContent={member.is_captain ? (
                    <View style={s.captainBadge}>
                      <Ionicons name="shield-checkmark-outline" size={14} color={c.warning} />
                      <Text style={s.captainBadgeText}>Capitán</Text>
                    </View>
                  ) : canManage ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Expulsar a ${name}`}
                      onPress={(event) => {
                        event.stopPropagation();
                        removeMember(member);
                      }}
                      disabled={removingMemberId !== null}
                      style={({ pressed }) => [
                        s.removeButton,
                        pressed && s.pressed,
                        removingMemberId !== null && s.disabled,
                      ]}
                    >
                      {removingMemberId === member.id ? (
                        <ActivityIndicator color={c.danger} />
                      ) : (
                        <Text style={s.removeButtonText}>Expulsar</Text>
                      )}
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={c.textDim} />
                  )}
              />
            );
          })}
        </View>

        {recurrences.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Partidos recurrentes ({recurrences.length})</Text>
            <View style={s.recurrenceList}>
              {recurrences.map(recurrence => {
                const nextMatch = matches.find(match => match.recurrence_id === recurrence.id);
                const summary = buildRecurrenceSummary(
                  recurrence.frequency,
                  recurrence.day_of_week,
                  recurrence.week_of_month ?? 1,
                  recurrence.start_time.slice(0, 5),
                );
                return (
                  <View key={recurrence.id} style={s.recurrenceCard}>
                    <View style={s.recurrenceHeader}>
                      <View style={s.recurrenceIcon}>
                        <Ionicons name="calendar-outline" size={20} color={c.brand} />
                      </View>
                      <View style={s.recurrenceCopy}>
                        <Text style={s.recurrenceTitle}>{nextMatch?.title ?? publicTeam.title}</Text>
                        {!!summary && <Text style={s.recurrenceSchedule}>{summary}</Text>}
                        <Text style={s.recurrenceNext}>
                          {nextMatch
                            ? `Próximo: ${formatDate(nextMatch.date_time)} · ${formatTime(nextMatch.date_time)}`
                            : 'El siguiente partido aún no está preparado'}
                        </Text>
                      </View>
                    </View>
                    {canManage && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Anular recurrencia"
                        disabled={cancellingRecurrenceId !== null}
                        onPress={() => cancelRecurrence(recurrence)}
                        style={({ pressed }) => [
                          s.cancelRecurrenceButton,
                          (pressed || cancellingRecurrenceId !== null) && s.pressed,
                        ]}
                      >
                        {cancellingRecurrenceId === recurrence.id ? (
                          <ActivityIndicator color={c.danger} />
                        ) : (
                          <Text style={s.cancelRecurrenceText}>Anular recurrencia</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {canManage && (
          <>
            <View style={s.section}>
              <Text style={s.sectionLabel}>Gestión del equipo</Text>
              <View style={s.managementCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar equipo"
                  onPress={() => setEditVisible(true)}
                  style={({ pressed }) => [s.actionPressable, pressed && s.pressed]}
                >
                  <View style={s.actionRowContent}>
                    <View style={s.managementCopy}>
                      <Text style={s.managementTitle}>Editar equipo</Text>
                      <Text style={s.managementSubtitle}>Foto, nombre, ciudad, descripción y precio</Text>
                    </View>
                    <Ionicons name="create-outline" size={22} color={c.brand} />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Compartir invitación del equipo"
                  onPress={() => void shareInvite()}
                  style={({ pressed }) => [s.actionPressable, s.actionPressableLast, pressed && s.pressed]}
                >
                  <View style={s.actionRowContent}>
                    <View style={s.managementCopy}>
                      <Text style={s.managementTitle}>Compartir invitación</Text>
                      <Text style={s.managementSubtitle}>Suma jugadores a la plantilla</Text>
                    </View>
                    <Ionicons name="share-social-outline" size={22} color={c.brand} />
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={[s.section, s.lastSection]}>
              <Text style={s.sectionLabel}>Zona peligrosa</Text>
              <View style={s.dangerCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar equipo"
                  onPress={deleteTeam}
                  disabled={deletingTeam}
                  style={({ pressed }) => [s.actionPressable, s.actionPressableLast, (pressed || deletingTeam) && s.pressed]}
                >
                  <View style={s.actionRowContent}>
                    <View style={s.managementCopy}>
                      <Text style={[s.managementTitle, { color: c.danger }]}>Eliminar equipo</Text>
                      <Text style={s.managementSubtitle}>Disponible cuando no haya partidos futuros</Text>
                    </View>
                    {deletingTeam ? (
                      <ActivityIndicator color={c.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={22} color={c.danger} />
                    )}
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {privateTeam && canManage && (
        <TeamEditModal
          visible={editVisible}
          team={privateTeam}
          saving={savingTeam}
          onClose={() => setEditVisible(false)}
          onSave={(values) => void saveTeam(values)}
        />
      )}
    </View>
  );
}

const createStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  loadingRoot: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
  scroll: { flex: 1 },
  errorContent: { flex: 1, paddingHorizontal: 24, alignItems: 'flex-start', justifyContent: 'center' },
  errorTitle: { color: c.text, fontFamily: 'Archivo_900Black', fontSize: 24, fontWeight: '900', marginTop: 20 },
  errorCopy: { color: c.textDim, lineHeight: 22, marginTop: 8 },
  titleBlock: { padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  teamAvatar: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brand,
    borderWidth: 2,
    borderColor: c.bg,
  },
  identityCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  titleText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 26,
    fontWeight: '900',
    color: c.text,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  teamMeta: { color: c.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  description: { color: c.textDim, fontSize: 14, lineHeight: 21, marginTop: 16 },
  infoSection: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border },
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
  locationIcon: { marginTop: 1 },
  locationBody: { flex: 1, minWidth: 0 },
  locationName: { color: c.text, fontSize: 14, fontWeight: '700' },
  locationCopy: { color: c.textDim, fontSize: 12, lineHeight: 18, marginTop: 3 },
  infoRow: { flexDirection: 'row', gap: 10 },
  infoCellValue: {
    fontFamily: 'Archivo_900Black',
    fontSize: 18,
    fontWeight: '900',
    color: c.brand,
    textAlign: 'center',
  },
  ctaBlock: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  primaryButton: {
    minHeight: 52,
    width: '100%',
    borderRadius: 14,
    backgroundColor: c.brandSoft,
    borderWidth: 2,
    borderColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.brandGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  primaryButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: {
    color: c.brand,
    fontFamily: 'Archivo_900Black',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  lastSection: { borderBottomWidth: 0 },
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
  emptyTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
  emptyCopy: { color: c.textDim, fontSize: 13, lineHeight: 20, marginTop: 6 },
  cardList: { gap: 12 },
  recurrenceList: { gap: 10 },
  recurrenceCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${c.brand}35`,
    backgroundColor: c.bgSurface,
    padding: 14,
  },
  recurrenceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recurrenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brandSoft,
  },
  recurrenceCopy: { flex: 1, minWidth: 0 },
  recurrenceTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  recurrenceSchedule: { color: c.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  recurrenceNext: { color: c.brand, fontSize: 12, fontWeight: '700', marginTop: 7 },
  cancelRecurrenceButton: {
    minHeight: 48,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  cancelRecurrenceText: { color: c.danger, fontSize: 12, fontWeight: '800' },
  captainBadge: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: `${c.warning}50`,
    backgroundColor: `${c.warning}15`,
  },
  captainBadgeText: { color: c.warning, fontSize: 11, fontWeight: '800' },
  removeButton: {
    minWidth: 64,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${c.danger}60`,
    borderRadius: 9,
    paddingHorizontal: 10,
  },
  removeButtonText: { color: c.danger, fontSize: 11, fontWeight: '800' },
  managementCard: {
    overflow: 'hidden',
    backgroundColor: c.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  actionPressable: { borderBottomWidth: 1, borderBottomColor: c.border },
  actionPressableLast: { borderBottomWidth: 0 },
  actionRowContent: {
    minHeight: 68,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
  },
  managementCopy: { flex: 1, minWidth: 0 },
  managementTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  managementSubtitle: { color: c.textDim, fontSize: 12, lineHeight: 18, marginTop: 3 },
  dangerCard: {
    overflow: 'hidden',
    backgroundColor: `${c.danger}0D`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${c.danger}45`,
  },
});
