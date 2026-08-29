-- Fase 2: infraestructura y RPC de partidos recurrentes.
-- El job de pg_cron se programa en una migracion posterior y con aprobacion separada.

BEGIN;

CREATE TABLE public.team_match_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL
    REFERENCES public.match_series(id) ON DELETE CASCADE,
  created_by uuid NOT NULL
    REFERENCES public.users(id) ON DELETE CASCADE,
  frequency text NOT NULL,
  day_of_week smallint NOT NULL,
  week_of_month smallint,
  start_time time without time zone NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  match_template jsonb NOT NULL,
  first_match_id uuid
    REFERENCES public.matches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_match_recurrences_frequency_check
    CHECK (frequency IN ('weekly', 'monthly')),
  CONSTRAINT team_match_recurrences_day_check
    CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT team_match_recurrences_week_check
    CHECK (
      (frequency = 'weekly' AND week_of_month IS NULL)
      OR
      (frequency = 'monthly' AND week_of_month IN (-1, 1, 2, 3, 4))
    ),
  CONSTRAINT team_match_recurrences_timezone_check
    CHECK (timezone = 'Europe/Madrid'),
  CONSTRAINT team_match_recurrences_template_check
    CHECK (jsonb_typeof(match_template) = 'object'),
  CONSTRAINT team_match_recurrences_state_check
    CHECK (
      (is_active AND cancelled_at IS NULL)
      OR
      (NOT is_active AND cancelled_at IS NOT NULL)
    )
);

CREATE INDEX team_match_recurrences_series_idx
  ON public.team_match_recurrences(series_id, is_active);

ALTER TABLE public.matches
  ADD COLUMN recurrence_id uuid
    REFERENCES public.team_match_recurrences(id) ON DELETE SET NULL;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_recurrence_series_check
  CHECK (recurrence_id IS NULL OR series_id IS NOT NULL);

CREATE UNIQUE INDEX matches_recurrence_datetime_key
  ON public.matches(recurrence_id, date_time)
  WHERE recurrence_id IS NOT NULL;

CREATE INDEX matches_recurrence_future_idx
  ON public.matches(recurrence_id, date_time DESC)
  WHERE recurrence_id IS NOT NULL;

ALTER TABLE public.team_match_recurrences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.team_match_recurrences
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.team_match_recurrences
  TO authenticated;

