-- Break RLS recursion between matches and match_participants policies.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_match_participant(
  p_match_id uuid,
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
      FROM public.match_participants mp
      WHERE mp.match_id = p_match_id
        AND mp.user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION private.is_match_organizer(
  p_match_id uuid,
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
      FROM public.matches m
      WHERE m.id = p_match_id
        AND m.organizer_id = p_user_id
    );
$$;

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
            m.status IN ('open', 'full')
            OR m.organizer_id = p_requesting_user_id
            OR EXISTS (
              SELECT 1
              FROM public.match_participants mine
              WHERE mine.match_id = m.id
                AND mine.user_id = p_requesting_user_id
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION private.is_match_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_match_organizer(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_read_match_participant(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_match_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_match_organizer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_match_participant(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Matches: read authenticated discoverable or related" ON public.matches;
CREATE POLICY "Matches: read authenticated discoverable or related"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'full')
    OR organizer_id = (select auth.uid())
    OR (select private.is_match_participant(matches.id, (select auth.uid())))
  );

DROP POLICY IF EXISTS "Participants: read authenticated discoverable or related" ON public.match_participants;
CREATE POLICY "Participants: read authenticated discoverable or related"
  ON public.match_participants
  FOR SELECT
  TO authenticated
  USING (
    (select private.can_read_match_participant(
      match_participants.match_id,
      match_participants.user_id,
      (select auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Participants: organizer can update status" ON public.match_participants;
CREATE POLICY "Participants: organizer can update status"
  ON public.match_participants
  FOR UPDATE
  TO authenticated
  USING (
    (select private.is_match_organizer(match_participants.match_id, (select auth.uid())))
  )
  WITH CHECK (
    (select private.is_match_organizer(match_participants.match_id, (select auth.uid())))
  );

COMMIT;
