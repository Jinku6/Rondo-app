import { createServiceClient } from './supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;

export type PushType =
  | 'participant_request'
  | 'match_full'
  | 'participant_accepted'
  | 'match_reminder'
  | 'review_organizer'
  | 'review_player'
  | 'review_player_reminder'
  | 'nearby_digest'
  | 'chat_message'
  | 'participant_left'
  | 'match_cancelled'
  | 'team_match_created'
  | 'team_attendance_reminder'
  | 'team_match_published'
  | 'team_publish_prompt';

type PushMessage = {
  userId: string;
  type: PushType;
  title: string;
  body: string;
  matchId?: string | null;
  url?: string | null;
  dedupeKey: string;
};

type ExpoTicket = {
  status?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type PushTokenRow = {
  token: string;
  platform: 'ios' | 'android' | 'web';
};

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export const normalizePreview = (value?: string | null, maxLength = 80) => {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
};

export async function hasRecentPush(userId: string, type: PushType, sinceIso: string, matchId?: string | null) {
  const supabase = createServiceClient();
  let query = supabase
    .from('push_notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', type)
    .gte('sent_at', sinceIso);

  if (matchId) query = query.eq('match_id', matchId);

  const { count, error } = await query;
  if (error) {
    console.warn('[push] recent log check failed', error.message);
    return false;
  }

  return (count ?? 0) > 0;
}

async function writeLog(message: PushMessage, status: 'sent' | 'skipped' | 'failed', error?: string) {
  const supabase = createServiceClient();
  await supabase
    .from('push_notification_log')
    .upsert(
      {
        user_id: message.userId,
        type: message.type,
        match_id: message.matchId ?? null,
        dedupe_key: message.dedupeKey,
        status,
        error: error ?? null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'dedupe_key' },
    );
}

export async function sendPushMessages(messages: PushMessage[]) {
  const supabase = createServiceClient();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: { dedupeKey: string; error: string }[] = [];

  for (const message of messages) {
    const { count } = await supabase
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('dedupe_key', message.dedupeKey)
      .in('status', ['sent', 'skipped']);

    if ((count ?? 0) > 0) {
      skipped.push(message.dedupeKey);
      continue;
    }

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', message.userId)
      .eq('enabled', true);

    if (error || !tokens?.length) {
      await writeLog(message, 'skipped', error?.message ?? 'No active push tokens');
      skipped.push(message.dedupeKey);
      continue;
    }

    const payloads = (tokens as PushTokenRow[]).map(({ token, platform }) => ({
      to: token,
      title: message.title,
      body: message.body,
      data: {
        type: message.type,
        match_id: message.matchId ?? null,
        url: message.url ?? null,
      },
      sound: 'default',
      priority: 'high',
      ...(platform === 'android' ? { channelId: 'default' } : {}),
    }));

    let messageFailed = false;
    let lastError: string | undefined;

    for (const batch of chunk(payloads, EXPO_BATCH_SIZE)) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          messageFailed = true;
          lastError = `Expo push API returned ${response.status}`;
          continue;
        }

        const json = await response.json() as { data?: ExpoTicket[] };
        const tickets = json.data ?? [];
        const disabledTokens: string[] = [];

        tickets.forEach((ticket, index) => {
          if (ticket.status === 'error') {
            messageFailed = true;
            const token = batch[index]?.to;
            if (ticket.details?.error === 'DeviceNotRegistered' && token) disabledTokens.push(token);
            lastError = ticket.message ?? ticket.details?.error ?? 'Expo push ticket error';
          }
        });

        if (disabledTokens.length > 0) {
          await supabase.from('push_tokens').update({ enabled: false }).in('token', disabledTokens);
        }
      } catch (error) {
        messageFailed = true;
        lastError = error instanceof Error ? error.message : 'Expo push request failed';
      }
    }

    if (messageFailed) {
      const error = lastError ?? 'Push send failed';
      await writeLog(message, 'failed', error);
      failed.push({ dedupeKey: message.dedupeKey, error });
    } else {
      await writeLog(message, 'sent', lastError);
      sent.push(message.dedupeKey);
    }
  }

  return { sent: sent.length, skipped: skipped.length, failed };
}
