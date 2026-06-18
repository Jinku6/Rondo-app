import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { jsonError, jsonResponse } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  const expectedSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('X-Cron-Secret');

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select('id, organizer_id')
    .eq('status', 'completed')
    .lt('completed_at', cutoff)
    .not('completed_at', 'is', null);

  if (matchError) return jsonError('Could not load matches', 500);

  let processed = 0;

  for (const match of matches ?? []) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', match.id)
      .eq('type', 'pending_player_review');

    if ((count ?? 0) > 0) continue;

    await supabase
      .from('match_participants')
      .update({ attended: true })
      .eq('match_id', match.id)
      .in('status', ['joined', 'approved'])
      .is('attended', null);

    const { data: participants } = await supabase
      .from('match_participants')
      .select('user_id')
      .eq('match_id', match.id)
      .in('status', ['joined', 'approved'])
      .eq('attended', true);

    if (!participants?.length) continue;

    await supabase.from('notifications').insert(
      participants.map((participant) => ({
        user_id: participant.user_id,
        match_id: match.id,
        type: 'pending_player_review',
      }))
    );

    const { count: organizerCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', match.id)
      .eq('user_id', match.organizer_id)
      .eq('type', 'pending_organizer_review')
      .eq('read', false);

    if ((organizerCount ?? 0) === 0) {
      await supabase.from('notifications').insert({
        user_id: match.organizer_id,
        match_id: match.id,
        type: 'pending_organizer_review',
      });
    }

    processed++;
  }

  return jsonResponse({ processed });
});
