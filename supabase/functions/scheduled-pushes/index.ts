import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { sendPushMessages } from '../_shared/push.ts';

type ScheduledType = 'match_reminders' | 'nearby_digest' | 'review_reminders';

type MatchRow = {
  id: string;
  title: string;
  date_time: string;
  organizer_id: string;
  location_city?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  latitude_snapshot?: number | null;
  longitude_snapshot?: number | null;
};

type MatchParticipantRow = {
  user_id: string;
  status: string;
};

type TeamMatchRow = {
  id: string;
  title: string;
  date_time: string;
  organizer_id: string;
  requested_positions: Record<string, number | string> | null;
  team: { title: string } | null;
  match_participants: MatchParticipantRow[] | null;
};

type LocationPreference = {
  user_id: string;
  city: string;
  latitude: number;
  longitude: number;
};

const SEARCH_RADIUS_KM = 20;
const NEARBY_LOOKAHEAD_HOURS = 72;
const REVIEW_REMINDER_DELAY_HOURS = 24;
const TEAM_ATTENDANCE_REMINDER_HOURS = 48;
const TEAM_PUBLISH_PROMPT_HOURS = 24;
const TEAM_PUSH_WINDOW_MINUTES = 5;
const activeStatuses = ['joined', 'approved'];

function assertCronSecret(req: Request) {
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('X-Cron-Secret');
  return !!expectedSecret && providedSecret === expectedSecret;
}

