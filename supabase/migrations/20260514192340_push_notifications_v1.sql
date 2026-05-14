-- Push notifications v1: tokens, delivery log, nearby digest location, and full-status sync.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS push_tokens_enabled_idx ON public.push_tokens(enabled);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push tokens: read own" ON public.push_tokens;
CREATE POLICY "Push tokens: read own"
  ON public.push_tokens
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Push tokens: insert own" ON public.push_tokens;
CREATE POLICY "Push tokens: insert own"
  ON public.push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Push tokens: update own" ON public.push_tokens;
CREATE POLICY "Push tokens: update own"
  ON public.push_tokens
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Push tokens: delete own" ON public.push_tokens;
CREATE POLICY "Push tokens: delete own"
  ON public.push_tokens
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  dedupe_key text NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  error text
);

CREATE INDEX IF NOT EXISTS push_notification_log_user_type_sent_idx
  ON public.push_notification_log(user_id, type, sent_at DESC);
CREATE INDEX IF NOT EXISTS push_notification_log_match_id_idx
  ON public.push_notification_log(match_id);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_location_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  source text NOT NULL DEFAULT 'search' CHECK (source IN ('search', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_location_preferences_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT user_location_preferences_longitude_range CHECK (longitude BETWEEN -180 AND 180)
);

ALTER TABLE public.user_location_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Location prefs: read own" ON public.user_location_preferences;
CREATE POLICY "Location prefs: read own"
  ON public.user_location_preferences
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Location prefs: insert own" ON public.user_location_preferences;
CREATE POLICY "Location prefs: insert own"
  ON public.user_location_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Location prefs: update own" ON public.user_location_preferences;
CREATE POLICY "Location prefs: update own"
  ON public.user_location_preferences
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Location prefs: delete own" ON public.user_location_preferences;
CREATE POLICY "Location prefs: delete own"
  ON public.user_location_preferences
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.touch_push_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER touch_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_push_tokens_updated_at();

CREATE OR REPLACE FUNCTION public.touch_user_location_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_user_location_preferences_updated_at ON public.user_location_preferences;
CREATE TRIGGER touch_user_location_preferences_updated_at
  BEFORE UPDATE ON public.user_location_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_location_preferences_updated_at();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.sync_match_full_status(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  target_slots integer := 0;
  active_players integer := 0;
  current_status text;
BEGIN
  SELECT
    COALESCE((
      SELECT SUM(GREATEST(value::integer, 0))
      FROM jsonb_each_text(COALESCE(m.requested_positions::jsonb, '{}'::jsonb))
    ), 0),
    m.status
  INTO target_slots, current_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF current_status IS NULL OR current_status IN ('completed', 'cancelled') THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO active_players
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.status IN ('joined', 'approved');

  IF target_slots > 0 AND active_players >= target_slots AND current_status = 'open' THEN
    UPDATE public.matches SET status = 'full' WHERE id = p_match_id AND status = 'open';
  ELSIF (target_slots = 0 OR active_players < target_slots) AND current_status = 'full' THEN
    UPDATE public.matches SET status = 'open' WHERE id = p_match_id AND status = 'full';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.sync_match_full_status(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_match_full_status_from_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.sync_match_full_status(OLD.match_id);
    RETURN OLD;
  END IF;

  PERFORM private.sync_match_full_status(NEW.match_id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.sync_match_full_status_from_participant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_match_full_status_on_participant ON public.match_participants;
CREATE TRIGGER sync_match_full_status_on_participant
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_match_full_status_from_participant();

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.push_tokens FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.push_notification_log FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.user_location_preferences FROM anon;

COMMIT;
