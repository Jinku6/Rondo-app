BEGIN;

CREATE OR REPLACE FUNCTION private.push_webhook_handler()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_secret text;
  v_url constant text := 'https://fbxixnlablcbavzpwivw.supabase.co/functions/v1/send-push';
  v_type text := TG_ARGV[0];
  v_payload jsonb;
BEGIN
  BEGIN
    SELECT ds.decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'send_push_webhook_secret';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push] Vault lookup failed (SQLSTATE %)', SQLSTATE;
    RETURN NULL;
  END;

  IF v_secret IS NULL OR length(v_secret) < 32 THEN
    RAISE WARNING '[push] Webhook secret is missing or invalid';
    RETURN NULL;
  END IF;

  v_payload := jsonb_build_object(
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
  );

  BEGIN
    PERFORM net.http_post(
      url := v_url || '?type=' || v_type,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := v_payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push] Webhook dispatch failed for event % (SQLSTATE %)', v_type, SQLSTATE;
  END;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.push_webhook_handler()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
