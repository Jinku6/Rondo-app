import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Matches completados hace más de 48h sin notificaciones de player review
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id, organizer_id')
      .eq('status', 'completed')
      .lt('completed_at', cutoff)
      .not('completed_at', 'is', null);

    if (matchError) throw matchError;
    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processed = 0;

    for (const match of matches) {
      // Verificar si ya existen notificaciones pending_player_review para este partido
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('type', 'pending_player_review');

      if ((count ?? 0) > 0) continue; // Ya procesado

      // Marcar como attended=true los participantes que aún no tienen asistencia registrada
      await supabase
        .from('match_participants')
        .update({ attended: true })
        .eq('match_id', match.id)
        .in('status', ['joined', 'approved'])
        .is('attended', null);

      // Obtener todos los participantes que asistieron (incluyendo los recién confirmados)
      const { data: participants } = await supabase
        .from('match_participants')
        .select('user_id')
        .eq('match_id', match.id)
        .in('status', ['joined', 'approved'])
        .eq('attended', true);

      if (!participants || participants.length === 0) continue;

      // Crear pending_player_review para cada participante
      await supabase.from('notifications').insert(
        participants.map(p => ({
          user_id: p.user_id,
          match_id: match.id,
          type: 'pending_player_review'
        }))
      );

      // Crear/asegurar pending_organizer_review para el organizador (si no tiene ya una sin leer)
      const { count: orgCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('user_id', match.organizer_id)
        .eq('type', 'pending_organizer_review')
        .eq('read', false);

      if ((orgCount ?? 0) === 0) {
        await supabase.from('notifications').insert({
          user_id: match.organizer_id,
          match_id: match.id,
          type: 'pending_organizer_review'
        });
      }

      processed++;
    }

    return new Response(JSON.stringify({ processed }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
