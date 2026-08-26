BEGIN;

CREATE OR REPLACE FUNCTION private.can_join_match(
  p_match_id uuid,
  p_user_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = p_match_id
        AND m.status = 'open'
        AND (NOT m.is_private OR m.recruiting_public)
        AND (
          (m.requires_approval AND p_status = 'pending')
          OR (NOT m.requires_approval AND p_status = 'joined')
        )
    );
$$;

REVOKE ALL ON FUNCTION private.can_join_match(uuid, uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.can_join_match(uuid, uuid, text)
  TO authenticated;

DROP POLICY IF EXISTS
  "Participants: insert self"
  ON public.match_participants;

CREATE POLICY "Participants: insert self"
  ON public.match_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND private.can_join_match(
      match_id,
      (SELECT auth.uid()),
      status
    )
  );

DROP POLICY IF EXISTS
  "Matches: insert own"
  ON public.matches;

CREATE POLICY "Matches: insert own"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
    AND series_id IS NULL
  );

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
      MESSAGE = 'Usa la acción de publicar plazas libres.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_team_match_visibility_update()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_team_match_visibility_update
  ON public.matches;

CREATE TRIGGER guard_team_match_visibility_update
BEFORE UPDATE OF series_id, is_private, recruiting_public
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
  p_requires_approval boolean,
  p_venue_id uuid,
  p_location_name_snapshot text,
  p_address_snapshot text,
  p_latitude_snapshot double precision,
  p_longitude_snapshot double precision,
  p_location_quality_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_match_id uuid;
  v_capacity numeric;
  v_positions jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para crear el partido.';
  END IF;

  SELECT
    ms.id,
    ms.organizer_id,
    ms.confirmation_deadline_hours
  INTO v_team
  FROM public.match_series ms
  WHERE ms.id = p_team_id
    AND ms.organizer_id = v_user_id
    AND ms.automation_mode = 'manual'
    AND ms.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes crear un partido para este equipo.';
  END IF;

  IF p_title IS NULL
     OR char_length(btrim(p_title)) < 3
     OR char_length(btrim(p_title)) > 120
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El título debe tener entre 3 y 120 caracteres.';
  END IF;

  IF p_location IS NULL
     OR char_length(btrim(p_location)) < 3
     OR char_length(btrim(p_location)) > 500
     OR p_location_lat IS NULL
     OR p_location_lng IS NULL
     OR p_location_lat NOT BETWEEN -90 AND 90
     OR p_location_lng NOT BETWEEN -180 AND 180
     OR p_location_city IS NULL
     OR char_length(btrim(p_location_city)) < 2
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Selecciona una ubicación válida y geolocalizada.';
  END IF;

  IF p_date_time IS NULL
     OR p_date_time <= now()
     OR p_date_time > now() + interval '1 year'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Elige una fecha futura válida.';
  END IF;

  IF p_level NOT IN ('tranquilo', 'medio', 'competitivo') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El nivel del partido no es válido.';
  END IF;

  IF p_location_quality_status NOT IN (
    'confirmed',
    'user_adjusted',
    'external_unverified',
    'venue_reported'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La calidad de la ubicación no es válida.';
  END IF;

  IF p_team_a_color IS NULL
     OR p_team_a_color !~* '^#[0-9a-f]{6}$'
     OR p_team_b_color IS NULL
     OR p_team_b_color !~* '^#[0-9a-f]{6}$'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Los colores de las camisetas no son válidos.';
  END IF;

  IF p_price_per_player IS NULL
     OR p_price_per_player < 0
     OR p_price_per_player > 10000
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El precio por persona no es válido.';
  END IF;

  IF p_requested_positions IS NULL
     OR jsonb_typeof(p_requested_positions) <> 'object'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Las posiciones solicitadas no son válidas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each_text(p_requested_positions) position
    WHERE position.key NOT IN (
      'portero',
      'defensa',
      'mediocentro',
      'delantero',
      'cualquiera'
    )
      OR position.value !~ '^[0-9]+$'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Las posiciones solicitadas no son válidas.';
  END IF;

  SELECT COALESCE(sum(position.value::numeric), 0)
  INTO v_capacity
  FROM jsonb_each_text(p_requested_positions) position;

  IF v_capacity < 1 OR v_capacity > 100 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El aforo debe estar entre 1 y 100 jugadores.';
  END IF;

  v_positions := jsonb_build_object(
    'portero', COALESCE((p_requested_positions ->> 'portero')::integer, 0),
    'defensa', COALESCE((p_requested_positions ->> 'defensa')::integer, 0),
    'mediocentro', COALESCE((p_requested_positions ->> 'mediocentro')::integer, 0),
    'delantero', COALESCE((p_requested_positions ->> 'delantero')::integer, 0),
    'cualquiera', COALESCE((p_requested_positions ->> 'cualquiera')::integer, 0)
  );

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
    is_private,
    recruiting_public,
    confirmation_deadline
  )
  VALUES (
    v_team.organizer_id,
    btrim(p_title),
    btrim(p_location),
    p_location_lat,
    p_location_lng,
    btrim(p_location_city),
    p_date_time,
    p_price_per_player,
    COALESCE(p_requires_approval, false),
    'open',
    v_positions,
    2,
    p_venue_id,
    COALESCE(NULLIF(btrim(p_location_name_snapshot), ''), btrim(p_location)),
    NULLIF(btrim(p_address_snapshot), ''),
    COALESCE(p_latitude_snapshot, p_location_lat::double precision),
    COALESCE(p_longitude_snapshot, p_location_lng::double precision),
    p_location_quality_status,
    COALESCE(p_description, ''),
    p_level,
    upper(p_team_a_color),
    upper(p_team_b_color),
    v_team.id,
    true,
    false,
    p_date_time
      - make_interval(hours => v_team.confirmation_deadline_hours)
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
  boolean,
  uuid,
  text,
  text,
  double precision,
  double precision,
  text
) FROM PUBLIC, anon;

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
  boolean,
  uuid,
  text,
  text,
  double precision,
  double precision,
  text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_manual_series_match(uuid, timestamptz)
  FROM authenticated;

