-- Ejecutar como postgres contra una base con la migracion de Fase 2 aplicada.
-- Estas pruebas no escriben datos persistentes.

BEGIN;

DO $$
DECLARE
  v_march timestamptz;
  v_october timestamptz;
  v_third_thursday timestamptz;
  v_last_thursday timestamptz;
  v_leap_last_tuesday date;
BEGIN
  v_march := private.next_team_recurrence_at(
    'weekly',
    0::smallint,
    null::smallint,
    time '21:00',
    timestamptz '2026-03-22 21:00:01 Europe/Madrid',
    'Europe/Madrid'
  );

  IF v_march <> timestamptz '2026-03-29 21:00:00 Europe/Madrid'
     OR v_march AT TIME ZONE 'Europe/Madrid' <> timestamp '2026-03-29 21:00:00'
  THEN
    RAISE EXCEPTION 'La recurrencia no conserva las 21:00 en el cambio de marzo: %', v_march;
  END IF;

  v_october := private.next_team_recurrence_at(
    'weekly',
    0::smallint,
    null::smallint,
    time '21:00',
    timestamptz '2026-10-18 21:00:01 Europe/Madrid',
    'Europe/Madrid'
  );

  IF v_october <> timestamptz '2026-10-25 21:00:00 Europe/Madrid'
     OR v_october AT TIME ZONE 'Europe/Madrid' <> timestamp '2026-10-25 21:00:00'
  THEN
    RAISE EXCEPTION 'La recurrencia no conserva las 21:00 en el cambio de octubre: %', v_october;
  END IF;

  v_third_thursday := private.next_team_recurrence_at(
    'monthly',
    4::smallint,
    3::smallint,
    time '21:00',
    timestamptz '2026-08-01 00:00:00 Europe/Madrid',
    'Europe/Madrid'
  );

  IF v_third_thursday <> timestamptz '2026-08-20 21:00:00 Europe/Madrid' THEN
    RAISE EXCEPTION 'El tercer jueves mensual es incorrecto: %', v_third_thursday;
  END IF;

  v_last_thursday := private.next_team_recurrence_at(
    'monthly',
    4::smallint,
    (-1)::smallint,
    time '21:00',
    timestamptz '2026-02-01 00:00:00 Europe/Madrid',
    'Europe/Madrid'
  );

  IF v_last_thursday <> timestamptz '2026-02-26 21:00:00 Europe/Madrid' THEN
    RAISE EXCEPTION 'El ultimo jueves mensual es incorrecto: %', v_last_thursday;
  END IF;

  v_leap_last_tuesday := private.monthly_recurrence_date(
    date '2028-02-01',
    2::smallint,
    (-1)::smallint
  );

  IF v_leap_last_tuesday <> date '2028-02-29' THEN
    RAISE EXCEPTION 'El calculo de febrero bisiesto es incorrecto: %', v_leap_last_tuesday;
  END IF;
END;
$$;

DO $$
BEGIN
  IF has_function_privilege(
    'authenticated',
    'private.generate_team_match_recurrences(timestamptz)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated no debe ejecutar el generador interno.';
  END IF;

  IF has_function_privilege(
    'service_role',
    'private.generate_team_match_recurrences(timestamptz)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role no debe ejecutar el generador interno.';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.cancel_team_match_recurrence(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated debe poder invocar la anulacion protegida.';
  END IF;
END;
$$;

ROLLBACK;