CREATE POLICY "Team recurrences: related users can read"
  ON public.team_match_recurrences
  FOR SELECT
  TO authenticated
  USING (
    private.can_access_series(
      series_id,
      (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION private.monthly_recurrence_date(
  p_month date,
  p_day_of_week smallint,
  p_week_of_month smallint
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog
AS $$
DECLARE
  v_first date := p_month - (extract(day FROM p_month)::integer - 1);
  v_last date := (
    p_month
    - (extract(day FROM p_month)::integer - 1)
    + interval '1 month - 1 day'
  )::date;
BEGIN
  IF p_day_of_week NOT BETWEEN 0 AND 6
     OR p_week_of_month NOT IN (-1, 1, 2, 3, 4)
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La recurrencia mensual no es valida.';
  END IF;

  IF p_week_of_month = -1 THEN
    RETURN v_last
      - ((extract(dow FROM v_last)::integer - p_day_of_week + 7) % 7);
  END IF;

  RETURN v_first
    + ((p_day_of_week - extract(dow FROM v_first)::integer + 7) % 7)
    + ((p_week_of_month - 1) * 7);
END;
$$;

REVOKE ALL ON FUNCTION private.monthly_recurrence_date(date, smallint, smallint)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.next_team_recurrence_at(
  p_frequency text,
  p_day_of_week smallint,
  p_week_of_month smallint,
  p_start_time time without time zone,
  p_after timestamptz,
  p_timezone text DEFAULT 'Europe/Madrid'
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO pg_catalog
AS $$
DECLARE
  v_after_local timestamp without time zone;
  v_candidate_local timestamp without time zone;
  v_candidate_date date;
  v_month date;
BEGIN
  IF p_timezone <> 'Europe/Madrid'
     OR p_frequency NOT IN ('weekly', 'monthly')
     OR p_day_of_week NOT BETWEEN 0 AND 6
     OR p_start_time IS NULL
     OR p_after IS NULL
     OR (p_frequency = 'weekly' AND p_week_of_month IS NOT NULL)
     OR (p_frequency = 'monthly' AND p_week_of_month NOT IN (-1, 1, 2, 3, 4))
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La configuracion de recurrencia no es valida.';
  END IF;

  v_after_local := p_after AT TIME ZONE p_timezone;

  IF p_frequency = 'weekly' THEN
    v_candidate_date := v_after_local::date
      + ((p_day_of_week - extract(dow FROM v_after_local)::integer + 7) % 7);
    v_candidate_local := v_candidate_date + p_start_time;

    IF v_candidate_local <= v_after_local THEN
      v_candidate_local := v_candidate_local + interval '7 days';
    END IF;
  ELSE
    v_month := date_trunc('month', v_after_local)::date;
    v_candidate_date := private.monthly_recurrence_date(
      v_month,
      p_day_of_week,
      p_week_of_month
    );
    v_candidate_local := v_candidate_date + p_start_time;

    IF v_candidate_local <= v_after_local THEN
      v_month := (v_month + interval '1 month')::date;
      v_candidate_date := private.monthly_recurrence_date(
        v_month,
        p_day_of_week,
        p_week_of_month
      );
      v_candidate_local := v_candidate_date + p_start_time;
    END IF;
  END IF;

  RETURN v_candidate_local AT TIME ZONE p_timezone;
END;
$$;

REVOKE ALL ON FUNCTION private.next_team_recurrence_at(
  text,
  smallint,
  smallint,
  time without time zone,
  timestamptz,
  text
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.create_team_match_instance(
  p_team_id uuid,
  p_recurrence_id uuid,
  p_date_time timestamptz,
  p_match_template jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_team record;
  v_match_id uuid;
BEGIN
  SELECT
    ms.id,
    ms.organizer_id,
    ms.confirmation_deadline_hours
  INTO v_team
  FROM public.match_series ms
  WHERE ms.id = p_team_id
    AND ms.automation_mode = 'manual'
    AND ms.is_active = true
    AND ms.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'El equipo ya no esta disponible.';
  END IF;

  INSERT INTO public.matches (
    organizer_id,
    title,
    location,
    location_lat,
    location_lng,
    location_city,
    date_time,
    price_per_player,
    requires_approval,
    status,
    requested_positions,
    min_players,
    venue_id,
    location_name_snapshot,
    address_snapshot,
    latitude_snapshot,
    longitude_snapshot,
    location_quality_status,
    description,
    level,
    team_a_color,
    team_b_color,
    series_id,
    recurrence_id,
    is_private,
    recruiting_public,
    confirmation_deadline
  )
  VALUES (
    v_team.organizer_id,
    p_match_template ->> 'title',
    p_match_template ->> 'location',
    (p_match_template ->> 'location_lat')::numeric,
    (p_match_template ->> 'location_lng')::numeric,
    p_match_template ->> 'location_city',
    p_date_time,
    (p_match_template ->> 'price_per_player')::numeric,
    false,
    'open',
    p_match_template -> 'requested_positions',
    2,
    NULLIF(p_match_template ->> 'venue_id', '')::uuid,
    p_match_template ->> 'location_name_snapshot',
    p_match_template ->> 'address_snapshot',
    (p_match_template ->> 'latitude_snapshot')::double precision,
    (p_match_template ->> 'longitude_snapshot')::double precision,
    p_match_template ->> 'location_quality_status',
    COALESCE(p_match_template ->> 'description', ''),
    p_match_template ->> 'level',
    p_match_template ->> 'team_a_color',
    p_match_template ->> 'team_b_color',
    v_team.id,
    p_recurrence_id,
    true,
    false,
    p_date_time - make_interval(hours => v_team.confirmation_deadline_hours)
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.match_participants (
    match_id,
    user_id,
    status
  )
  SELECT
    v_match_id,
    sm.user_id,
    'pending'
  FROM public.series_members sm
  WHERE sm.series_id = p_team_id
    AND sm.status = 'active'
  ON CONFLICT (match_id, user_id) DO NOTHING;

  RETURN v_match_id;
END;
$$;

REVOKE ALL ON FUNCTION private.create_team_match_instance(
  uuid,
  uuid,
  timestamptz,
  jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.generate_team_match_recurrences(
  p_now timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_recurrence_id uuid;
  v_rule record;
  v_last_date_time timestamptz;
  v_next_date_time timestamptz;
  v_match_id uuid;
  v_generated integer := 0;
BEGIN
  FOR v_recurrence_id IN
    SELECT r.id
    FROM public.team_match_recurrences r
    JOIN public.match_series ms ON ms.id = r.series_id
    WHERE r.is_active = true
      AND ms.is_active = true
      AND ms.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.matches future_match
        WHERE future_match.recurrence_id = r.id
          AND future_match.date_time >= p_now
      )
    ORDER BY r.created_at, r.id
  LOOP
    SELECT r.*
    INTO v_rule
    FROM public.team_match_recurrences r
    JOIN public.match_series ms ON ms.id = r.series_id
    WHERE r.id = v_recurrence_id
      AND r.is_active = true
      AND ms.is_active = true
      AND ms.deleted_at IS NULL
    FOR UPDATE OF r;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.matches future_match
      WHERE future_match.recurrence_id = v_recurrence_id
        AND future_match.date_time >= p_now
    ) THEN
      CONTINUE;
    END IF;

    SELECT max(m.date_time)
    INTO v_last_date_time
    FROM public.matches m
    WHERE m.recurrence_id = v_recurrence_id;

    IF v_last_date_time IS NULL OR v_last_date_time >= p_now THEN
      CONTINUE;
    END IF;

    v_next_date_time := private.next_team_recurrence_at(
      v_rule.frequency,
      v_rule.day_of_week,
      v_rule.week_of_month,
      v_rule.start_time,
      p_now,
      v_rule.timezone
    );

    BEGIN
      v_match_id := private.create_team_match_instance(
        v_rule.series_id,
        v_rule.id,
        v_next_date_time,
        v_rule.match_template
      );
      v_generated := v_generated + 1;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE WARNING
          'No se genero la recurrencia % porque el equipo ya tiene partido en %',
          v_rule.id,
          v_next_date_time;
    END;
  END LOOP;

  RETURN v_generated;
END;
$$;

REVOKE ALL ON FUNCTION private.generate_team_match_recurrences(timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.monthly_recurrence_date(date, smallint, smallint)
  TO postgres;

GRANT EXECUTE ON FUNCTION private.next_team_recurrence_at(
  text,
  smallint,
  smallint,
  time without time zone,
  timestamptz,
  text
) TO postgres;

GRANT EXECUTE ON FUNCTION private.create_team_match_instance(
  uuid,
  uuid,
  timestamptz,
  jsonb
) TO postgres;

GRANT EXECUTE ON FUNCTION private.generate_team_match_recurrences(timestamptz)
  TO postgres;

CREATE OR REPLACE FUNCTION private.guard_team_match_visibility_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog
AS $$
BEGIN
  IF NEW.series_id IS DISTINCT FROM OLD.series_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No se puede cambiar el equipo de un partido ya creado.';
  END IF;

  IF NEW.recurrence_id IS DISTINCT FROM OLD.recurrence_id
     AND current_setting('rondo.assign_team_recurrence', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No se puede cambiar la recurrencia de un partido ya creado.';
  END IF;

  IF OLD.series_id IS NOT NULL
     AND NEW.is_private IS DISTINCT FROM OLD.is_private
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No se puede cambiar la privacidad base de un partido de equipo.';
  END IF;

  IF OLD.series_id IS NOT NULL
     AND NEW.recruiting_public IS DISTINCT FROM OLD.recruiting_public
     AND current_setting('rondo.publish_team_match', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Usa la accion de publicar plazas libres.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER guard_team_match_visibility_update
  ON public.matches;

CREATE TRIGGER guard_team_match_visibility_update
BEFORE UPDATE OF series_id, recurrence_id, is_private, recruiting_public
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION private.guard_team_match_visibility_update();

CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id uuid,
  p_title text,
  p_location text,
  p_location_lat numeric,
  p_location_lng numeric,
  p_location_city text,
  p_date_time timestamptz,
  p_description text,
  p_level text,
  p_requested_positions jsonb,
  p_team_a_color text,
  p_team_b_color text,
  p_price_per_player numeric,
  p_venue_id uuid,
  p_location_name_snapshot text,
  p_address_snapshot text,
  p_latitude_snapshot double precision,
  p_longitude_snapshot double precision,
  p_location_quality_status text,
  p_recurrence_frequency text,
  p_recurrence_day_of_week integer,
  p_recurrence_week_of_month integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match_id uuid;
  v_recurrence_id uuid;
  v_local_date date;
  v_local_time time without time zone;
  v_template jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesion para crear el partido.';
  END IF;

  IF p_recurrence_frequency IS NULL THEN
    IF p_recurrence_day_of_week IS NOT NULL
       OR p_recurrence_week_of_month IS NOT NULL
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'La configuracion de recurrencia esta incompleta.';
    END IF;
  ELSIF p_recurrence_frequency NOT IN ('weekly', 'monthly')
     OR p_recurrence_day_of_week NOT BETWEEN 0 AND 6
     OR (
       p_recurrence_frequency = 'weekly'
       AND p_recurrence_week_of_month IS NOT NULL
     )
     OR (
       p_recurrence_frequency = 'monthly'
       AND p_recurrence_week_of_month NOT IN (-1, 1, 2, 3, 4)
     )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La configuracion de recurrencia no es valida.';
  END IF;

  IF p_recurrence_frequency IS NOT NULL THEN
    v_local_date := (p_date_time AT TIME ZONE 'Europe/Madrid')::date;
    v_local_time := (p_date_time AT TIME ZONE 'Europe/Madrid')::time;

    IF extract(dow FROM v_local_date)::integer <> p_recurrence_day_of_week
       OR (
         p_recurrence_frequency = 'monthly'
         AND private.monthly_recurrence_date(
           v_local_date,
           p_recurrence_day_of_week::smallint,
           p_recurrence_week_of_month::smallint
         ) <> v_local_date
       )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'La primera fecha no coincide con la recurrencia elegida.';
    END IF;
  END IF;

  v_match_id := public.create_team_match(
    p_team_id,
    p_title,
    p_location,
    p_location_lat,
    p_location_lng,
    p_location_city,
    p_date_time,
    p_description,
    p_level,
    p_requested_positions,
    p_team_a_color,
    p_team_b_color,
    p_price_per_player,
    false,
    p_venue_id,
    p_location_name_snapshot,
    p_address_snapshot,
    p_latitude_snapshot,
    p_longitude_snapshot,
    p_location_quality_status
  );

  IF p_recurrence_frequency IS NULL THEN
    RETURN v_match_id;
  END IF;

  SELECT jsonb_build_object(
    'title', m.title,
    'location', m.location,
    'location_lat', m.location_lat,
    'location_lng', m.location_lng,
    'location_city', m.location_city,
    'price_per_player', m.price_per_player,
    'requested_positions', m.requested_positions,
    'venue_id', m.venue_id,
    'location_name_snapshot', m.location_name_snapshot,
    'address_snapshot', m.address_snapshot,
    'latitude_snapshot', m.latitude_snapshot,
    'longitude_snapshot', m.longitude_snapshot,
    'location_quality_status', m.location_quality_status,
    'description', m.description,
    'level', m.level,
    'team_a_color', m.team_a_color,
    'team_b_color', m.team_b_color
  )
  INTO v_template
  FROM public.matches m
  WHERE m.id = v_match_id;

  INSERT INTO public.team_match_recurrences (
    series_id,
    created_by,
    frequency,
    day_of_week,
    week_of_month,
    start_time,
    timezone,
    match_template
  )
  VALUES (
    p_team_id,
    v_user_id,
    p_recurrence_frequency,
    p_recurrence_day_of_week,
    p_recurrence_week_of_month,
    v_local_time,
    'Europe/Madrid',
    v_template
  )
  RETURNING id INTO v_recurrence_id;

  PERFORM set_config('rondo.assign_team_recurrence', 'on', true);

  UPDATE public.matches
  SET recurrence_id = v_recurrence_id
  WHERE id = v_match_id;

  UPDATE public.team_match_recurrences
  SET first_match_id = v_match_id
  WHERE id = v_recurrence_id;

  RETURN v_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_match(
  uuid,
  text,
  text,
  numeric,
  numeric,
  text,
  timestamptz,
  text,
  text,
  jsonb,
  text,
  text,
  numeric,
  uuid,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  integer,
  integer
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.create_team_match(
  uuid,
  text,
  text,
  numeric,
  numeric,
  text,
  timestamptz,
  text,
  text,
  jsonb,
  text,
  text,
  numeric,
  uuid,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  integer,
  integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_team_match_recurrence(
  p_recurrence_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rule record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesion para anular la recurrencia.';
  END IF;

  SELECT r.id, r.is_active
  INTO v_rule
  FROM public.team_match_recurrences r
  JOIN public.match_series ms ON ms.id = r.series_id
  WHERE r.id = p_recurrence_id
    AND ms.organizer_id = v_user_id
    AND ms.deleted_at IS NULL
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Solo el capitan puede anular esta recurrencia.';
  END IF;

  IF NOT v_rule.is_active THEN
    RETURN false;
  END IF;

  UPDATE public.team_match_recurrences
  SET
    is_active = false,
    cancelled_at = now()
  WHERE id = p_recurrence_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_team_match_recurrence(uuid)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.cancel_team_match_recurrence(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_team_match(
  p_match_id uuid,
  p_requires_approval boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_remaining integer;
BEGIN
  IF p_requires_approval IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Elige como se apuntaran los jugadores.';
  END IF;

  v_remaining := public.publish_team_match(p_match_id);

  UPDATE public.matches
  SET requires_approval = p_requires_approval
  WHERE id = p_match_id;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_team_match(uuid, boolean)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.publish_team_match(uuid, boolean)
  TO authenticated;

COMMIT;