async function getRequestType(req: Request): Promise<ScheduledType | null> {
  const urlType = new URL(req.url).searchParams.get('type') as ScheduledType | null;
  if (urlType) return urlType;

  try {
    const body = await req.json() as { type?: ScheduledType };
    return body.type ?? null;
  } catch {
    return null;
  }
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function futureWindow(now: Date, hours: number) {
  const target = now.getTime() + hours * 60 * 60 * 1000;
  const margin = TEAM_PUSH_WINDOW_MINUTES * 60 * 1000;
  return {
    start: new Date(target - margin).toISOString(),
    end: new Date(target + margin).toISOString(),
  };
}

function hasAvailableTeamSpots(match: TeamMatchRow) {
  const capacity = Object.values(match.requested_positions ?? {}).reduce((total, value) => {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? total + count : total;
  }, 0);
  const participants = match.match_participants ?? [];
  const confirmed = participants.filter((participant) => activeStatuses.includes(participant.status)).length;
  return capacity > confirmed;
}

async function loadPrivateTeamMatchesAt(now: Date, hours: number) {
  const supabase = createServiceClient();
  const window = futureWindow(now, hours);
  const { data, error } = await supabase
    .from('matches')
    .select('id, title, date_time, organizer_id, requested_positions, team:match_series!inner(title), match_participants(user_id, status)')
    .not('series_id', 'is', null)
    .eq('is_private', true)
    .eq('recruiting_public', false)
    .eq('status', 'open')
    .gte('date_time', window.start)
    .lte('date_time', window.end);

  if (error) throw error;
  return (data ?? []) as unknown as TeamMatchRow[];
}

async function sendMatchReminders(now: Date) {
  const supabase = createServiceClient();
  const windowStart = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, title, date_time, organizer_id, match_participants(user_id, status)')
    .in('status', ['open', 'full'])
    .gte('date_time', windowStart)
    .lte('date_time', windowEnd);

  if (error) throw error;

  const messages = [];

  for (const match of matches ?? []) {
    const participants = (match.match_participants ?? []) as Array<{ user_id: string; status: string }>;
    for (const participant of participants.filter((p) => ['joined', 'approved'].includes(p.status))) {
      messages.push({
        userId: participant.user_id,
        type: 'match_reminder' as const,
        title: 'En 30 min empieza el partido',
        body: `${match.title} empieza en media hora. Que no te pille calentando en el sofá.`,
        matchId: match.id,
        url: `/match/${match.id}`,
        dedupeKey: `match_reminder:${match.id}:${participant.user_id}`,
      });
    }
  }

  return sendPushMessages(messages);
}

async function sendTeamAttendanceReminders(now: Date) {
  const matches = await loadPrivateTeamMatchesAt(now, TEAM_ATTENDANCE_REMINDER_HOURS);
  const messages = [];

  for (const match of matches.filter(hasAvailableTeamSpots)) {
    const teamTitle = match.team?.title ?? 'tu equipo';
    for (const participant of (match.match_participants ?? []).filter(({ status }) => status === 'pending')) {
      messages.push({
        userId: participant.user_id,
        type: 'team_attendance_reminder' as const,
        title: '¿Juegas este partido?',
        body: `Quedan 48 h para ${match.title} con ${teamTitle}. ¿Vas a ir?`,
        matchId: match.id,
        url: `/match/${match.id}`,
        dedupeKey: `team_attendance_reminder:${match.id}:${participant.user_id}`,
      });
    }
  }

  return sendPushMessages(messages);
}

async function sendTeamPublishPrompts(now: Date) {
  const matches = await loadPrivateTeamMatchesAt(now, TEAM_PUBLISH_PROMPT_HOURS);
  const messages = matches.filter(hasAvailableTeamSpots).map((match) => ({
    userId: match.organizer_id,
    type: 'team_publish_prompt' as const,
    title: `Aún quedan plazas para ${match.title}`,
    body: '¿Quieres abrirlo a Rondo?',
    matchId: match.id,
    url: `/match/${match.id}`,
    dedupeKey: `team_publish_prompt:${match.id}:${match.organizer_id}`,
  }));

  return sendPushMessages(messages);
}

async function sendScheduledMatchPushes() {
  const now = new Date();
  const [matchReminders, teamAttendanceReminders, teamPublishPrompts] = await Promise.all([
    sendMatchReminders(now),
    sendTeamAttendanceReminders(now),
    sendTeamPublishPrompts(now),
  ]);

  return { matchReminders, teamAttendanceReminders, teamPublishPrompts };
}

async function loadNearbyMatchesForPreference(preference: LocationPreference) {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const endIso = new Date(Date.now() + NEARBY_LOOKAHEAD_HOURS * 60 * 60 * 1000).toISOString();

  const { data: rpcData, error: rpcError } = await supabase.rpc('partidos_cerca', {
    lat: preference.latitude,
    lng: preference.longitude,
    radio_km: SEARCH_RADIUS_KM,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    const ids = rpcData.map((row: { id: string }) => row.id).filter(Boolean).slice(0, 20);
    if (ids.length === 0) return [];

    const { data } = await supabase
      .from('matches')
      .select('id, title, date_time, organizer_id, location_city')
      .in('id', ids)
      .eq('status', 'open')
      .gte('date_time', nowIso)
      .lte('date_time', endIso)
      .order('date_time', { ascending: true });

    return (data ?? []) as MatchRow[];
  }

  const { data } = await supabase
    .from('matches')
    .select('id, title, date_time, organizer_id, location_city, location_lat, location_lng, latitude_snapshot, longitude_snapshot')
    .eq('status', 'open')
    .gte('date_time', nowIso)
    .lte('date_time', endIso)
    .order('date_time', { ascending: true })
    .limit(200);

  return ((data ?? []) as MatchRow[]).filter((match) => {
    const latitude = match.latitude_snapshot ?? match.location_lat;
    const longitude = match.longitude_snapshot ?? match.location_lng;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
    return distanceKm(
      { latitude: preference.latitude, longitude: preference.longitude },
      { latitude, longitude },
    ) <= SEARCH_RADIUS_KM;
  });
}

async function sendNearbyDigest() {
  const supabase = createServiceClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: preferences, error } = await supabase
    .from('user_location_preferences')
    .select('user_id, city, latitude, longitude');

  if (error) throw error;

  const messages = [];

  for (const preference of (preferences ?? []) as LocationPreference[]) {
    const { count: tokenCount } = await supabase
      .from('push_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', preference.user_id)
      .eq('enabled', true);

    if ((tokenCount ?? 0) === 0) continue;

    const { count: digestCount } = await supabase
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', preference.user_id)
      .eq('type', 'nearby_digest')
      .gte('sent_at', startOfDay.toISOString())
      .in('status', ['sent', 'skipped']);

    if ((digestCount ?? 0) > 0) continue;

    const nearbyMatches = await loadNearbyMatchesForPreference(preference);
    if (nearbyMatches.length === 0) continue;

    const candidateIds = nearbyMatches.map((match) => match.id);
    const { data: participations } = await supabase
      .from('match_participants')
      .select('match_id')
      .eq('user_id', preference.user_id)
      .in('match_id', candidateIds);

    const joinedIds = new Set((participations ?? []).map((row: { match_id: string }) => row.match_id));
    const relevantMatches = nearbyMatches.filter((match) =>
      match.organizer_id !== preference.user_id && !joinedIds.has(match.id)
    );

    if (relevantMatches.length === 0) continue;

    const firstMatch = relevantMatches[0];
    const count = relevantMatches.length;
    const params = new URLSearchParams({
      lat: String(preference.latitude),
      lng: String(preference.longitude),
      ciudad: preference.city,
      dateRange: 'this_week',
    });

    messages.push({
      userId: preference.user_id,
      type: 'nearby_digest' as const,
      title: '¡Te están buscando!',
      body: `Hemos encontrado ${count} ${count === 1 ? 'partido' : 'partidos'} cerca de ${preference.city}. Si te falta césped, entra.`,
      matchId: firstMatch.id,
      url: `/search/results?${params.toString()}`,
      dedupeKey: `nearby_digest:${preference.user_id}:${startOfDay.toISOString().slice(0, 10)}`,
    });
  }

  return sendPushMessages(messages);
}

async function sendReviewReminders() {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - REVIEW_REMINDER_DELAY_HOURS * 60 * 60 * 1000).toISOString();

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, user_id, match_id, created_at')
    .eq('type', 'pending_player_review')
    .eq('read', false)
    .lte('created_at', cutoff);

  if (error) throw error;

  const messages = [];

  for (const notification of notifications ?? []) {
    const [{ data: match }, { count: reviewCount }] = await Promise.all([
      supabase
        .from('matches')
        .select('id, title, status, organizer_id')
        .eq('id', notification.match_id)
        .maybeSingle(),
      supabase
        .from('match_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', notification.match_id)
        .eq('reviewer_id', notification.user_id),
    ]);

    if (!match || match.status !== 'completed') continue;
    if (match.organizer_id === notification.user_id) continue;
    if ((reviewCount ?? 0) > 0) continue;

    messages.push({
      userId: notification.user_id,
      type: 'review_player_reminder' as const,
      title: 'Te queda una valoración pendiente',
      body: `${match.title} sigue esperando tu opinión. Un minuto y partido cerrado.`,
      matchId: notification.match_id,
      url: `/match/review-player/${notification.match_id}`,
      dedupeKey: `review_player_reminder:${notification.id}`,
    });
  }

  return sendPushMessages(messages);
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;
  if (!assertCronSecret(req)) return jsonError('Unauthorized', 401);

  const type = await getRequestType(req);

  try {
    if (type === 'match_reminders') return jsonResponse(await sendScheduledMatchPushes());
    if (type === 'nearby_digest') return jsonResponse(await sendNearbyDigest());
    if (type === 'review_reminders') return jsonResponse(await sendReviewReminders());
    return jsonError('Unknown scheduled push type', 400);
  } catch (error) {
    console.error('[scheduled-pushes] failed', error);
    return jsonError('Scheduled push failed', 500);
  }
});
