BEGIN;

CREATE OR REPLACE FUNCTION public.leave_team(
  p_team_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_organizer_id uuid;
  v_member_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Debes iniciar sesión para abandonar el equipo.';
  END IF;

  SELECT ms.organizer_id
  INTO v_organizer_id
  FROM public.match_series ms
  WHERE ms.id = p_team_id
    AND ms.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Ese equipo ya no está disponible.';
  END IF;

  IF v_organizer_id = v_user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'El capitán no puede abandonar el equipo. Debe eliminarlo.';
  END IF;

  SELECT sm.id
  INTO v_member_id
  FROM public.series_members sm
  WHERE sm.series_id = p_team_id
    AND sm.user_id = v_user_id
    AND sm.status = 'active'
  FOR UPDATE;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Ya no formas parte de este equipo.';
  END IF;

  UPDATE public.series_members
  SET status = 'removed'
  WHERE id = v_member_id;

  DELETE FROM public.match_participants mp
  USING public.matches m
  WHERE mp.match_id = m.id
    AND mp.user_id = v_user_id
    AND mp.status IN ('pending', 'declined')
    AND m.series_id = p_team_id
    AND m.date_time > now()
    AND m.status IN ('open', 'full')
    AND m.is_private = true
    AND m.recruiting_public = false;

  RETURN p_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_team(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.leave_team(uuid)
  TO authenticated;

COMMIT;
