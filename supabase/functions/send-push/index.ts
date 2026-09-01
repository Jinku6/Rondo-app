import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { createServiceClient, getBearerToken } from '../_shared/supabase.ts';
import { hasRecentPush, normalizePreview, sendPushMessages } from '../_shared/push.ts';

type WebhookPayload<T = Record<string, unknown>> = {
  record?: T;
  old_record?: T;
};

type MatchRow = {
  id: string;
  organizer_id: string;
  title: string;
  status?: string;
  series_id?: string | null;
  is_private?: boolean;
  recruiting_public?: boolean;
  team?: { title: string } | null;
};

type ParticipantRow = {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  match_id: string;
  type: string;
};

type ChatMessageRow = {
  id: string;
  match_id: string;
  player_id: string;
  sender_id: string;
  content: string;
};

const activeStatuses = ['joined', 'approved'];

const isPrivateTeamMatch = (match: MatchRow) =>
  !!match.series_id && match.is_private === true && match.recruiting_public === false;

const getTeamTitle = (match: MatchRow) => match.team?.title ?? 'tu equipo';

const getDisplayName = (user?: { full_name?: string | null; username?: string | null } | null) =>
  user?.full_name || user?.username || 'Un jugador';

function assertWebhookSecret(req: Request) {
  const expectedSecret = Deno.env.get('SEND_PUSH_WEBHOOK_SECRET');
  const providedSecret = getBearerToken(req);
  return !!expectedSecret && providedSecret === expectedSecret;
}

async function loadMatch(matchId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('matches')
    .select('id, organizer_id, title, status, series_id, is_private, recruiting_public, team:match_series(title)')
    .eq('id', matchId)
    .maybeSingle();

  if (error) throw error;
  return data as MatchRow | null;
}

async function loadUser(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('full_name, username')
    .eq('id', userId)
    .maybeSingle();

  return data as { full_name?: string | null; username?: string | null } | null;
}

async function handleParticipantInsert(record?: ParticipantRow) {
  if (!record || record.status !== 'pending') return { ignored: true };

  const match = await loadMatch(record.match_id);
  if (!match) return { ignored: true };

  if (isPrivateTeamMatch(match)) {
    return sendPushMessages([{
      userId: record.user_id,
      type: 'team_match_created',
      title: `Nuevo partido con ${getTeamTitle(match)}`,
      body: 'Confirma tu asistencia.',
      matchId: match.id,
      url: `/match/${match.id}`,
      dedupeKey: `team_match_created:${match.id}:${record.user_id}`,
    }]);
  }

  const user = await loadUser(record.user_id);

  return sendPushMessages([{
    userId: match.organizer_id,
    type: 'participant_request',
    title: '⚽ Nuevo fichaje esperando tu aprobación',
    body: `${getDisplayName(user)} quiere jugar ${match.title}. Échale un ojo.`,
    matchId: match.id,
    url: `/match/${match.id}`,
    dedupeKey: `participant_request:${record.id}`,
  }]);
}

async function handleParticipantUpdate(record?: ParticipantRow, oldRecord?: ParticipantRow) {
  if (!record || !oldRecord) return { ignored: true };

  if (
    oldRecord.status === 'pending' &&
    ['joined', 'approved'].includes(record.status)
  ) {
    const match = await loadMatch(record.match_id);
    if (!match) return { ignored: true };

    return sendPushMessages([{
      userId: record.user_id,
      type: 'participant_accepted',
      title: '¡Fichado! Ya estás dentro del partido',
      body: `${match.title} te espera. Lleva botas y ganas.`,
      matchId: match.id,
      url: `/match/${match.id}`,
      dedupeKey: `participant_accepted:${record.id}`,
    }]);
  }

  if (activeStatuses.includes(oldRecord.status) && record.status === 'dropped') {
    const match = await loadMatch(record.match_id);
    if (!match || match.status === 'cancelled' || match.status === 'completed') return { ignored: true };

    return sendPushMessages([{
      userId: match.organizer_id,
      type: 'participant_left',
      title: '🔄 Se ha lesionado un jugador',
      body: `Hay un hueco en ${match.title}. Toca salir del banquillo.`,
      matchId: match.id,
      url: `/match/${match.id}`,
      dedupeKey: `participant_left:${record.id}:${record.status}`,
    }]);
  }

  return { ignored: true };
}

async function handleParticipantDelete(oldRecord?: ParticipantRow) {
  if (!oldRecord || !activeStatuses.includes(oldRecord.status)) return { ignored: true };

  const match = await loadMatch(oldRecord.match_id);
  if (!match || match.status === 'cancelled' || match.status === 'completed') return { ignored: true };

  return sendPushMessages([{
    userId: match.organizer_id,
    type: 'participant_left',
    title: '🔄 Se ha lesionado un jugador',
    body: `Hay un hueco en ${match.title}. Toca salir del banquillo.`,
    matchId: match.id,
    url: `/match/${match.id}`,
    dedupeKey: `participant_left:${oldRecord.id}:deleted`,
  }]);
}

