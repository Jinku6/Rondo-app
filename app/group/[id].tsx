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
import { Badge, InfoCell, PlayerRow, ProfileAvatar } from '@/components/match/MatchDetailParts';
import { TeamEditModal, type TeamEditValues } from '@/components/team/TeamEditModal';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { uploadAvatar } from '@/lib/avatarUpload';
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
  const [editVisible, setEditVisible] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);

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
          .is('deleted_at', null)
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

  const saveTeam = async (values: TeamEditValues) => {
    if (!group || !isOrganizer || !user?.id) return;
    setSavingTeam(true);
    try {
      const avatarUrl = values.avatarAsset
        ? await uploadAvatar({
          asset: values.avatarAsset,
          ownerId: user.id,
          folder: `teams/${group.id}`,
        })
        : values.avatarUrl;
      const { error: updateError } = await supabase.rpc('update_team_details', {
        p_team_id: group.id,
        p_title: values.title,
        p_city: values.city,
        p_price_per_player: values.pricePerPlayer,
        p_avatar_url: avatarUrl,
      });
      if (updateError) throw updateError;
      setGroup({
        ...group,
        title: values.title,
        city: values.city,
        price_per_player: values.pricePerPlayer,
        avatar_url: avatarUrl,
      });
      setEditVisible(false);
      Alert.alert('Equipo actualizado', 'Todo listo para la próxima pachanga.');
    } catch (updateError) {
      logSupabaseError('update team details', updateError);
      Alert.alert('No se pudo guardar', getErrorMessage(updateError, 'Revisa los datos y prueba de nuevo.'));
    } finally {
      setSavingTeam(false);
    }
  };

  const removeMember = (member: SeriesMember) => {
    if (!isOrganizer) return;
    const name = member.user?.full_name || member.user?.username || 'este jugador';
    Alert.alert('Expulsar jugador', `${name} saldrá de la plantilla y perderá sus reservas pendientes en futuros partidos privados. Las plazas que ya confirmó se mantienen.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Expulsar',
        style: 'destructive',
        onPress: async () => {
          setRemovingMemberId(member.id);
          try {
            const { error: removeError } = await supabase.rpc('remove_team_member', {
              p_team_id: group.id,
              p_user_id: member.user_id,
            });
            if (removeError) throw removeError;
            setMembers(current => current.filter(item => item.id !== member.id));
            Alert.alert('Jugador expulsado', `${name} ya no forma parte de la plantilla.`);
          } catch (removeError) {
            logSupabaseError('remove team member', removeError);
            Alert.alert('No se pudo expulsar', getErrorMessage(removeError, 'Prueba de nuevo.'));
          } finally {
            setRemovingMemberId(null);
          }
        },
      },
    ]);
  };

  const deleteTeam = () => {
    if (!group || !isOrganizer) return;
    if (matches.length > 0) {
      Alert.alert(
        'Aún hay pachangas pendientes',
        'Cancela o finaliza los partidos futuros antes de eliminar el equipo.',
      );
      return;
    }

    Alert.alert(
      'Eliminar equipo',
      `${group.title} desaparecerá de Rondo y el enlace dejará de funcionar. El historial de partidos se conservará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar equipo',
          style: 'destructive',
          onPress: async () => {
            setDeletingTeam(true);
            try {
              const { error: deleteError } = await supabase.rpc('delete_team', {
                p_team_id: group.id,
              });
              if (deleteError) throw deleteError;
              Alert.alert('Equipo eliminado', 'El vestuario conserva el historial de sus pachangas.', [
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
          <View style={s.identityRow}>
            <Pressable
              accessibilityRole={isOrganizer ? 'button' : undefined}
              accessibilityLabel={isOrganizer ? 'Editar foto del equipo' : undefined}
              disabled={!isOrganizer}
              onPress={() => setEditVisible(true)}
              style={({ pressed }) => [s.teamAvatar, pressed && isOrganizer && s.pressed]}
            >
              <ProfileAvatar name={group.title} avatarUrl={group.avatar_url} size={76} textSize={23} />
              {isOrganizer && (
                <View style={s.cameraBadge}>
                  <Ionicons name="camera" size={14} color={c.brandInk} />
                </View>
              )}
            </Pressable>
            <View style={s.identityCopy}>
              <Badge
                label="Equipo"
                color={c.brand}
                bg={c.brandSoft}
                border="rgba(34,197,94,0.3)"
              />
              <Text style={s.titleText}>{group.title}</Text>
              <Text style={s.teamMeta}>
                {cityLabel} · {group.price_per_player > 0 ? `${group.price_per_player} € habituales` : 'Sin precio habitual'}
              </Text>
            </View>
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
              style={({ pressed }) => [s.primaryButton, pressed && s.pressed]}
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

        <View style={s.section}>
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
                    accessibilityLabel={`Expulsar a ${name}`}
                    onPress={() => removeMember(member)}
                    disabled={removingMemberId !== null}
                    style={({ pressed }) => [s.removeButton, pressed && s.pressed, removingMemberId !== null && s.disabled]}
                  >
                    {removingMemberId === member.id ? (
                      <ActivityIndicator color={c.danger} />
                    ) : (
                      <Text style={s.removeButtonText}>Expulsar</Text>
                    )}
                  </Pressable>
                ) : undefined}
              />
            );
          })}
        </View>

        {isOrganizer && (
          <>
            <View style={s.section}>
              <Text style={s.sectionLabel}>Gestión del equipo</Text>
              <View style={s.managementCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar equipo"
                  onPress={() => setEditVisible(true)}
                  style={({ pressed }) => [s.managementRow, pressed && s.pressed]}
                >
                  <View style={s.managementIcon}>
                    <Ionicons name="create-outline" size={20} color={c.brand} />
                  </View>
                  <View style={s.managementCopy}>
                    <Text style={s.managementTitle}>Editar equipo</Text>
                    <Text style={s.managementSubtitle}>Foto, nombre, ciudad y precio habitual</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textDim} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Compartir invitación del equipo"
                  onPress={() => void shareInvite()}
                  style={({ pressed }) => [s.managementRow, s.managementRowLast, pressed && s.pressed]}
                >
                  <View style={s.managementIcon}>
                    <Ionicons name="share-social-outline" size={20} color={c.brand} />
                  </View>
                  <View style={s.managementCopy}>
                    <Text style={s.managementTitle}>Compartir invitación</Text>
                    <Text style={s.managementSubtitle}>Suma jugadores a la plantilla</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textDim} />
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
                  style={({ pressed }) => [s.managementRow, s.managementRowLast, (pressed || deletingTeam) && s.pressed]}
                >
                  <View style={[s.managementIcon, s.dangerIcon]}>
                    <Ionicons name="trash-outline" size={20} color={c.danger} />
                  </View>
                  <View style={s.managementCopy}>
                    <Text style={[s.managementTitle, { color: c.danger }]}>Eliminar equipo</Text>
                    <Text style={s.managementSubtitle}>Disponible cuando no haya partidos futuros</Text>
                  </View>
                  {deletingTeam ? (
                    <ActivityIndicator color={c.danger} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={c.danger} />
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <TeamEditModal
        visible={editVisible}
        team={group}
        saving={savingTeam}
        onClose={() => setEditVisible(false)}
        onSave={(values) => void saveTeam(values)}
      />
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
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  teamAvatar: {
    position: 'relative',
  },
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
  identityCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  titleText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 26,
    fontWeight: '900',
    color: c.text,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  teamMeta: {
    color: c.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
  removeButtonText: {
    color: c.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  managementCard: {
    overflow: 'hidden',
    backgroundColor: c.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  managementRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  managementRowLast: {
    borderBottomWidth: 0,
  },
  managementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brandSoft,
  },
  managementCopy: {
    flex: 1,
    minWidth: 0,
  },
  managementTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '800',
  },
  managementSubtitle: {
    color: c.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  dangerCard: {
    overflow: 'hidden',
    backgroundColor: c.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${c.danger}40`,
  },
  dangerIcon: {
    backgroundColor: `${c.danger}18`,
  },
});
