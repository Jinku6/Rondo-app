-- Rondo Free: normalize match completion, attendance auto-confirmation, and review notifications.
-- Keep one completion cron and one auto-confirm cron. Make notification writes idempotent.

-- Remove bad/duplicate pending review notifications before adding the uniqueness guard.
DELETE FROM public.notifications n
USING public.matches m
WHERE n.match_id = m.id
  AND n.type = 'pending_player_review'
  AND n.user_id = m.organizer_id;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, match_id, type
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.notifications
  WHERE type IN ('pending_organizer_review', 'pending_player_review')
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_user_match_type
  ON public.notifications (user_id, match_id, type);

-- A completed match should first ask the organizer to pass attendance.
-- Players should only be asked to review after attendance is known manually or by auto-confirm.
CREATE OR REPLACE FUNCTION public.update_completed_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'completed'
  WHERE status IN ('open', 'full')
    AND date_time <= now() - interval '2 hours';

  INSERT INTO public.notifications (user_id, match_id, type)
  SELECT m.organizer_id, m.id, 'pending_organizer_review'
  FROM public.matches m
  WHERE m.status = 'completed'
    AND m.completed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = m.organizer_id
        AND n.match_id = m.id
        AND n.type = 'pending_organizer_review'
    );
END;
$$;

-- Backward-compatible wrapper for older cron definitions, kept safe if called manually.
CREATE OR REPLACE FUNCTION public.process_expired_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM public.update_completed_matches();
END;
$$;

-- Auto-confirm only after the organizer's 48h window has elapsed.
CREATE OR REPLACE FUNCTION public.auto_confirm_attendance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  match_record RECORD;
  cutoff timestamptz := now() - interval '48 hours';
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

-- Keep compatibility but route old review-expiry job to the canonical auto-confirm function.
CREATE OR REPLACE FUNCTION public.process_expired_reviews()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  PERFORM public.auto_confirm_attendance();
END;
$$;

-- Remove redundant cron jobs. Keep check-completed-matches and auto-confirm-attendance.
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'autocomplete-matches',
      'process-expired-reviews',
      'auto-confirm-attendance-hourly'
    )
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END;
$$;

-- Ensure the canonical jobs exist and have the intended schedules.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-completed-matches') THEN
    PERFORM cron.schedule('check-completed-matches', '*/10 * * * *', 'SELECT public.update_completed_matches();');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-attendance') THEN
    PERFORM cron.schedule('auto-confirm-attendance', '0 * * * *', 'SELECT public.auto_confirm_attendance();');
  END IF;
END;
$$;
