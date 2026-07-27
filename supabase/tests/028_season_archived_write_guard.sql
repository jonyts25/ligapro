-- Migration 028: archived season write guard isolation tests
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/028_season_archived_write_guard.sql

DROP TABLE IF EXISTS public.__mig028_test_results;
CREATE TABLE public.__mig028_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig028_as(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0280';
  org_a uuid;
  competition_a uuid;
  season_active uuid;
  season_archived uuid;
  team1 uuid;
  team2 uuid;
  st1 uuid;
  st2 uuid;
  v_err text;
  v_count int;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;

  DELETE FROM public.organizations
  WHERE created_by = uid_owner
     OR name = 'Org Mig028';
  DELETE FROM auth.users WHERE id = uid_owner;

  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid_owner,
    'authenticated',
    'authenticated',
    'owner028@test.local',
    crypt('password', gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  PERFORM public.__mig028_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Mig028');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Torneo 028')
  RETURNING id INTO competition_a;

  season_active := public.create_season_with_rules(
    competition_a,
    'Activa',
    'activa-028',
    'round_robin',
    'private',
    NULL,
    NULL,
    3,
    1,
    0,
    true,
    90,
    0,
    5,
    1
  );

  season_archived := public.create_season_with_rules(
    competition_a,
    'Archivada',
    'archivada-028',
    'round_robin',
    'private',
    NULL,
    NULL,
    3,
    1,
    0,
    true,
    90,
    0,
    5,
    1
  );

  PERFORM set_config('app.platform_billing_status_rpc', 'true', true);
  UPDATE public.seasons
  SET platform_billing_status = 'pagado'
  WHERE id IN (season_active, season_archived);

  PERFORM public.update_season_with_rules(
    season_archived,
    'Archivada',
    'round_robin',
    'archived',
    NULL,
    NULL,
    3,
    1,
    0,
    true,
    90,
    0,
    5,
    1
  );

  INSERT INTO public.teams (organization_id, name)
  VALUES (org_a, 'T1 028')
  RETURNING id INTO team1;

  INSERT INTO public.teams (organization_id, name)
  VALUES (org_a, 'T2 028')
  RETURNING id INTO team2;

  st1 := public.enroll_team_in_season(season_active, team1);
  st2 := public.enroll_team_in_season(season_active, team2);

  -- 1) Fixture on archived season is rejected
  BEGIN
    PERFORM public.create_season_round_robin_fixture(
      season_archived,
      'single',
      jsonb_build_array(
        jsonb_build_object(
          'home_season_team_id', st1,
          'away_season_team_id', st2,
          'round_number', 1,
          'leg_number', 1,
          'sequence_in_round', 1
        )
      )
    );
    INSERT INTO public.__mig028_test_results VALUES (
      'archived_fixture_rejected', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      'archived_fixture_rejected',
      v_err LIKE '%archivada%',
      v_err
    );
  END;

  -- 2) Fixture on active season still works (minimal 2-team payload)
  BEGIN
    PERFORM public.create_season_round_robin_fixture(
      season_active,
      'single',
      jsonb_build_array(
        jsonb_build_object(
          'home_season_team_id', st1,
          'away_season_team_id', st2,
          'round_number', 1,
          'leg_number', 1,
          'sequence_in_round', 1
        )
      )
    );
    SELECT COUNT(*) INTO v_count FROM public.matches WHERE season_id = season_active;
    INSERT INTO public.__mig028_test_results VALUES (
      'active_fixture_ok',
      v_count = 1,
      'matches=' || v_count
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      'active_fixture_ok', false, v_err
    );
  END;

  -- 3) Read standings on archived season still works
  SELECT COUNT(*) INTO v_count
  FROM public.get_season_standings(season_archived);
  INSERT INTO public.__mig028_test_results VALUES (
    'archived_read_standings_ok',
    v_count >= 0,
    'rows=' || v_count
  );

  -- 4) Reactivate archived season via update_season_with_rules
  BEGIN
    PERFORM public.update_season_with_rules(
      season_archived,
      'Archivada',
      'round_robin',
      'private',
      NULL,
      NULL,
      3,
      1,
      0,
      true,
      90,
      0,
      5,
      1
    );
    SELECT visibility INTO v_err FROM public.seasons WHERE id = season_archived;
    INSERT INTO public.__mig028_test_results VALUES (
      'reactivate_season_ok',
      v_err = 'private',
      'visibility=' || v_err
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      'reactivate_season_ok', false, v_err
    );
  END;

  -- 5) Staying archived blocks generic update
  PERFORM public.update_season_with_rules(
    season_archived,
    'Re-archivada',
    'round_robin',
    'archived',
    NULL,
    NULL,
    3,
    1,
    0,
    true,
    90,
    0,
    5,
    1
  );

  BEGIN
    PERFORM public.update_season_with_rules(
      season_archived,
      'Intento editar',
      'round_robin',
      'archived',
      NULL,
      NULL,
      3,
      1,
      0,
      true,
      90,
      0,
      5,
      1
    );
    INSERT INTO public.__mig028_test_results VALUES (
      'archived_update_blocked', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      'archived_update_blocked',
      v_err LIKE '%archivada%',
      v_err
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig028_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_fail int;
BEGIN
  SELECT COUNT(*) INTO v_fail
  FROM public.__mig028_test_results
  WHERE NOT passed;

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Migration 028 tests failed: % failing assertions', v_fail;
  END IF;
END;
$$;
