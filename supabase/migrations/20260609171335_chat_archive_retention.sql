-- Keep completed/cancelled match chats in Archivados for 30 days, then delete them.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

DROP TRIGGER IF EXISTS on_match_ended ON public.matches;
DROP FUNCTION IF EXISTS public.delete_chats_on_match_end();

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
    AND (
      m.status IN ('open', 'full')
      OR (
        m.status = 'completed'
        AND COALESCE(m.completed_at, m.date_time + interval '2 hours') >= now() - interval '30 days'
      )
      OR (
        m.status IN ('archived', 'cancelled')
        AND m.date_time >= now() - interval '30 days'
      )
    )
  ORDER BY t.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_chat_threads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_chat_threads() TO authenticated;

CREATE OR REPLACE FUNCTION private.delete_expired_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  DELETE FROM public.chat_messages c
  USING public.matches m
  WHERE m.id = c.match_id
    AND (
      (
        m.status = 'completed'
        AND COALESCE(m.completed_at, m.date_time + interval '2 hours') < now() - interval '30 days'
      )
      OR (
        m.status IN ('archived', 'cancelled')
        AND m.date_time < now() - interval '30 days'
      )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.delete_expired_chat_messages() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-chat-messages') THEN
    PERFORM cron.schedule(
      'delete-expired-chat-messages',
      '25 3 * * *',
      'SELECT private.delete_expired_chat_messages();'
    );
  END IF;
END;
$$;

COMMIT;
