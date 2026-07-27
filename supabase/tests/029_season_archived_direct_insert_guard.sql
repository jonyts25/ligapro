-- Migration 030: direct INSERT guard on archived seasons (four tables)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/029_season_archived_direct_insert_guard.sql

DROP TABLE IF EXISTS public.__mig029_test_results;
CREATE TABLE public.__mig029_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig029_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0290';
  uid_ref uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0291';
  org_a uuid;
  competition_a uuid;
  season_active uuid;
  season_archived uuid;
  team1 uuid;
  team2 uuid;
  st_active uuid;
  st_active_away uuid;
  st_archived uuid;
  st_archived_away uuid;
  match_active uuid;
  match_archived uuid;
  v_err text;
  v_id uuid;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;

  DELETE FROM public.organizations WHERE created_by = uid_owner;
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_ref);

  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
  (
    '00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
    'owner029@test.local', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
    'ref029@test.local', crypt('password', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );

  PERFORM public.__mig029_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Mig029');

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_ref, 'organization_member');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Torneo 029')
  RETURNING id INTO competition_a;

  season_active := public.create_season_with_rules(
    competition_a, 'Activa', 'activa-029', 'round_robin', 'private',
    NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
  );

  season_archived := public.create_season_with_rules(
    competition_a, 'Archivada', 'archivada-029', 'round_robin', 'private',
    NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
  );

  PERFORM set_config('app.platform_billing_status_rpc', 'true', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado'
  WHERE id IN (season_active, season_archived);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'T1 029') RETURNING id INTO team1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'T2 029') RETURNING id INTO team2;

  st_active := public.enroll_team_in_season(season_active, team1);
  st_active_away := public.enroll_team_in_season(season_active, team2);
  st_archived := public.enroll_team_in_season(season_archived, team2);
  st_archived_away := public.enroll_team_in_season(season_archived, team1);

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (
    org_a, season_active, st_active, st_active_away, 'scheduled'
  ) RETURNING id INTO match_active;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (
    org_a, season_archived, st_archived, st_archived_away, 'scheduled'
  ) RETURNING id INTO match_archived;

  PERFORM public.update_season_with_rules(
    season_archived, 'Archivada', 'round_robin', 'archived',
    NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
  );

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- team_charges: archived rejected
  BEGIN
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_a, st_archived, 'registration', 100, uid_owner);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_charges_archived_rejected', false, 'expected exception'
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_charges_archived_rejected', v_err LIKE '%archivada%', v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- team_charges: active ok (cross-season isolation)
  BEGIN
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_a, st_active, 'registration', 50, uid_owner)
    RETURNING id INTO v_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_charges_active_ok', v_id IS NOT NULL, 'id=' || COALESCE(v_id::text, 'null')
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_charges_active_ok', false, v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- team_payments: archived rejected
  BEGIN
    INSERT INTO public.team_payments (
      organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
    ) VALUES (org_a, st_archived, 25, 'cash', uid_owner);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_payments_archived_rejected', false, 'expected exception'
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_payments_archived_rejected', v_err LIKE '%archivada%', v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- team_payments: active ok
  BEGIN
    INSERT INTO public.team_payments (
      organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
    ) VALUES (org_a, st_active, 10, 'cash', uid_owner)
    RETURNING id INTO v_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_payments_active_ok', v_id IS NOT NULL, 'id=' || COALESCE(v_id::text, 'null')
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'team_payments_active_ok', false, v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- season_roles: archived rejected
  BEGIN
    INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
    VALUES (org_a, season_archived, uid_ref, 'referee');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'season_roles_archived_rejected', false, 'expected exception'
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'season_roles_archived_rejected', v_err LIKE '%archivada%', v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- season_roles: active ok
  BEGIN
    INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
    VALUES (org_a, season_active, uid_ref, 'referee')
    RETURNING id INTO v_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'season_roles_active_ok', v_id IS NOT NULL, 'id=' || COALESCE(v_id::text, 'null')
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'season_roles_active_ok', false, v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- match_officials: archived rejected
  BEGIN
    INSERT INTO public.match_officials (
      organization_id, match_id, profile_id, role, status
    ) VALUES (org_a, match_archived, uid_ref, 'referee', 'assigned');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'match_officials_archived_rejected', false, 'expected exception'
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'match_officials_archived_rejected', v_err LIKE '%archivada%', v_err
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
  END;

  -- match_officials: active ok
  BEGIN
    INSERT INTO public.match_officials (
      organization_id, match_id, profile_id, role, status
    ) VALUES (org_a, match_active, uid_ref, 'referee', 'assigned')
    RETURNING id INTO v_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'match_officials_active_ok', v_id IS NOT NULL, 'id=' || COALESCE(v_id::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig029_test_results VALUES (
      'match_officials_active_ok', false, v_err
    );
  END;

  EXECUTE 'RESET ROLE';
END;
$$;

SELECT test_name, passed, details
FROM public.__mig029_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_fail int;
BEGIN
  SELECT COUNT(*) INTO v_fail FROM public.__mig029_test_results WHERE NOT passed;
  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Migration 029 direct-insert tests failed: % assertions', v_fail;
  END IF;
END;
$$;
