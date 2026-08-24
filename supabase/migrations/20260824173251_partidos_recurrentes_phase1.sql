BEGIN;

CREATE TABLE public.match_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  venue_id uuid NOT NULL
    REFERENCES public.venues(id),
  automation_mode text NOT NULL DEFAULT 'manual',
  day_of_week integer,
  start_time time,
  requested_positions jsonb NOT NULL DEFAULT
    '{"portero":0,"defensa":0,"mediocentro":0,"delantero":0,"cualquiera":0}'::jsonb,
  min_players integer NOT NULL DEFAULT 2,
  price_per_player numeric NOT NULL DEFAULT 0,
  requires_approval boolean NOT NULL DEFAULT false,
  confirmation_deadline_hours integer NOT NULL DEFAULT 48,
  auto_publish_if_short boolean NOT NULL DEFAULT false,
  invite_code text UNIQUE NOT NULL
    DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT match_series_title_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  CONSTRAINT match_series_automation_mode_check
    CHECK (automation_mode IN ('auto', 'manual')),
  CONSTRAINT match_series_day_of_week_check
    CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT match_series_schedule_check
    CHECK (
      automation_mode = 'manual'
      OR (day_of_week IS NOT NULL AND start_time IS NOT NULL)
    ),
  CONSTRAINT match_series_min_players_check
    CHECK (min_players >= 2),
  CONSTRAINT match_series_price_check
    CHECK (price_per_player >= 0),
  CONSTRAINT match_series_deadline_hours_check
    CHECK (confirmation_deadline_hours BETWEEN 1 AND 168),
  CONSTRAINT match_series_invite_code_check
    CHECK (invite_code ~ '^[0-9a-f]{32}$')
);

CREATE INDEX match_series_organizer_id_idx
  ON public.match_series (organizer_id);

CREATE INDEX match_series_venue_id_idx
  ON public.match_series (venue_id);

CREATE TABLE public.series_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL
    REFERENCES public.match_series(id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  invited_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT series_members_status_check
    CHECK (status IN ('active', 'removed')),
  CONSTRAINT series_members_series_user_key
    UNIQUE (series_id, user_id)
);

CREATE INDEX series_members_user_id_idx
  ON public.series_members (user_id);

CREATE INDEX series_members_active_series_idx
  ON public.series_members (series_id, user_id)
  WHERE status = 'active';

ALTER TABLE public.matches
  ADD COLUMN series_id uuid
    REFERENCES public.match_series(id) ON DELETE SET NULL,
  ADD COLUMN is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN recruiting_public boolean NOT NULL DEFAULT false,
  ADD COLUMN confirmation_deadline timestamptz,
  ADD COLUMN confirmation_deadline_notified boolean NOT NULL DEFAULT false;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_series_private_check
    CHECK (series_id IS NULL OR is_private),
  ADD CONSTRAINT matches_recruiting_private_check
    CHECK (NOT recruiting_public OR is_private);

CREATE UNIQUE INDEX idx_matches_series_datetime
  ON public.matches (series_id, date_time)
  WHERE series_id IS NOT NULL;

ALTER TABLE public.match_participants
  DROP CONSTRAINT IF EXISTS chk_participant_status;

ALTER TABLE public.match_participants
  DROP CONSTRAINT IF EXISTS match_participants_status_check;

