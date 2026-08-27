BEGIN;

ALTER TABLE public.match_series
  ADD COLUMN avatar_url text,
  ADD COLUMN deleted_at timestamptz;

ALTER TABLE public.match_series
  DROP CONSTRAINT match_series_title_check,
  ADD CONSTRAINT match_series_title_check
    CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  DROP CONSTRAINT match_series_price_check,
  ADD CONSTRAINT match_series_price_check
    CHECK (price_per_player BETWEEN 0 AND 10000),
  ADD CONSTRAINT match_series_avatar_url_check
    CHECK (
      avatar_url IS NULL
      OR (
        char_length(avatar_url) <= 2048
        AND avatar_url ~ '^https://[^[:space:]]+$'
      )
    );

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
        AND ms.deleted_at IS NULL
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
      JOIN public.match_series ms
        ON ms.id = sm.series_id
      WHERE sm.series_id = p_series_id
        AND sm.user_id = p_user_id
        AND sm.status = 'active'
        AND ms.is_active = true
        AND ms.deleted_at IS NULL
    );
$$;

DROP POLICY IF EXISTS
  "Series: related users can read"
  ON public.match_series;

CREATE POLICY "Series: related users can read"
  ON public.match_series
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      organizer_id = (SELECT auth.uid())
      OR private.is_active_series_member(
        id,
        (SELECT auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS
  "Series: organizer can create"
  ON public.match_series;

CREATE POLICY "Series: organizer can create"
  ON public.match_series
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = (SELECT auth.uid())
    AND deleted_at IS NULL
    AND is_active = true
    AND avatar_url IS NULL
  );

DROP POLICY IF EXISTS
  "Series: organizer can update"
  ON public.match_series;

DROP POLICY IF EXISTS
  "Series: organizer can delete"
  ON public.match_series;

DROP POLICY IF EXISTS
  "Series members: organizer can update"
  ON public.series_members;

DROP POLICY IF EXISTS
  "Series members: organizer can delete"
  ON public.series_members;

REVOKE UPDATE, DELETE
  ON public.match_series
  FROM authenticated;

REVOKE UPDATE, DELETE
  ON public.series_members
  FROM authenticated;

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

CREATE OR REPLACE FUNCTION public.update_team_details(
  p_team_id uuid,
  p_title text,
  p_city text,
  p_price_per_player numeric,
  p_avatar_url text
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

  IF v_title IS NULL OR char_length(v_title) NOT BETWEEN 3 AND 100 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'El nombre debe tener entre 3 y 100 caracteres.';
  END IF;

  IF v_city IS NOT NULL AND char_length(v_city) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'La ciudad debe tener entre 2 y 80 caracteres.';
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
    avatar_url = v_avatar_url
  WHERE id = p_team_id;

  RETURN p_team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_requesting_user_id uuid := auth.uid();
  v_team record;
  v_member_id uuid;
BEGIN
  IF v_requesting_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para gestionar la plantilla.';
  END IF;

  IF p_user_id IS NULL OR p_user_id = v_requesting_user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'No puedes expulsarte a ti mismo del equipo.';
  END IF;

  SELECT ms.id
  INTO v_team
  FROM public.match_series ms
  WHERE ms.id = p_team_id
    AND ms.organizer_id = v_requesting_user_id
    AND ms.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes gestionar este equipo.';
  END IF;

  SELECT sm.id
  INTO v_member_id
  FROM public.series_members sm
  WHERE sm.series_id = p_team_id
    AND sm.user_id = p_user_id
    AND sm.status = 'active'
  FOR UPDATE;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Ese jugador ya no forma parte de la plantilla.';
  END IF;

  UPDATE public.series_members
  SET status = 'removed'
  WHERE id = v_member_id;

  DELETE FROM public.match_participants mp
  USING public.matches m
  WHERE mp.match_id = m.id
    AND mp.user_id = p_user_id
    AND mp.status IN ('pending', 'declined')
    AND m.series_id = p_team_id
    AND m.date_time > now()
    AND m.status IN ('open', 'full')
    AND m.is_private = true
    AND m.recruiting_public = false;

  RETURN p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_team(
  p_team_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para eliminar el equipo.';
  END IF;

  SELECT ms.id
  INTO v_team
  FROM public.match_series ms
  WHERE ms.id = p_team_id
    AND ms.organizer_id = v_user_id
    AND ms.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'No puedes gestionar este equipo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.series_id = p_team_id
      AND m.date_time > now()
      AND m.status IN ('open', 'full')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Cancela o finaliza los partidos futuros antes de eliminar el equipo.';
  END IF;

  UPDATE public.match_series
  SET
    is_active = false,
    deleted_at = now()
  WHERE id = p_team_id;

  RETURN p_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_match_series(text)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.update_team_details(
  uuid,
  text,
  text,
  numeric,
  text
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.remove_team_member(uuid, uuid)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.delete_team(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.join_match_series(text)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_team_details(
  uuid,
  text,
  text,
  numeric,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_team(uuid)
  TO authenticated;

COMMIT;
