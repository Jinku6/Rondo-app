import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ArrowRight, Share2 } from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Match, MatchParticipant } from '@/types/database';
import {
  Badge,
  formatDate,
  formatTime,
  InfoCell,
  LEVEL_CONFIG,
  PlayerRow,
  POSITION_CONFIG,
  positionChips,
  ProfileAvatar,
  reliabilityLabel,
  STATUS_CONFIG,
  totalSlots,
} from '@/components/match/MatchDetailParts';

type SeriesResponse = 'pending' | 'joined' | 'declined';

type Props = {
  match: Match;
  participants: MatchParticipant[];
  isOrganizer: boolean;
  isArchived: boolean;
  isJoined: boolean;
  isPending: boolean;
  isSeriesMatch: boolean;
  seriesResponse: SeriesResponse | null;
  ctaDisabled: boolean;
  actionLoading: boolean;
  locationLabel: string;
  getCtaLabel: () => string;
  onOpenMaps: () => void;
  onOrganizerPress: (organizerId: string) => void;
  onOrganizerChatPress: () => void;
  onJoin: () => void;
  onSeriesResponse: (response: Exclude<SeriesResponse, 'pending'>) => void;
  onLeave: () => void;
  onFinalize: () => void;
  onCancelMatch: () => void;
  onShare: () => void;
  onApprove: (participantId: string) => void;
  onReject: (participantId: string) => void;
  onPlayerPress: (userId?: string) => void;
  onPlayerChatPress: (playerId: string) => void;
};

