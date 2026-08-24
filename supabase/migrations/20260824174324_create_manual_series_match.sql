BEGIN;

CREATE OR REPLACE FUNCTION public.create_manual_series_match(
  p_series_id uuid,
  p_date_time timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_series record;
  v_match_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para crear el partido.';
  END IF;

  IF p_date_time IS NULL
     OR p_date_time <= now()
     OR p_date_time > now() + interval '1 year'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Elige una fecha futura válida.';
  END IF;

  SELECT
    ms.id,
    ms.organizer_id,
    ms.title,
    ms.venue_id,
    ms.requested_positions,
    ms.min_players,
    ms.price_per_player,
    ms.requires_approval,
    ms.confirmation_deadline_hours,
    v.canonical_name,
    v.address,
    v.city,
    v.latitude,
    v.longitude
  INTO v_series
  FROM public.match_series ms
  JOIN public.venues v ON v.id = ms.venue_id
  WHERE ms.id = p_series_id
    AND ms.organizer_id = v_user_id
    AND ms.automation_mode = 'manual'
    AND ms.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes crear un partido para este grupo.';
  END IF;

  SELECT m.id
  INTO v_match_id
  FROM public.matches m
  WHERE m.series_id = p_series_id
    AND m.date_time = p_date_time;

  IF v_match_id IS NULL THEN
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
      series_id,
      is_private,
      recruiting_public,
      confirmation_deadline
    )
    VALUES (
      v_series.organizer_id,
      v_series.title,
      concat_ws(
        ', ',
        v_series.canonical_name,
        nullif(v_series.address, ''),
        v_series.city
      ),
      v_series.latitude,
      v_series.longitude,
      v_series.city,
      p_date_time,
      v_series.price_per_player,
      v_series.requires_approval,
      'open',
      v_series.requested_positions,
      v_series.min_players,
      v_series.venue_id,
      v_series.canonical_name,
      v_series.address,
      v_series.latitude,
      v_series.longitude,
      'confirmed',
      v_series.id,
      true,
      false,
      p_date_time
        - make_interval(hours => v_series.confirmation_deadline_hours)
    )
    ON CONFLICT (series_id, date_time)
      WHERE series_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_match_id;

    IF v_match_id IS NULL THEN
      SELECT m.id
      INTO v_match_id
      FROM public.matches m
      WHERE m.series_id = p_series_id
        AND m.date_time = p_date_time;
    END IF;
  END IF;

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
  WHERE sm.series_id = p_series_id
    AND sm.status = 'active'
  ON CONFLICT (match_id, user_id) DO NOTHING;

  RETURN v_match_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.create_manual_series_match(uuid, timestamptz)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.create_manual_series_match(uuid, timestamptz)
  TO authenticated;

COMMIT;
