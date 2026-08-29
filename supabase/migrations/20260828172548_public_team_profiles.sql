BEGIN;

ALTER TABLE public.match_series
  ADD COLUMN description text;

ALTER TABLE public.match_series
  ADD CONSTRAINT match_series_description_check
  CHECK (
    description IS NULL
    OR char_length(btrim(description)) BETWEEN 1 AND 300
  );

REVOKE ALL ON FUNCTION public.update_team_details(
  uuid,
  text,
  text,
  numeric,
  text
) FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.update_team_details(
  uuid,
  text,
  text,
  numeric,
  text
);

CREATE FUNCTION public.update_team_details(
  p_team_id uuid,
  p_title text,
  p_city text,
  p_price_per_player numeric,
  p_avatar_url text,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_title text := btrim(p_title);
  v_city text := NULLIF(btrim(p_city), '');
  v_avatar_url text := NULLIF(btrim(p_avatar_url), '');
  v_description text := NULLIF(btrim(p_description), '');
  v_avatar_prefix text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para editar el equipo.';
  END IF;

  SELECT ms.id, ms.deleted_at
  INTO v_team
  FROM public.match_series ms
  WHERE ms.id = p_team_id
    AND ms.organizer_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes gestionar este equipo.';
  END IF;

  IF v_team.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Este equipo ya no está disponible.';
  END IF;

  IF v_title IS NULL
     OR char_length(v_title) NOT BETWEEN 3 AND 100 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El nombre debe tener entre 3 y 100 caracteres.';
  END IF;

  IF v_city IS NOT NULL
     AND char_length(v_city) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La ciudad debe tener entre 2 y 80 caracteres.';
  END IF;

  IF v_description IS NOT NULL
     AND char_length(v_description) > 300 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La descripción no puede superar los 300 caracteres.';
  END IF;

  IF p_price_per_player IS NULL
     OR p_price_per_player < 0
     OR p_price_per_player > 10000 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El precio debe estar entre 0 y 10.000.';
  END IF;

  IF v_avatar_url IS NOT NULL THEN
    v_avatar_prefix :=
      'https://fbxixnlablcbavzpwivw.supabase.co/storage/v1/object/public/avatars/'
      || v_user_id::text
      || '/teams/'
      || p_team_id::text
      || '/';

    IF char_length(v_avatar_url) > 2048
       OR NOT starts_with(v_avatar_url, v_avatar_prefix) THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'La foto del equipo no es válida.';
    END IF;
  END IF;

  UPDATE public.match_series
  SET
    title = v_title,
    city = v_city,
    price_per_player = p_price_per_player,
    avatar_url = v_avatar_url,
    description = v_description
  WHERE id = p_team_id;

  RETURN p_team_id;
END;
$$;

CREATE FUNCTION public.get_public_team(
  p_team_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para ver el equipo.';
  END IF;

  IF p_team_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El equipo no está disponible.';
  END IF;

  SELECT jsonb_build_object(
    'id', ms.id,
    'organizer_id', ms.organizer_id,
    'title', ms.title,
    'city', ms.city,
    'description', ms.description,
    'avatar_url', ms.avatar_url,
    'completed_matches', (
      SELECT count(*)
      FROM public.matches m
      WHERE m.series_id = ms.id
        AND m.status = 'completed'
    ),
    'captain', jsonb_build_object(
      'id', captain.id,
      'username', captain.username,
      'full_name', captain.full_name,
      'avatar_url', captain.avatar_url,
      'preferred_position', captain.preferred_position
    ),
    'roster',
      jsonb_build_array(
        jsonb_build_object(
          'id', captain.id,
          'username', captain.username,
          'full_name', captain.full_name,
          'avatar_url', captain.avatar_url,
          'preferred_position', captain.preferred_position,
          'is_captain', true
        )
      )
      ||
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', member_user.id,
              'username', member_user.username,
              'full_name', member_user.full_name,
              'avatar_url', member_user.avatar_url,
              'preferred_position', member_user.preferred_position,
              'is_captain', false
            )
            ORDER BY sm.created_at
          )
          FROM public.series_members sm
          JOIN public.users member_user
            ON member_user.id = sm.user_id
          WHERE sm.series_id = ms.id
            AND sm.status = 'active'
            AND sm.user_id <> ms.organizer_id
        ),
        '[]'::jsonb
      )
  )
  INTO v_result
  FROM public.match_series ms
  JOIN public.users captain
    ON captain.id = ms.organizer_id
  WHERE ms.id = p_team_id
    AND ms.is_active = true
    AND ms.deleted_at IS NULL;

  IF v_result IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El equipo no está disponible.';
  END IF;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.get_public_user_teams(
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  city text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO pg_catalog
AS $$
DECLARE
  v_requesting_user_id uuid := auth.uid();
BEGIN
  IF v_requesting_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para ver los equipos.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El usuario no es válido.';
  END IF;

  RETURN QUERY
  SELECT
    ms.id,
    ms.title,
    ms.city,
    ms.avatar_url
  FROM public.match_series ms
  WHERE ms.is_active = true
    AND ms.deleted_at IS NULL
    AND (
      ms.organizer_id = p_user_id
      OR EXISTS (
        SELECT 1
        FROM public.series_members sm
        WHERE sm.series_id = ms.id
          AND sm.user_id = p_user_id
          AND sm.status = 'active'
      )
    )
  ORDER BY ms.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_details(
  uuid,
  text,
  text,
  numeric,
  text,
  text
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.get_public_team(uuid)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.get_public_user_teams(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_team_details(
  uuid,
  text,
  text,
  numeric,
  text,
  text
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_public_team(uuid)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_public_user_teams(uuid)
  TO authenticated, service_role;

COMMIT;
