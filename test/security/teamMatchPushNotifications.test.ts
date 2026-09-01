import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('team match push notifications', () => {
  it('routes private team reservations to each pending member', () => {
    const sendPush = read('supabase/functions/send-push/index.ts');
    const sharedPush = read('supabase/functions/_shared/push.ts');

    expect(sharedPush).toMatch(/team_match_created/);
    expect(sharedPush).toMatch(/team_attendance_reminder/);
    expect(sharedPush).toMatch(/team_match_published/);
    expect(sharedPush).toMatch(/team_publish_prompt/);

    expect(sendPush).toMatch(/isPrivateTeamMatch\(match\)/);
    expect(sendPush).toMatch(/userId: record\.user_id,[\s\S]*type: 'team_match_created'/);
    expect(sendPush).toMatch(/Nuevo partido con \$\{getTeamTitle\(match\)\}/);
    expect(sendPush).toMatch(/Confirma tu asistencia\./);
    expect(sendPush).toMatch(/team_match_created:\$\{match\.id\}:\$\{record\.user_id\}/);

    expect(sendPush).toMatch(/type: 'participant_request'/);
    expect(sendPush).toMatch(/userId: match\.organizer_id/);
  });

  it('uses an explicit notification marker for public team openings', () => {
    const sendPush = read('supabase/functions/send-push/index.ts');
    const databaseTypes = read('types/database.ts');

    expect(databaseTypes).toMatch(/team_match_published/);
    expect(sendPush).toMatch(/record\.type === 'team_match_published'/);
    expect(sendPush).toMatch(/!match\?\.series_id \|\| !match\.is_private \|\| !match\.recruiting_public/);
    expect(sendPush).toMatch(/El partido de \$\{getTeamTitle\(match\)\} está abierto/);
    expect(sendPush).toMatch(/¡Aún estás a tiempo de unirte!/);
    expect(sendPush).toMatch(/team_match_published:\$\{match\.id\}:\$\{record\.user_id\}/);
  });

  it('keeps public match copy and uses the approved team full copy', () => {
    const sendPush = read('supabase/functions/send-push/index.ts');

    expect(sendPush).toMatch(/const isTeamMatch = !!record\.series_id/);
    expect(sendPush).toMatch(/Plantilla completa ✅/);
    expect(sendPush).toMatch(/¡\$\{record\.title\} ya tiene a todos los jugadores listos!/);
    expect(sendPush).toMatch(/Tu partido está completo ✅/);
    expect(sendPush).toMatch(/match_full:\$\{record\.id\}/);
  });

  it('adds the 48h pending reminder and 24h captain prompt to the existing cron', () => {
    const scheduledPushes = read('supabase/functions/scheduled-pushes/index.ts');

    expect(scheduledPushes).toMatch(/TEAM_ATTENDANCE_REMINDER_HOURS = 48/);
    expect(scheduledPushes).toMatch(/TEAM_PUBLISH_PROMPT_HOURS = 24/);
    expect(scheduledPushes).toMatch(/TEAM_PUSH_WINDOW_MINUTES = 5/);
    expect(scheduledPushes).toMatch(/\.eq\('is_private', true\)/);
    expect(scheduledPushes).toMatch(/\.eq\('recruiting_public', false\)/);
    expect(scheduledPushes).toMatch(/\.eq\('status', 'open'\)/);
    expect(scheduledPushes).toMatch(/matches\.filter\(hasAvailableTeamSpots\)/);
    expect(scheduledPushes).toMatch(/status === 'pending'/);

    expect(scheduledPushes).toMatch(/¿Juegas este partido\?/);
    expect(scheduledPushes).toMatch(/Quedan 48 h para \$\{match\.title\} con \$\{teamTitle\}\. ¿Vas a ir\?/);
    expect(scheduledPushes).toMatch(/team_attendance_reminder:\$\{match\.id\}:\$\{participant\.user_id\}/);

    expect(scheduledPushes).toMatch(/Aún quedan plazas para \$\{match\.title\}/);
    expect(scheduledPushes).toMatch(/¿Quieres abrirlo a Rondo\?/);
    expect(scheduledPushes).toMatch(/team_publish_prompt:\$\{match\.id\}:\$\{match\.organizer_id\}/);
    expect(scheduledPushes).toMatch(/sendScheduledMatchPushes\(\)/);
  });

  it('preserves ordinary joined-player reminders and review pushes', () => {
    const scheduledPushes = read('supabase/functions/scheduled-pushes/index.ts');
    const sendPush = read('supabase/functions/send-push/index.ts');

    expect(scheduledPushes).toMatch(/\['joined', 'approved'\]\.includes\(p\.status\)/);
    expect(scheduledPushes).toMatch(/En 30 min empieza el partido/);
    expect(scheduledPushes).toMatch(/pending_player_review/);
    expect(sendPush).toMatch(/match_cancelled/);
    expect(sendPush).toMatch(/participant_left/);
  });

  it('makes the captain an active member and pending participant', () => {
    const migration = read('supabase/migrations/20260901065052_team_match_notifications.sql');
    const publicTeamProfiles = read('supabase/migrations/20260828172548_public_team_profiles.sql');

    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION private\.ensure_team_captain_membership\(\)/i);
    expect(migration).toMatch(/SECURITY DEFINER[\s\S]*SET search_path TO pg_catalog/i);
    expect(migration).toMatch(/AFTER INSERT ON public\.match_series/i);
    expect(migration).toMatch(/NEW\.organizer_id[\s\S]*'active'/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION private\.ensure_team_captain_membership\(\)/i);

    expect(migration).toMatch(/FROM public\.match_series ms[\s\S]*ms\.is_active = true[\s\S]*ms\.deleted_at IS NULL/i);
    expect(migration).toMatch(/INSERT INTO public\.match_participants/i);
    expect(migration).toMatch(/m\.organizer_id,[\s\S]*'pending'/i);
    expect(migration).toMatch(/m\.is_private = true/i);
    expect(migration).toMatch(/m\.recruiting_public = false/i);
    expect(migration).toMatch(/m\.date_time > now\(\)/i);
    expect(migration).toMatch(/ON CONFLICT \(match_id, user_id\) DO NOTHING/i);

    expect(publicTeamProfiles).toMatch(/sm\.user_id <> ms\.organizer_id/i);
  });

  it('creates publication markers only for pending team members before releasing reservations', () => {
    const migration = read('supabase/migrations/20260901065052_team_match_notifications.sql');
    const markerIndex = migration.indexOf("'team_match_published'");
    const deleteIndex = migration.indexOf('DELETE FROM public.match_participants');

    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.publish_team_match\(/i);
    expect(migration).toMatch(/v_match\.organizer_id <> v_user_id/i);
    expect(migration).toMatch(/v_match\.series_id IS NULL OR NOT v_match\.is_private/i);
    expect(migration).toMatch(/v_match\.recruiting_public/i);
    expect(migration).toMatch(/v_match\.status NOT IN \('open', 'full'\)/i);
    expect(migration).toMatch(/IF v_capacity <= v_joined THEN/i);
    expect(migration).toMatch(/INSERT INTO public\.notifications \([\s\S]*user_id,[\s\S]*match_id,[\s\S]*type,[\s\S]*read[\s\S]*\)/i);
    expect(migration).toMatch(/'team_match_published',[\s\S]*true/i);
    expect(migration).toMatch(/mp\.status = 'pending'/i);
    expect(migration).toMatch(/ON CONFLICT \(user_id, match_id, type\) DO NOTHING/i);
    expect(markerIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(markerIndex);
    expect(migration).toMatch(/mp\.status IN \('pending', 'declined'\)/i);
    expect(migration).toMatch(/SET recruiting_public = true/i);
  });
});
