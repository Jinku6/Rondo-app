-- PROPUESTA: no aplicar hasta recibir aprobacion explicita.
-- El calculo de cada partido se realiza siempre en Europe/Madrid dentro de
-- private.generate_team_match_recurrences(). El job solo decide cuando revisar.

BEGIN;

DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'generate-team-match-recurrences';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'generate-team-match-recurrences',
    '15 3 * * *',
    'SELECT private.generate_team_match_recurrences();'
  );
END;
$$;

COMMIT;
