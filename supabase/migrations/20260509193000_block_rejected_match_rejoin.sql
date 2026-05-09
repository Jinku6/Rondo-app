-- Prevent players from creating a new participation after a pending/joined/approved/rejected record exists.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_blocking_match_participation(
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
        AND mp.status IN ('pending', 'joined', 'approved', 'rejected')
    );
$$;

REVOKE ALL ON FUNCTION private.has_blocking_match_participation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_blocking_match_participation(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants: insert self" ON public.match_participants;
CREATE POLICY "Participants: insert self"
  ON public.match_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND status IN ('pending', 'joined')
    AND NOT (select private.has_blocking_match_participation(match_participants.match_id, match_participants.user_id))
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.status = 'open'
        AND m.organizer_id <> (select auth.uid())
        AND (
          (m.requires_approval = true AND match_participants.status = 'pending')
          OR (m.requires_approval = false AND match_participants.status = 'joined')
        )
    )
  );

COMMIT;
