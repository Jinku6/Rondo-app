-- Harden push notification database permissions.

BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.push_tokens,
     public.push_notification_log,
     public.user_location_preferences
  FROM anon, authenticated;

REVOKE USAGE ON SCHEMA private FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION private.push_webhook_handler()
  FROM anon, authenticated, PUBLIC;

COMMIT;