export function MatchDetailContent({
  match,
  participants,
  isOrganizer,
  isArchived,
  isJoined,
  isPending,
  isSeriesMatch,
  seriesResponse,
  ctaDisabled,
  actionLoading,
  locationLabel,
  getCtaLabel,
  onOpenMaps,
  onOrganizerPress,
  onOrganizerChatPress,
  onJoin,
  onSeriesResponse,
  onLeave,
  onFinalize,
  onCancelMatch,
  onShare,
  onApprove,
  onReject,
  onPlayerPress,
  onPlayerChatPress,
}: Props) {
  const { colors: c } = useTheme();
  const s = createStyles(c);
  const levelCfg = LEVEL_CONFIG[match.level];
  const statusCfg = STATUS_CONFIG[match.status] ?? STATUS_CONFIG.open;
  const organizer = match.organizer;
  const joinedParticipants = participants.filter(
    p => p.status === 'joined' || p.status === 'approved',
  );
  const pendingParticipants = participants.filter(p => p.status === 'pending');
  const nonOrganizerJoined = joinedParticipants.filter(
    p => p.user_id !== match.organizer_id,
  );
  const slots = totalSlots(match.requested_positions);
  const filled = joinedParticipants.length;
  const chips = positionChips(match.requested_positions);

  return (
    <>
      <View style={s.titleBlock}>
        <Text style={s.titleText}>{match.title.toUpperCase()}</Text>
        <View style={s.badgeRow}>
          <Badge {...levelCfg} />
          <Badge {...statusCfg} />
        </View>
        {!!match.description && (
          <Text style={s.quote}>{`"${match.description}"`}</Text>
        )}
      </View>

      <View style={s.infoSection}>
        <Pressable
          style={({ pressed }) => [s.locationCard, pressed && { opacity: 0.8 }]}
          onPress={onOpenMaps}
          accessibilityRole="link"
          accessibilityLabel={`Cómo llegar a ${locationLabel}`}
        >
          <Ionicons name="location-outline" size={18} color={c.brand} style={s.locationIcon} />
          <View style={s.locationBody}>
            <Text style={s.locationName}>{locationLabel}</Text>
            {!!match.location_city && (
              <Text style={s.locationCity}>{match.location_city}</Text>
            )}
            <Text style={s.locationLink}>Como llegar →</Text>
          </View>
        </Pressable>

        <View style={s.infoRow}>
          <InfoCell label="Fecha" flex={1}>
            <Text style={s.infoCellValue}>{formatDate(match.date_time)}</Text>
          </InfoCell>
          <InfoCell label="Hora" flex={1}>
            <Text style={s.infoCellValue}>{formatTime(match.date_time)}</Text>
          </InfoCell>
        </View>

        <View style={s.infoRow}>
          <InfoCell label="Precio" flex={1}>
            <Text
              style={[
                s.infoCellValue,
                { color: match.price_per_player > 0 ? c.brand : c.textDim },
              ]}
            >
              {match.price_per_player > 0 ? `${match.price_per_player}€` : 'Gratis'}
            </Text>
          </InfoCell>
          <InfoCell label="Colores" flex={1}>
            <View style={s.swatchRow}>
              {match.team_a_color ? (
                <View style={[s.swatch, { backgroundColor: match.team_a_color }]} />
              ) : null}
              <Text style={{ color: c.textMuted, fontSize: 10 }}>VS</Text>
              {match.team_b_color ? (
                <View style={[s.swatch, { backgroundColor: match.team_b_color }]} />
              ) : null}
            </View>
          </InfoCell>
        </View>

        <InfoCell label="Cupos">
          <Text style={s.cuposValue}>
            {filled}
            <Text style={s.cuposTotal}>/{slots}</Text>
          </Text>
        </InfoCell>
      </View>

      {chips.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Posiciones solicitadas</Text>
          <View style={s.posRow}>
            {chips.map(({ key, count }) => {
              const cfg = POSITION_CONFIG[key];
              return (
                <View key={key} style={s.posChip}>
                  <Text style={s.posChipCount}>{count}×</Text>
                  <Text style={s.posChipLabel}>
                    {cfg.icon} {cfg.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {organizer && (
        <View style={s.section}>
          <View style={s.orgRow}>
            <Pressable
              style={s.orgLeft}
              onPress={() => onOrganizerPress(organizer.id)}
              accessibilityRole="button"
              accessibilityLabel={`Ver perfil de ${organizer.full_name}`}
            >
              <ProfileAvatar
                name={organizer.full_name}
                avatarUrl={organizer.avatar_url}
                size={44}
                textSize={15}
              />
              <View style={s.orgInfo}>
                <Text style={s.orgLabel}>Organiza</Text>
                <Text style={s.orgName}>{organizer.full_name}</Text>
                <Text style={[s.orgReliability, { color: c.brand }]}>
                  {reliabilityLabel(organizer.reliability_score, organizer.matches_played)}
                </Text>
              </View>
            </Pressable>
            {!isOrganizer && (
              <Pressable
                style={({ pressed }) => [s.chatChip, pressed && { opacity: 0.65 }]}
                onPress={onOrganizerChatPress}
                accessibilityRole="button"
                accessibilityLabel="Chat con el organizador"
                hitSlop={6}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={c.brand} />
                <Text style={s.chatChipText}>Chat</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={s.ctaBlock}>
        {isArchived ? (
          <View
            style={[
              s.statusBanner,
              {
                backgroundColor:
                  match.status === 'completed' ? c.brandSoft : 'rgba(239,68,68,0.1)',
              },
            ]}
          >
            <Text
              style={[
                s.statusBannerText,
                { color: match.status === 'completed' ? c.brand : c.danger },
              ]}
            >
              {match.status === 'completed' ? '✅ Partido finalizado' : '🚫 Partido cancelado'}
            </Text>
          </View>
        ) : isSeriesMatch && !isOrganizer ? (
          <View style={s.seriesConfirmCard}>
            {seriesResponse === 'pending' ? (
              <>
                <Text style={s.seriesConfirmTitle}>¿Juegas esta pachanga?</Text>
                <Text style={s.seriesConfirmCopy}>Confirma para que el grupo sepa con quién cuenta.</Text>
                {actionLoading ? (
                  <ActivityIndicator color={c.brand} style={{ height: 48 }} />
                ) : (
                  <View style={s.seriesConfirmActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Confirmar que voy"
                      style={({ pressed }) => [s.seriesConfirmYes, pressed && { opacity: 0.7 }]}
                      onPress={() => onSeriesResponse('joined')}
                    >
                      <Ionicons name="checkmark" size={20} color={c.brandInk} />
                      <Text style={s.seriesConfirmYesText}>Voy</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Confirmar que no puedo ir"
                      style={({ pressed }) => [s.seriesConfirmNo, pressed && { opacity: 0.7 }]}
                      onPress={() => onSeriesResponse('declined')}
                    >
                      <Ionicons name="close" size={20} color={c.danger} />
                      <Text style={s.seriesConfirmNoText}>No puedo</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : seriesResponse === 'joined' ? (
              <>
                <Text style={[s.seriesResponseText, { color: c.brand }]}>Confirmado: vas a jugar</Text>
                <Pressable style={s.seriesChatButton} onPress={onOrganizerChatPress}>
                  <Ionicons name="chatbubbles-outline" size={17} color={c.brand} />
                  <Text style={s.seriesChatButtonText}>Abrir chat</Text>
                </Pressable>
              </>
            ) : seriesResponse === 'declined' ? (
              <Text style={[s.seriesResponseText, { color: c.danger }]}>Esta semana no puedes</Text>
            ) : (
              <Text style={s.seriesConfirmCopy}>Te sumas a la lista desde la próxima pachanga.</Text>
            )}
          </View>
        ) : isPending ? (
          <View style={s.pendingBlock}>
            <View style={s.pendingBanner}>
              <Text style={s.pendingBannerText}>⏳ Solicitud pendiente de aprobación</Text>
            </View>
            <Pressable style={s.btnLeave} onPress={onLeave}>
              <Text style={s.btnLeaveText}>Cancelar solicitud</Text>
            </Pressable>
          </View>
        ) : isJoined ? (
          <View style={s.joinedBlock}>
            <View style={s.joinedBanner}>
              <Text style={s.joinedBannerText}>✅ ¡Estás dentro del partido!</Text>
            </View>
            <View style={s.joinedActions}>
              <Pressable
                style={[s.joinedBtn, { borderRightWidth: 1, borderRightColor: c.border }]}
                onPress={onOrganizerChatPress}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={c.brand} />
                <Text style={s.joinedBtnText}>Chat</Text>
              </Pressable>
              <Pressable style={s.joinedBtn} onPress={onLeave}>
                <Text style={[s.joinedBtnText, { color: c.danger }]}>Baja</Text>
              </Pressable>
            </View>
          </View>
        ) : !isOrganizer && (
          <Pressable
            className="min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-md-r bg-brand px-5 py-3.5"
            style={({ pressed }) => [
              s.primaryCtaShadow,
              (ctaDisabled || pressed) && { opacity: 0.65 },
            ]}
            onPress={!ctaDisabled ? onJoin : undefined}
            disabled={ctaDisabled || actionLoading}
            accessibilityRole="button"
            accessibilityLabel={getCtaLabel()}
          >
            {actionLoading ? (
              <ActivityIndicator color={c.brandInk} />
            ) : (
              <>
                <Text className="font-display text-base font-extrabold uppercase tracking-[0.64px] text-white">
                  {getCtaLabel().replace(' →', '')}
                </Text>
                {!ctaDisabled && <ArrowRight size={18} color={c.brandInk} />}
              </>
            )}
          </Pressable>
        )}

        {isOrganizer && !isArchived && (
          <View style={s.orgPanel}>
            <Text style={s.orgPanelTitle}>Panel de Organizador</Text>
            <Pressable
              style={[s.btnPrimary, { backgroundColor: c.brand }]}
              onPress={onFinalize}
              disabled={actionLoading}
            >
              <View style={s.btnRow}>
                <Ionicons name="flag-outline" size={18} color="#000" />
                <Text style={s.btnPrimaryText}>Finalizar Partido</Text>
              </View>
            </Pressable>
            <Pressable
              style={s.btnDangerGhost}
              onPress={onCancelMatch}
              disabled={actionLoading}
            >
              <Text style={s.btnDangerGhostText}>Cancelar Partido</Text>
            </Pressable>
          </View>
        )}

        {!isArchived && !isSeriesMatch && (
          <Pressable
            className="min-h-[52px] w-full flex-row items-center justify-center gap-2 rounded-md-r border border-border bg-bg-surface px-5 py-3.5"
            style={({ pressed }) => pressed && { opacity: 0.7 }}
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Compartir partido"
          >
            <Share2 size={18} color={c.text} />
            <Text className="font-display text-base font-extrabold uppercase tracking-[0.64px] text-ink">
              Compartir partido
            </Text>
          </Pressable>
        )}
      </View>

      {isOrganizer && !isSeriesMatch && pendingParticipants.length > 0 && !isArchived && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Solicitudes Pendientes ({pendingParticipants.length})</Text>
          {pendingParticipants.map(p => (
            <View key={p.id} style={s.pendingCard}>
              <PlayerRow
                participant={p}
                onPress={() => onPlayerPress(p.user?.id)}
                isLast
                rightContent={
                  <View className="flex-row gap-2">
                    <Pressable style={s.actionBtnCheck} onPress={() => onApprove(p.id)}>
                      <Ionicons name="checkmark" size={18} color={c.brand} />
                    </Pressable>
                    <Pressable style={s.actionBtnClose} onPress={() => onReject(p.id)}>
                      <Ionicons name="close" size={18} color={c.danger} />
                    </Pressable>
                  </View>
                }
              />
            </View>
          ))}
        </View>
      )}

      <View style={[s.section, { borderBottomWidth: 0 }]}>
        <Text className="mb-2.5 font-mono text-[9px] font-bold uppercase tracking-[1.5px] text-ink-dim">
          JUGADORES APUNTADOS ({nonOrganizerJoined.length})
        </Text>
        {nonOrganizerJoined.map((p, index) => (
          <PlayerRow
            key={p.id}
            participant={p}
            onPress={() => onPlayerPress(p.user?.id)}
            isLast={index === nonOrganizerJoined.length - 1}
            rightContent={
              isOrganizer ? (
                <Pressable
                  onPress={() => onPlayerChatPress(p.user_id)}
                  className="p-1.5"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={c.brand} />
                </Pressable>
              ) : undefined
            }
          />
        ))}
        {nonOrganizerJoined.length === 0 && (
          <Text style={s.emptyText}>Aún no hay otros jugadores apuntados.</Text>
        )}
      </View>
    </>
  );
}

const createStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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
    marginBottom: 8,
  },
  quote: {
    fontSize: 12,
    color: c.textDim,
    fontStyle: 'italic',
    marginTop: 2,
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
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  locationCity: {
    fontSize: 12,
    color: c.textDim,
    marginTop: 2,
  },
  locationLink: {
    fontSize: 11,
    fontWeight: '600',
    color: c.brand,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCellValue: {
    fontFamily: 'Archivo_900Black',
    fontSize: 16,
    fontWeight: '900',
    color: c.text,
    textAlign: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  cuposValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 18,
    fontWeight: '700',
    color: c.brand,
  },
  cuposTotal: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 12,
    color: c.textDim,
    fontWeight: '400',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
  posRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  posChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: c.brandSoft,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  posChipCount: {
    fontFamily: 'Archivo_900Black',
    fontSize: 14,
    fontWeight: '900',
    color: c.brand,
  },
  posChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.brand,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orgLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orgInfo: {
    flex: 1,
    minWidth: 0,
  },
  orgLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.2,
    color: c.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orgName: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
    marginTop: 2,
  },
  orgReliability: {
    fontSize: 11,
    marginTop: 2,
  },
  chatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: c.brandSoft,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    flexShrink: 0,
  },
  chatChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: c.brand,
  },
  ctaBlock: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  primaryCtaShadow: {
    shadowColor: c.brandGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  btnPrimary: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brand,
    borderRadius: 14,
    shadowColor: c.brandGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  btnPrimaryText: {
    fontFamily: 'Archivo_900Black',
    fontSize: 16,
    fontWeight: '800',
    color: c.brandInk,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBanner: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerText: {
    fontWeight: '700',
    fontSize: 14,
  },
  seriesConfirmCard: {
    backgroundColor: c.bgElev,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  seriesConfirmTitle: {
    fontFamily: 'Archivo_900Black',
    color: c.text,
    fontSize: 18,
    fontWeight: '800',
  },
  seriesConfirmCopy: {
    color: c.textDim,
    fontSize: 13,
    lineHeight: 19,
  },
  seriesConfirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  seriesConfirmYes: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  seriesConfirmYesText: {
    color: c.brandInk,
    fontSize: 14,
    fontWeight: '800',
  },
  seriesConfirmNo: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  seriesConfirmNoText: {
    color: c.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  seriesResponseText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  seriesChatButton: {
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  seriesChatButtonText: {
    color: c.brand,
    fontSize: 14,
    fontWeight: '700',
  },
  pendingBlock: {
    gap: 10,
  },
  pendingBanner: {
    padding: 14,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    alignItems: 'center',
  },
  pendingBannerText: {
    color: c.warning,
    fontWeight: '700',
    fontSize: 13,
  },
  btnLeave: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  btnLeaveText: {
    color: c.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  joinedBlock: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  joinedBanner: {
    backgroundColor: c.brandSoft,
    padding: 12,
    alignItems: 'center',
  },
  joinedBannerText: {
    color: c.brand,
    fontWeight: '700',
    fontSize: 13,
  },
  joinedActions: {
    flexDirection: 'row',
    backgroundColor: c.bgSurface,
  },
  joinedBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  joinedBtnText: {
    color: c.brand,
    fontWeight: '700',
    fontSize: 14,
  },
  orgPanel: {
    backgroundColor: c.bgElev,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  orgPanelTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: c.brand,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  btnDangerGhost: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  btnDangerGhostText: {
    color: c.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  pendingCard: {
    backgroundColor: c.bgSurface,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.1)',
  },
  actionBtnCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
