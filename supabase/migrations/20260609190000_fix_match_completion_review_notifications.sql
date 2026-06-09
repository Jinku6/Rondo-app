-- Ensure completed matches always start the review flow, no matter whether the
-- status is changed by the app or by the scheduled completion job.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_user_match_type
  ON public.notifications (user_id, match_id, type);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.set_match_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_match_completed_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_match_completed_at_before_insert ON public.matches;
CREATE TRIGGER set_match_completed_at_before_insert
  BEFORE INSERT ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.completed_at IS NULL)
  EXECUTE FUNCTION private.set_match_completed_at();

DROP TRIGGER IF EXISTS set_match_completed_at_before_update ON public.matches;
CREATE TRIGGER set_match_completed_at_before_update
  BEFORE UPDATE OF status ON public.matches
  FOR EACH ROW
  WHEN (
    NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed'
    AND NEW.completed_at IS NULL
  )
  EXECUTE FUNCTION private.set_match_completed_at();

CREATE OR REPLACE FUNCTION private.create_match_completion_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, match_id, type)
  VALUES (NEW.organizer_id, NEW.id, 'pending_organizer_review')
  ON CONFLICT (user_id, match_id, type) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.create_match_completion_review_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS create_match_completion_review_notification_after_insert ON public.matches;
CREATE TRIGGER create_match_completion_review_notification_after_insert
  AFTER INSERT ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION private.create_match_completion_review_notification();

DROP TRIGGER IF EXISTS create_match_completion_review_notification_after_update ON public.matches;
CREATE TRIGGER create_match_completion_review_notification_after_update
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION private.create_match_completion_review_notification();

UPDATE public.matches
SET completed_at = COALESCE(completed_at, date_time + interval '2 hours', now())
WHERE status = 'completed'
  AND completed_at IS NULL;

INSERT INTO public.notifications (user_id, match_id, type)
SELECT m.organizer_id, m.id, 'pending_organizer_review'
FROM public.matches m
WHERE m.status = 'completed'
  AND m.completed_at IS NOT NULL
ON CONFLICT (user_id, match_id, type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_completed_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  UPDATE public.matches
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now())
  WHERE status IN ('open', 'full')
    AND date_time <= now() - interval '2 hours';

  INSERT INTO public.notifications (user_id, match_id, type)
  SELECT m.organizer_id, m.id, 'pending_organizer_review'
  FROM public.matches m
  WHERE m.status = 'completed'
    AND m.completed_at IS NOT NULL
  ON CONFLICT (user_id, match_id, type) DO NOTHING;
END;
$$;

COMMIT;
