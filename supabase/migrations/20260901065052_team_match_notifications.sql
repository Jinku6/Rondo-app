BEGIN;

CREATE OR REPLACE FUNCTION private.ensure_team_captain_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
BEGIN
  INSERT INTO public.series_members AS existing_member (
    series_id,
    user_id,
    status,
    invited_by
  )
  VALUES (
    NEW.id,
    NEW.organizer_id,
    'active',
    NEW.organizer_id
  )
  ON CONFLICT (series_id, user_id) DO UPDATE
  SET
    status = 'active',
    invited_by = COALESCE(existing_member.invited_by, EXCLUDED.invited_by);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_team_captain_membership()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS ensure_team_captain_membership
  ON public.match_series;

CREATE TRIGGER ensure_team_captain_membership
AFTER INSERT ON public.match_series
FOR EACH ROW
EXECUTE FUNCTION private.ensure_team_captain_membership();

INSERT INTO public.series_members AS existing_member (
  series_id,
  user_id,
  status,
  invited_by
)
SELECT
  ms.id,
  ms.organizer_id,
  'active',
  ms.organizer_id
FROM public.match_series ms
WHERE ms.is_active = true
  AND ms.deleted_at IS NULL
ON CONFLICT (series_id, user_id) DO UPDATE
SET
  status = 'active',
  invited_by = COALESCE(existing_member.invited_by, EXCLUDED.invited_by);

INSERT INTO public.match_participants (
  match_id,
  user_id,
  status
)
SELECT
  m.id,
  m.organizer_id,
  'pending'
FROM public.matches m
JOIN public.match_series ms
  ON ms.id = m.series_id
 AND ms.organizer_id = m.organizer_id
JOIN public.series_members sm
  ON sm.series_id = ms.id
 AND sm.user_id = ms.organizer_id
 AND sm.status = 'active'
WHERE ms.is_active = true
  AND ms.deleted_at IS NULL
  AND m.is_private = true
  AND m.recruiting_public = false
  AND m.status IN ('open', 'full')
  AND m.date_time > now()
ON CONFLICT (match_id, user_id) DO NOTHING;

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

  INSERT INTO public.notifications (
    user_id,
    match_id,
    type,
    read
  )
  SELECT
    mp.user_id,
    p_match_id,
    'team_match_published',
    true
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.status = 'pending'
  ON CONFLICT (user_id, match_id, type) DO NOTHING;

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

COMMIT;
