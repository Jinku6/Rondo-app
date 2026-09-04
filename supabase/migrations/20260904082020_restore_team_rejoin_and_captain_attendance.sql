-- Applied to production as migration 20260904082020.
BEGIN;

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
  v_code text := lower(btrim(p_invite_code));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para unirte al equipo.';
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
    AND ms.is_active = true
    AND ms.deleted_at IS NULL;

  IF v_series_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Este enlace de invitación no es válido.';
  END IF;

  WITH joined_member AS (
    INSERT INTO public.series_members AS existing_member (
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
    ON CONFLICT (series_id, user_id) DO UPDATE
    SET
      status = 'active',
      invited_by = EXCLUDED.invited_by
    WHERE existing_member.status = 'removed'
    RETURNING user_id
  )
  INSERT INTO public.match_participants (
    match_id,
    user_id,
    status
  )
  SELECT
    m.id,
    joined_member.user_id,
    'pending'
  FROM joined_member
  JOIN public.matches m
    ON m.series_id = v_series_id
  WHERE m.date_time > now()
    AND m.status IN ('open', 'full')
    AND m.is_private = true
    AND m.recruiting_public = false
  ON CONFLICT (match_id, user_id) DO NOTHING;

  RETURN v_series_id;
END;
$$;

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

  UPDATE public.match_participants
  SET status = 'joined'
  WHERE match_id = v_match_id
    AND user_id = v_user_id
    AND status = 'pending';

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

UPDATE public.match_participants mp
SET status = 'joined'
FROM public.matches m
LEFT JOIN public.team_match_recurrences r
  ON r.first_match_id = m.id
WHERE mp.match_id = m.id
  AND mp.user_id = m.organizer_id
  AND mp.status = 'pending'
  AND m.date_time > now()
  AND m.status IN ('open', 'full')
  AND m.is_private = true
  AND m.recruiting_public = false
  AND (m.recurrence_id IS NULL OR r.id IS NOT NULL);

REVOKE ALL ON FUNCTION public.create_team_match(
  uuid, text, text, numeric, numeric, text, timestamptz, text, text, jsonb,
  text, text, numeric, uuid, text, text, double precision, double precision,
  text, text, integer, integer
) FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.create_team_match(
  uuid, text, text, numeric, numeric, text, timestamptz, text, text, jsonb,
  text, text, numeric, uuid, text, text, double precision, double precision,
  text, text, integer, integer
) TO authenticated;

COMMIT;
