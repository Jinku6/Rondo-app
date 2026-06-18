-- Auto-confirm attendance after the organizer's 24h window has elapsed.
CREATE OR REPLACE FUNCTION public.auto_confirm_attendance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  match_record RECORD;
  cutoff timestamptz := now() - interval '24 hours';
BEGIN
  FOR match_record IN
    SELECT m.id, m.organizer_id
    FROM public.matches m
    WHERE m.status = 'completed'
      AND m.completed_at IS NOT NULL
      AND m.completed_at < cutoff
      AND EXISTS (
        SELECT 1
        FROM public.match_participants mp
        WHERE mp.match_id = m.id
          AND mp.status IN ('joined', 'approved')
      )
  LOOP
    UPDATE public.match_participants
    SET attended = true
    WHERE match_id = match_record.id
      AND status IN ('joined', 'approved')
      AND attended IS NULL;

    INSERT INTO public.notifications (user_id, match_id, type)
    SELECT mp.user_id, match_record.id, 'pending_player_review'
    FROM public.match_participants mp
    WHERE mp.match_id = match_record.id
      AND mp.status IN ('joined', 'approved')
      AND mp.attended = true
      AND mp.user_id <> match_record.organizer_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = mp.user_id
          AND n.match_id = match_record.id
          AND n.type = 'pending_player_review'
      );

    INSERT INTO public.notifications (user_id, match_id, type)
    SELECT match_record.organizer_id, match_record.id, 'pending_organizer_review'
    WHERE EXISTS (
        SELECT 1
        FROM public.match_participants mp
        WHERE mp.match_id = match_record.id
          AND mp.status IN ('joined', 'approved')
          AND mp.user_id <> match_record.organizer_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = match_record.organizer_id
          AND n.match_id = match_record.id
          AND n.type = 'pending_organizer_review'
      );
  END LOOP;
END;
$$;