CREATE OR REPLACE FUNCTION public.publish_team_match(
  p_match_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match record;
  v_capacity integer;
  v_joined integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para publicar el partido.';
  END IF;

  SELECT
    m.id,
    m.organizer_id,
    m.series_id,
    m.status,
    m.is_private,
    m.recruiting_public,
    m.requested_positions
  INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'No encontramos ese partido.';
  END IF;

  IF v_match.organizer_id <> v_user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Solo el organizador puede publicar plazas libres.';
  END IF;

  IF v_match.series_id IS NULL OR NOT v_match.is_private THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Este partido no pertenece a un equipo privado.';
  END IF;

  IF v_match.recruiting_public THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El partido ya está abierto a Rondo.';
  END IF;

  IF v_match.status NOT IN ('open', 'full') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Este partido ya no admite jugadores.';
  END IF;

  SELECT COALESCE(sum(position.value::integer), 0)
  INTO v_capacity
  FROM jsonb_each_text(v_match.requested_positions) position;

  SELECT count(*)
  INTO v_joined
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.status IN ('joined', 'approved');

  IF v_capacity <= v_joined THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El partido no tiene plazas libres.';
  END IF;

  DELETE FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.status IN ('pending', 'declined');

  PERFORM set_config('rondo.publish_team_match', 'on', true);

  UPDATE public.matches
  SET recruiting_public = true
  WHERE id = p_match_id;

  RETURN v_capacity - v_joined;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_team_match(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.publish_team_match(uuid)
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
  v_match record;
  v_capacity integer;
  v_joined integer;
  v_participant_id uuid;
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

  SELECT
    m.id,
    m.series_id,
    m.status,
    m.is_private,
    m.recruiting_public,
    m.requested_positions
  INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_match.series_id IS NULL
     OR NOT v_match.is_private
     OR v_match.recruiting_public
     OR v_match.status NOT IN ('open', 'full')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Este partido ya no admite confirmaciones del equipo.';
  END IF;

  SELECT
    mp.id,
    mp.status
  INTO
    v_participant_id,
    v_result
  FROM public.match_participants mp
  JOIN public.series_members sm
    ON sm.series_id = v_match.series_id
   AND sm.user_id = mp.user_id
   AND sm.status = 'active'
  WHERE mp.match_id = p_match_id
    AND mp.user_id = v_user_id;

  IF v_result = p_response THEN
    RETURN v_result;
  END IF;

  IF v_participant_id IS NULL OR v_result <> 'pending' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes responder a este partido.';
  END IF;

  IF p_response = 'joined' THEN
    SELECT COALESCE(sum(position.value::integer), 0)
    INTO v_capacity
    FROM jsonb_each_text(v_match.requested_positions) position;

    SELECT count(*)
    INTO v_joined
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.status IN ('joined', 'approved');

    IF v_capacity <= v_joined THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'Ya no quedan plazas en este partido.';
    END IF;
  END IF;

  UPDATE public.match_participants mp
  SET status = p_response
  WHERE mp.id = v_participant_id
    AND mp.status = 'pending'
  RETURNING mp.status INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'La respuesta cambió mientras la guardábamos. Inténtalo de nuevo.';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_series_match(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.respond_to_series_match(uuid, text)
  TO authenticated;

COMMIT;
