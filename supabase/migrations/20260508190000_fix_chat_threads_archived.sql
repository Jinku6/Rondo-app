-- Fix get_user_chat_threads: include archived threads and expose `archived` field.
-- Previously the function excluded completed/archived/cancelled matches entirely,
-- causing the "Archivados" tab to always appear empty.

DROP FUNCTION IF EXISTS public.get_user_chat_threads();

CREATE FUNCTION public.get_user_chat_threads()
RETURNS TABLE(
  match_id uuid,
  player_id uuid,
  organizer_id uuid,
  match_title text,
  last_message text,
  last_message_at timestamp with time zone,
  sender_id uuid,
  is_read boolean,
  other_user_name text,
  other_user_avatar text,
  archived boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH thread_latest AS (
    SELECT
      c.match_id,
      c.player_id,
      c.content,
      c.created_at,
      c.sender_id,
      c.is_read,
      ROW_NUMBER() OVER (PARTITION BY c.match_id, c.player_id ORDER BY c.created_at DESC) as rn
    FROM public.chat_messages c
    WHERE c.player_id = auth.uid()
       OR c.match_id IN (SELECT m.id FROM public.matches m WHERE m.organizer_id = auth.uid())
  )
  SELECT
    t.match_id,
    t.player_id,
    m.organizer_id,
    m.title AS match_title,
    t.content AS last_message,
    t.created_at AS last_message_at,
    t.sender_id,
    t.is_read,
    u.full_name AS other_user_name,
    u.avatar_url AS other_user_avatar,
    (m.status IN ('completed', 'archived', 'cancelled')) AS archived
  FROM thread_latest t
  JOIN public.matches m ON m.id = t.match_id
  JOIN public.users u ON u.id = CASE WHEN auth.uid() = t.player_id THEN m.organizer_id ELSE t.player_id END
  WHERE t.rn = 1
  ORDER BY t.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_chat_threads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_chat_threads() TO authenticated;
