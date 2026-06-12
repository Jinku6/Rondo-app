-- Schedule review reminder pushes using the existing scheduled-pushes cron
-- configuration as the source for URL headers and shared cron secret.

BEGIN;

DO $$
DECLARE
  base_command text;
  review_command text;
  existing_job_id int;
BEGIN
  SELECT command
  INTO base_command
  FROM cron.job
  WHERE jobname = 'push-match-reminders'
  LIMIT 1;

  IF base_command IS NULL THEN
    RAISE EXCEPTION 'push-match-reminders cron job is required before scheduling review reminders';
  END IF;

  review_command := replace(base_command, 'type=match_reminders', 'type=review_reminders');

  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'push-review-reminders'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'push-review-reminders',
    '0 * * * *',
    review_command
  );
END;
$$;

COMMIT;