ALTER TABLE public.match_participants
  ADD CONSTRAINT match_participants_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending',
        'approved',
        'joined',
        'rejected',
        'dropped',
        'declined'
      ]
    )
  );

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_series_organizer(
  p_series_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.match_series ms
      WHERE ms.id = p_series_id
        AND ms.organizer_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION private.is_active_series_member(
  p_series_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.series_members sm
      WHERE sm.series_id = p_series_id
        AND sm.user_id = p_user_id
        AND sm.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION private.can_access_series(
  p_series_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT private.is_series_organizer(p_series_id, p_user_id)
    OR private.is_active_series_member(p_series_id, p_user_id);
$$;

REVOKE ALL ON FUNCTION private.is_series_organizer(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_active_series_member(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_series(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_series_organizer(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_series_member(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_series(uuid, uuid)
  TO authenticated;

ALTER TABLE public.match_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Series: related users can read"
  ON public.match_series
  FOR SELECT
  TO authenticated
  USING (
    private.can_access_series(id, (SELECT auth.uid()))
  );

CREATE POLICY "Series: organizer can create"
  ON public.match_series
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
  );

CREATE POLICY "Series: organizer can update"
  ON public.match_series
  FOR UPDATE
  TO authenticated
  USING (
    organizer_id = (SELECT auth.uid())
  )
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
  );

CREATE POLICY "Series: organizer can delete"
  ON public.match_series
  FOR DELETE
  TO authenticated
  USING (
    organizer_id = (SELECT auth.uid())
  );

ALTER TABLE public.series_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Series members: related users can read"
  ON public.series_members
  FOR SELECT
  TO authenticated
  USING (
    private.can_access_series(series_id, (SELECT auth.uid()))
  );

CREATE POLICY "Series members: organizer can insert"
  ON public.series_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_series_organizer(series_id, (SELECT auth.uid()))
  );

CREATE POLICY "Series members: organizer can update"
  ON public.series_members
  FOR UPDATE
  TO authenticated
  USING (
    private.is_series_organizer(series_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    private.is_series_organizer(series_id, (SELECT auth.uid()))
  );

CREATE POLICY "Series members: organizer can delete"
  ON public.series_members
  FOR DELETE
  TO authenticated
  USING (
    private.is_series_organizer(series_id, (SELECT auth.uid()))
  );

REVOKE ALL ON public.match_series, public.series_members FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.match_series, public.series_members
  TO authenticated;

DROP POLICY IF EXISTS
  "Matches: read authenticated discoverable or related"
  ON public.matches;

CREATE POLICY "Matches: read authenticated discoverable or related"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    organizer_id = (SELECT auth.uid())
    OR private.is_match_participant(id, (SELECT auth.uid()))
    OR (
      series_id IS NOT NULL
      AND private.is_active_series_member(
        series_id,
        (SELECT auth.uid())
      )
    )
    OR (
      status IN ('open', 'full')
      AND (NOT is_private OR recruiting_public)
    )
  );

DROP POLICY IF EXISTS "Matches: insert own" ON public.matches;

CREATE POLICY "Matches: insert own"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
    AND (
      series_id IS NULL
      OR private.is_series_organizer(
        series_id,
        (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Matches: update own" ON public.matches;

CREATE POLICY "Matches: update own"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    organizer_id = (SELECT auth.uid())
  )
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
    AND (
      series_id IS NULL
      OR private.is_series_organizer(
        series_id,
        (SELECT auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION private.can_read_match_participant(
  p_match_id uuid,
  p_participant_user_id uuid,
  p_requesting_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT p_requesting_user_id IS NOT NULL
    AND (
      p_participant_user_id = p_requesting_user_id
      OR EXISTS (
        SELECT 1
        FROM public.matches m
        WHERE m.id = p_match_id
          AND (
            m.organizer_id = p_requesting_user_id
            OR EXISTS (
              SELECT 1
              FROM public.match_participants mine
              WHERE mine.match_id = m.id
                AND mine.user_id = p_requesting_user_id
            )
            OR (
              m.series_id IS NOT NULL
              AND private.is_active_series_member(
                m.series_id,
                p_requesting_user_id
              )
            )
            OR (
              m.status IN ('open', 'full')
              AND (NOT m.is_private OR m.recruiting_public)
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION
  private.can_read_match_participant(uuid, uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  private.can_read_match_participant(uuid, uuid, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.partidos_cerca(
  lat numeric,
  lng numeric,
  radio_km numeric DEFAULT 30
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SET search_path TO pg_catalog
AS $$
  SELECT p.id
  FROM public.matches p
  WHERE p.location_lat IS NOT NULL
    AND p.location_lng IS NOT NULL
    AND (NOT p.is_private OR p.recruiting_public)
    AND (
      6371 * acos(
        LEAST(
          1.0,
          cos(radians(lat))
            * cos(radians(p.location_lat))
            * cos(radians(p.location_lng) - radians(lng))
            + sin(radians(lat))
            * sin(radians(p.location_lat))
        )
      )
    ) <= radio_km;
$$;

REVOKE EXECUTE ON FUNCTION
  public.partidos_cerca(numeric, numeric, numeric)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.partidos_cerca(numeric, numeric, numeric)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.join_match_series(
  p_invite_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series_id uuid;
  v_organizer_id uuid;
  v_member_status text;
  v_code text := lower(btrim(p_invite_code));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para unirte al grupo.';
  END IF;

  IF v_code !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Este enlace de invitación no es válido.';
  END IF;

  SELECT ms.id, ms.organizer_id
  INTO v_series_id, v_organizer_id
  FROM public.match_series ms
  WHERE ms.invite_code = v_code
    AND ms.is_active = true;

  IF v_series_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Este enlace de invitación no es válido.';
  END IF;

  INSERT INTO public.series_members (
    series_id,
    user_id,
    status,
    invited_by
  )
  VALUES (
    v_series_id,
    v_user_id,
    'active',
    v_organizer_id
  )
  ON CONFLICT (series_id, user_id) DO NOTHING;

  SELECT sm.status
  INTO v_member_status
  FROM public.series_members sm
  WHERE sm.series_id = v_series_id
    AND sm.user_id = v_user_id;

  IF v_member_status <> 'active' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes volver a entrar con este enlace.';
  END IF;

  RETURN v_series_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_match_series(text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.join_match_series(text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_series_match(
  p_match_id uuid,
  p_response text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para responder.';
  END IF;

  IF p_response NOT IN ('joined', 'declined') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Respuesta no válida.';
  END IF;

  UPDATE public.match_participants mp
  SET status = p_response
  FROM public.matches m,
       public.series_members sm
  WHERE mp.match_id = p_match_id
    AND mp.user_id = v_user_id
    AND mp.status = 'pending'
    AND m.id = mp.match_id
    AND m.status IN ('open', 'full')
    AND m.series_id IS NOT NULL
    AND sm.series_id = m.series_id
    AND sm.user_id = v_user_id
    AND sm.status = 'active'
  RETURNING mp.status INTO v_result;

  IF v_result IS NULL THEN
    SELECT mp.status
    INTO v_result
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE mp.match_id = p_match_id
      AND mp.user_id = v_user_id
      AND m.series_id IS NOT NULL;

    IF v_result = p_response THEN
      RETURN v_result;
    END IF;

    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes responder a este partido.';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION
  public.respond_to_series_match(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.respond_to_series_match(uuid, text)
  TO authenticated;

COMMIT;