async function handleMatchUpdate(record?: MatchRow, oldRecord?: MatchRow) {
  if (!record || !oldRecord) return { ignored: true };
  const messages = [];

  if (oldRecord.status === 'open' && record.status === 'full') {
    const isTeamMatch = !!record.series_id;
    messages.push({
      userId: record.organizer_id,
      type: 'match_full' as const,
      title: isTeamMatch ? 'Plantilla completa ✅' : 'Tu partido está completo ✅',
      body: isTeamMatch
        ? `¡${record.title} ya tiene a todos los jugadores listos!`
        : `${record.title} ya tiene todos los huecos cubiertos. Se acabó perseguir gente.`,
      matchId: record.id,
      url: `/match/${record.id}`,
      dedupeKey: `match_full:${record.id}`,
    });
  }

  if (record.status === 'cancelled' && oldRecord.status !== 'cancelled') {
    const supabase = createServiceClient();
    const { data: participants } = await supabase
      .from('match_participants')
      .select('user_id')
      .eq('match_id', record.id)
      .in('status', activeStatuses);

    for (const participant of participants ?? []) {
      messages.push({
        userId: participant.user_id,
        type: 'match_cancelled' as const,
        title: '⚠️ Partido cancelado',
        body: `${record.title} se ha cancelado. Mejor avisado que plantado.`,
        matchId: record.id,
        url: `/match/${record.id}`,
        dedupeKey: `match_cancelled:${record.id}:${participant.user_id}`,
      });
    }
  }

  if (messages.length === 0) return { ignored: true };
  return sendPushMessages(messages);
}

async function handleNotificationInsert(record?: NotificationRow) {
  if (!record) return { ignored: true };

  if (record.type === 'team_match_published') {
    const match = await loadMatch(record.match_id);
    if (!match?.series_id || !match.is_private || !match.recruiting_public) return { ignored: true };

    return sendPushMessages([{
      userId: record.user_id,
      type: 'team_match_published',
      title: `El partido de ${getTeamTitle(match)} está abierto`,
      body: '¡Aún estás a tiempo de unirte!',
      matchId: match.id,
      url: `/match/${match.id}`,
      dedupeKey: `team_match_published:${match.id}:${record.user_id}`,
    }]);
  }

  if (!['pending_organizer_review', 'pending_player_review'].includes(record.type)) {
    return { ignored: true };
  }

  const match = await loadMatch(record.match_id);
  if (!match) return { ignored: true };

  const isOrganizerReview = record.type === 'pending_organizer_review';

  return sendPushMessages([{
    userId: record.user_id,
    type: isOrganizerReview ? 'review_organizer' : 'review_player',
    title: isOrganizerReview ? '📝 Toca pasar lista' : '⭐ Valora a los compañeros',
    body: isOrganizerReview
      ? `Confirma quién jugó en ${match.title} y deja el partido cerrado.`
      : `Cuéntanos cómo fue ${match.title}. Dos toques y listo.`,
    matchId: match.id,
    url: isOrganizerReview ? `/match/review-organizer/${match.id}` : `/match/review-player/${match.id}`,
    dedupeKey: `${record.type}:${record.id}`,
  }]);
}

async function handleChatInsert(record?: ChatMessageRow) {
  if (!record || !normalizePreview(record.content)) return { ignored: true };

  const [match, sender] = await Promise.all([loadMatch(record.match_id), loadUser(record.sender_id)]);
  if (!match) return { ignored: true };

  const recipientId = record.sender_id === match.organizer_id ? record.player_id : match.organizer_id;
  if (recipientId === record.sender_id) return { ignored: true };

  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  if (await hasRecentPush(recipientId, 'chat_message', since, record.match_id)) {
    return { skipped: true, reason: 'chat cooldown' };
  }

  return sendPushMessages([{
    userId: recipientId,
    type: 'chat_message',
    title: `${getDisplayName(sender)} te ha escrito un mensaje`,
    body: normalizePreview(record.content),
    matchId: record.match_id,
    url: `/chat/${record.match_id}/${record.player_id}`,
    dedupeKey: `chat_message:${record.id}:${recipientId}`,
  }]);
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;
  if (!assertWebhookSecret(req)) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  try {
    switch (type) {
      case 'participant_insert':
        return jsonResponse(await handleParticipantInsert(payload.record as ParticipantRow | undefined));
      case 'participant_update':
        return jsonResponse(await handleParticipantUpdate(
          payload.record as ParticipantRow | undefined,
          payload.old_record as ParticipantRow | undefined,
        ));
      case 'participant_delete':
        return jsonResponse(await handleParticipantDelete(payload.old_record as ParticipantRow | undefined));
      case 'match_update':
        return jsonResponse(await handleMatchUpdate(
          payload.record as MatchRow | undefined,
          payload.old_record as MatchRow | undefined,
        ));
      case 'notification_insert':
        return jsonResponse(await handleNotificationInsert(payload.record as NotificationRow | undefined));
      case 'chat_insert':
        return jsonResponse(await handleChatInsert(payload.record as ChatMessageRow | undefined));
      default:
        return jsonError('Unknown webhook type', 400);
    }
  } catch (error) {
    console.error('[send-push] handler failed', error);
    return jsonError('Push handler failed', 500);
  }
});
