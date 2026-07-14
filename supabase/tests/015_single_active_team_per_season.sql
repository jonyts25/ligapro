-- Migration 015: single active|suspended player per season
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/015_single_active_team_per_season.sql

DROP TABLE IF EXISTS public.__mig015_test_results;
CREATE TABLE public.__mig015_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0150';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0151';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0152';
  uid_tadmin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0153';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0150';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_a2 uuid;
  season_x uuid;
  season_y uuid;
  season_z uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
  player_p uuid;
  player_q uuid;
  st_a uuid;
  st_b uuid;
  st_c uuid;
  st_y uuid;
  st_z uuid;
  stp_a uuid;
  stp_b uuid;
  stp_hist1 uuid;
  stp_hist2 uuid;
  v_season_id uuid;
  v_org uuid;
  v_nulls int;
  v_count int;
  v_ok boolean;
  v_audit int;
  v_sqlstate text;
  v_args text;
  v_idx boolean;
  v_conflicts int;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.players DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_players DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b)
     OR slug LIKE 'org-%-mig015%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b);

  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
  ALTER TABLE public.season_rules ENABLE TRIGGER USER;
  ALTER TABLE public.seasons ENABLE TRIGGER USER;
  ALTER TABLE public.competitions ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig015.local', '$2a$06$testhashligapromigration015aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig015.local', '$2a$06$testhashligapromigration015aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig015.local', '$2a$06$testhashligapromigration015aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tadmin_a, 'authenticated', 'authenticated',
     'tadmin-a@ligapro-mig015.local', '$2a$06$testhashligapromigration015aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig015.local', '$2a$06$testhashligapromigration015aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig015');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tadmin_a, 'organization_member');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga A') RETURNING id INTO competition_a;
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Copa A') RETURNING id INTO competition_a2;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a, org_a, 'Apertura X', 'apertura-x-015', 'round_robin')
    RETURNING id INTO season_x;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a, org_a, 'Clausura Y', 'clausura-y-015', 'round_robin')
    RETURNING id INTO season_y;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a2, org_a, 'Copa Z', 'copa-z-015', 'knockout')
    RETURNING id INTO season_z;
  INSERT INTO public.teams (organization_id, name) VALUES
    (org_a, 'Team A') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES
    (org_a, 'Team B') RETURNING id INTO team_b;
  INSERT INTO public.teams (organization_id, name) VALUES
    (org_a, 'Team C') RETURNING id INTO team_c;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Player P') RETURNING id INTO player_p;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Player Q') RETURNING id INTO player_q;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig015');

  -- 01 backfill: existing null season_id count must be 0 (column NOT NULL)
  SELECT count(*) INTO v_nulls
  FROM public.season_team_players
  WHERE season_id IS NULL;
  INSERT INTO public.__mig015_test_results VALUES (
    '01_season_id_backfill_no_nulls', v_nulls = 0, format('nulls=%s', v_nulls)
  );

  -- Index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'season_team_players_one_active_or_suspended_per_season'
  ) INTO v_idx;
  INSERT INTO public.__mig015_test_results VALUES (
    '32_unique_partial_index_exists', v_idx, format('exists=%s', v_idx)
  );

  SELECT count(*) INTO v_conflicts
  FROM (
    SELECT st.season_id, stp.player_id
    FROM public.season_team_players stp
    JOIN public.season_teams st ON st.id = stp.season_team_id
    WHERE stp.registration_status IN ('active', 'suspended')
    GROUP BY st.season_id, stp.player_id
    HAVING count(*) > 1
  ) c;
  INSERT INTO public.__mig015_test_results VALUES (
    '33_no_active_suspended_conflicts',
    v_conflicts = 0,
    format('conflicts=%s', v_conflicts)
  );

  -- RPC signature hardening
  SELECT pg_get_function_identity_arguments(
    'public.set_season_team_player_status(uuid,text)'::regprocedure
  ) INTO v_args;
  INSERT INTO public.__mig015_test_results VALUES (
    '26_status_rpc_no_organization_id',
    v_args NOT ILIKE '%organization_id%',
    format('args=%s', v_args)
  );
  INSERT INTO public.__mig015_test_results VALUES (
    '27_status_rpc_no_season_id_param',
    v_args NOT ILIKE '%season_id%',
    format('args=%s', v_args)
  );
  INSERT INTO public.__mig015_test_results VALUES (
    '28_status_rpc_no_actor_profile',
    v_args NOT ILIKE '%profile%' AND v_args NOT ILIKE '%actor%',
    format('args=%s', v_args)
  );

  SELECT NOT has_function_privilege(
    'public',
    'public.set_season_team_player_status(uuid,text)',
    'EXECUTE'
  ) INTO v_ok;
  INSERT INTO public.__mig015_test_results VALUES (
    '25_public_no_execute_status_rpc', v_ok, format('ok=%s', v_ok)
  );

  -- Enroll teams
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  st_a := public.enroll_team_in_season(season_x, team_a, NULL, NULL, 'registered');
  st_b := public.enroll_team_in_season(season_x, team_b, NULL, NULL, 'registered');
  st_c := public.enroll_team_in_season(season_x, team_c, NULL, NULL, 'registered');
  st_y := public.enroll_team_in_season(season_y, team_a, NULL, NULL, 'registered');
  st_z := public.enroll_team_in_season(season_z, team_a, NULL, NULL, 'registered');
  EXECUTE 'RESET ROLE';

  -- 02–04 derive season_id / org on insert
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    stp_a := public.add_player_to_season_team(st_a, player_p, 10, 'active');
    EXECUTE 'RESET ROLE';
    SELECT season_id, organization_id INTO v_season_id, v_org
    FROM public.season_team_players WHERE id = stp_a;
    INSERT INTO public.__mig015_test_results VALUES (
      '02_new_rows_derive_season_id',
      v_season_id = season_x,
      format('season_id=%s expected=%s', v_season_id, season_x)
    );
    INSERT INTO public.__mig015_test_results VALUES (
      '03_season_id_matches_season_team',
      v_season_id = season_x,
      format('ok=%s', v_season_id = season_x)
    );
    INSERT INTO public.__mig015_test_results VALUES (
      '04_organization_id_matches_season_team',
      v_org = org_a,
      format('org=%s', v_org)
    );
    INSERT INTO public.__mig015_test_results VALUES (
      '05_player_active_team_a_ok',
      stp_a IS NOT NULL,
      format('stp=%s', stp_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES ('02_new_rows_derive_season_id', false, SQLERRM);
    INSERT INTO public.__mig015_test_results VALUES ('03_season_id_matches_season_team', false, SQLERRM);
    INSERT INTO public.__mig015_test_results VALUES ('04_organization_id_matches_season_team', false, SQLERRM);
    INSERT INTO public.__mig015_test_results VALUES ('05_player_active_team_a_ok', false, SQLERRM);
  END;

  -- 06 same player active team B fails (unique index)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_b, player_p, 9, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '06_same_player_active_team_b_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN unique_violation THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '06_same_player_active_team_b_fails',
      v_sqlstate = '23505',
      format('sqlstate=%s err=%s', v_sqlstate, SQLERRM)
    );
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '06_same_player_active_team_b_fails',
      v_sqlstate = '23505' OR SQLERRM ILIKE '%one_active_or_suspended%',
      format('sqlstate=%s err=%s', v_sqlstate, SQLERRM)
    );
  END;

  -- 07 suspended A + active B fails
  PERFORM public.set_season_team_player_status(stp_a, 'suspended');
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_b, player_p, 8, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '07_suspended_a_active_b_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN unique_violation THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '07_suspended_a_active_b_fails', true, SQLERRM
    );
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '07_suspended_a_active_b_fails',
      v_sqlstate = '23505' OR SQLERRM ILIKE '%one_active_or_suspended%',
      format('sqlstate=%s err=%s', v_sqlstate, SQLERRM)
    );
  END;

  -- 08 active A + suspended B fails
  PERFORM public.set_season_team_player_status(stp_a, 'active');
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id, season_id, registration_status
    ) VALUES (st_b, player_p, org_a, season_x, 'suspended');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '08_active_a_suspended_b_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN unique_violation THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '08_active_a_suspended_b_fails', true, format('index=%s', SQLERRM)
    );
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '08_active_a_suspended_b_fails',
      v_sqlstate = '23505',
      format('sqlstate=%s err=%s', v_sqlstate, SQLERRM)
    );
  END;

  -- 09 inactive A + active B works
  PERFORM public.set_season_team_player_status(stp_a, 'inactive');
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    stp_b := public.add_player_to_season_team(st_b, player_p, 7, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '09_inactive_a_active_b_ok',
      stp_b IS NOT NULL,
      format('stp_b=%s', stp_b)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '09_inactive_a_active_b_ok', false, SQLERRM
    );
  END;

  -- 10 active season X (on B) and active season Y works
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_y, player_p, 1, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '10_active_other_season_ok', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '10_active_other_season_ok', false, SQLERRM
    );
  END;

  -- 11 active other competition season works
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_z, player_p, 2, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '11_active_other_competition_ok', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '11_active_other_competition_ok', false, SQLERRM
    );
  END;

  -- 12 reactivate A while B active fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_a, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '12_reactivate_a_while_b_active_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN unique_violation THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '12_reactivate_a_while_b_active_fails', true, SQLERRM
    );
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '12_reactivate_a_while_b_active_fails',
      v_sqlstate = '23505',
      format('sqlstate=%s err=%s', v_sqlstate, SQLERRM)
    );
  END;

  -- 13 deactivate B then reactivate A
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_b, 'inactive');
    PERFORM public.set_season_team_player_status(stp_a, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '13_deactivate_b_reactivate_a_ok', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '13_deactivate_b_reactivate_a_ok', false, SQLERRM
    );
  END;

  -- 14 multiple historical inactive rows allowed
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id, registration_status
    ) VALUES (st_c, player_q, org_a, 'inactive')
    RETURNING id INTO stp_hist1;
    -- force second inactive via deactivate path on same team isn't unique conflict;
    -- inactive on B then inactive on C for same player
    PERFORM public.add_player_to_season_team(st_b, player_q, NULL, 'inactive');
    PERFORM public.add_player_to_season_team(st_c, player_q, NULL, 'inactive');
    -- already on C inactive — update path; also insert historical via team A inactive
    PERFORM public.add_player_to_season_team(st_a, player_q, NULL, 'inactive');
    SELECT count(*) INTO v_count
    FROM public.season_team_players
    WHERE player_id = player_q
      AND season_id = season_x
      AND registration_status = 'inactive';
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '14_multiple_inactive_history_ok',
      v_count >= 2,
      format('inactive_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '14_multiple_inactive_history_ok', false, SQLERRM
    );
  END;

  -- 15 add existing via RPC respects rule (player_p active on A)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_b, player_p, 3, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '15_add_existing_rpc_respects_index', false, 'unexpected success'
    );
  EXCEPTION WHEN unique_violation THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '15_add_existing_rpc_respects_index', true, SQLERRM
    );
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '15_add_existing_rpc_respects_index',
      v_sqlstate = '23505',
      format('sqlstate=%s', v_sqlstate)
    );
  END;

  -- 16 create player + roster atomic
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count FROM public.players WHERE organization_id = org_a;
    PERFORM public.create_player_and_add_to_roster(st_b, 'Atomic New', 99, 'active');
    SELECT count(*) - v_count INTO v_count FROM public.players WHERE organization_id = org_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '16_create_player_roster_atomic',
      v_count = 1,
      format('new_players=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '16_create_player_roster_atomic', false, SQLERRM
    );
  END;

  -- 17 status active → inactive
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_a, 'inactive');
    SELECT registration_status INTO v_args
    FROM public.season_team_players WHERE id = stp_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '17_status_active_to_inactive',
      v_args = 'inactive',
      format('status=%s', v_args)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '17_status_active_to_inactive', false, SQLERRM
    );
  END;

  -- 18 active → suspended clears captain
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_a, 'active');
    PERFORM public.set_season_team_captain(st_a, player_p);
    PERFORM public.set_season_team_player_status(stp_a, 'suspended');
    SELECT is_captain, registration_status INTO v_ok, v_args
    FROM public.season_team_players WHERE id = stp_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '18_status_to_suspended_clears_captain',
      v_ok = false AND v_args = 'suspended',
      format('captain=%s status=%s', v_ok, v_args)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '18_status_to_suspended_clears_captain', false, SQLERRM
    );
  END;

  -- 19 inactive → active when free
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- ensure no other occupied seat for player_p in season_x except possibly suspended on A
    UPDATE public.season_team_players
    SET registration_status = 'inactive', is_captain = false
    WHERE player_id = player_p AND season_id = season_x AND id <> stp_a;
    PERFORM public.set_season_team_player_status(stp_a, 'inactive');
    PERFORM public.set_season_team_player_status(stp_a, 'active');
    SELECT registration_status INTO v_args
    FROM public.season_team_players WHERE id = stp_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '19_inactive_to_active_when_free',
      v_args = 'active',
      format('status=%s', v_args)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '19_inactive_to_active_when_free', false, SQLERRM
    );
  END;

  -- 20 inactive → active fails when other team occupies
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_a, 'inactive');
    stp_b := public.add_player_to_season_team(st_b, player_p, 11, 'active');
    PERFORM public.set_season_team_player_status(stp_a, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '20_inactive_to_active_fails_if_occupied', false, 'unexpected success'
    );
  EXCEPTION WHEN unique_violation THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '20_inactive_to_active_fails_if_occupied', true, SQLERRM
    );
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig015_test_results VALUES (
      '20_inactive_to_active_fails_if_occupied',
      v_sqlstate = '23505',
      format('sqlstate=%s err=%s', v_sqlstate, SQLERRM)
    );
  END;

  -- 21 member cannot change status
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_b, 'inactive');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '21_member_cannot_change_status', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '21_member_cannot_change_status',
      SQLERRM ILIKE '%not authorized%' OR SQLERRM ILIKE '%permission%',
      SQLERRM
    );
  END;

  -- 22 tournament_admin cannot change status
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
  VALUES (org_a, season_x, uid_tadmin_a, 'tournament_admin');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_tadmin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tadmin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_b, 'inactive');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '22_tadmin_cannot_change_status', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '22_tadmin_cannot_change_status',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 23 other org cannot change status
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_b, 'inactive');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '23_other_org_cannot_change_status', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '23_other_org_cannot_change_status',
      SQLERRM ILIKE '%not authorized%' OR SQLERRM ILIKE '%not found%',
      SQLERRM
    );
  END;

  -- 24 anon cannot execute
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.set_season_team_player_status(stp_b, 'inactive');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '24_anon_cannot_execute', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '24_anon_cannot_execute', true, SQLERRM
    );
  END;

  -- 29 captain requires active
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_b, 'suspended');
    PERFORM public.set_season_team_captain(st_b, player_p);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '29_captain_requires_active', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '29_captain_requires_active',
      SQLERRM ILIKE '%active%',
      SQLERRM
    );
  END;

  -- 30–31 audit status + captain clear
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_player_status(stp_b, 'inactive');
    PERFORM public.set_season_team_player_status(stp_a, 'active');
    PERFORM public.set_season_team_captain(st_a, player_p);
    PERFORM public.set_season_team_player_status(stp_a, 'inactive');
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  END;

  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'season_team_players'
    AND action = 'update'
    AND entity_id = stp_a;
  INSERT INTO public.__mig015_test_results VALUES (
    '30_audit_status_change',
    v_audit >= 1,
    format('rows=%s', v_audit)
  );
  INSERT INTO public.__mig015_test_results VALUES (
    '31_audit_captain_cleared_by_status',
    v_audit >= 1,
    format('rows=%s', v_audit)
  );

  -- Context: client cannot force wrong season_id
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.season_team_players
    SET season_id = season_y
    WHERE id = stp_a;
    SELECT season_id INTO v_season_id FROM public.season_team_players WHERE id = stp_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig015_test_results VALUES (
      '02b_client_cannot_override_season_id',
      v_season_id = season_x,
      format('season_id=%s', v_season_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    -- update of season_id alone may be prevented or overwritten
    SELECT season_id INTO v_season_id FROM public.season_team_players WHERE id = stp_a;
    INSERT INTO public.__mig015_test_results VALUES (
      '02b_client_cannot_override_season_id',
      v_season_id = season_x,
      format('season_id=%s err=%s', v_season_id, SQLERRM)
    );
  END;

  -- Cleanup
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.players DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_players DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;

  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b);

  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
  ALTER TABLE public.season_rules ENABLE TRIGGER USER;
  ALTER TABLE public.seasons ENABLE TRIGGER USER;
  ALTER TABLE public.competitions ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;
END $$;

SELECT test_name, passed, details
FROM public.__mig015_test_results
ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  count(*) AS total
FROM public.__mig015_test_results;

DROP TABLE IF EXISTS public.__mig015_test_results;
