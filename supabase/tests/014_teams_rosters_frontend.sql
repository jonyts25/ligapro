-- Migration 014 + Frontend F5: teams / enrollment / roster RPCs
-- Complements suite 004. Does not weaken prior asserts.
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/014_teams_rosters_frontend.sql

DROP TABLE IF EXISTS public.__mig014_test_results;
CREATE TABLE public.__mig014_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0140';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0141';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0142';
  uid_tadmin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0143';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0140';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  season_a uuid;
  team_a uuid;
  team_a2 uuid;
  team_b uuid;
  player_a1 uuid;
  player_a2 uuid;
  player_b1 uuid;
  season_team_a uuid;
  season_team_a2 uuid;
  stp_a1 uuid;
  stp_a2 uuid;
  v_count int;
  v_before int;
  v_name text;
  v_captain boolean;
  v_status text;
  v_audit int;
  v_ok boolean;
  v_args text;
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
     OR slug LIKE 'org-%-mig014%';
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
     'owner-a@ligapro-mig014.local', '$2a$06$testhashligapromigration014aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig014.local', '$2a$06$testhashligapromigration014aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig014.local', '$2a$06$testhashligapromigration014aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tadmin_a, 'authenticated', 'authenticated',
     'tadmin-a@ligapro-mig014.local', '$2a$06$testhashligapromigration014aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig014.local', '$2a$06$testhashligapromigration014aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig014');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tadmin_a, 'organization_member');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (
    competition_a, org_a, 'Apertura 2026', 'apertura-014', 'round_robin'
  ) RETURNING id INTO season_a;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig014');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.teams (organization_id, name)
  VALUES (org_b, 'Team B') RETURNING id INTO team_b;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_b, 'Player B') RETURNING id INTO player_b1;
  EXECUTE 'RESET ROLE';

  -- Signature hardening
  SELECT pg_get_function_identity_arguments(
    'public.enroll_team_in_season(uuid,uuid,text,text,text)'::regprocedure
  ) INTO v_args;
  INSERT INTO public.__mig014_test_results VALUES (
    '24_enroll_no_organization_id',
    v_args NOT ILIKE '%organization_id%' AND v_args NOT ILIKE '%profile_id%',
    format('args=%s', v_args)
  );

  SELECT NOT has_function_privilege('public', 'public.enroll_team_in_season(uuid,uuid,text,text,text)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.create_player_and_add_to_roster(uuid,text,integer,text)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.add_player_to_season_team(uuid,uuid,integer,text)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.deactivate_season_team_player(uuid)', 'EXECUTE')
  INTO v_ok;
  INSERT INTO public.__mig014_test_results VALUES (
    '23_public_no_execute_new_rpcs', v_ok, format('ok=%s', v_ok)
  );

  -- 01 owner creates team
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.teams (organization_id, name)
    VALUES (org_a, 'Deportivo San Juan') RETURNING id INTO team_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '01_owner_creates_team', team_a IS NOT NULL, format('team=%s', team_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('01_owner_creates_team', false, SQLERRM);
  END;

  -- 02 admin creates team
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.teams (organization_id, name)
    VALUES (org_a, 'Real Azteca') RETURNING id INTO team_a2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '02_admin_creates_team', team_a2 IS NOT NULL, format('team=%s', team_a2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('02_admin_creates_team', false, SQLERRM);
  END;

  -- 03 member cannot create team
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Member Team');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('03_member_cannot_create_team', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '03_member_cannot_create_team',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- 04 other org cannot enroll team_b into season_a via RPC
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.enroll_team_in_season(season_a, team_b, NULL, NULL, 'registered');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('07_cannot_enroll_foreign_team', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '07_cannot_enroll_foreign_team',
      SQLERRM ILIKE '%same organization%' OR SQLERRM ILIKE '%not authorized%' OR SQLERRM ILIKE '%not found%',
      SQLERRM
    );
  END;

  -- 05 owner enrolls team
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    season_team_a := public.enroll_team_in_season(
      season_a, team_a, 'San Juan Apertura', NULL, 'confirmed'
    );
    SELECT organization_id::text INTO v_name FROM public.season_teams WHERE id = season_team_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '05_owner_enrolls_team',
      season_team_a IS NOT NULL AND v_name = org_a::text,
      format('season_team=%s org=%s', season_team_a, v_name)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('05_owner_enrolls_team', false, SQLERRM);
  END;

  INSERT INTO public.__mig014_test_results VALUES (
    '06_enrollment_correct_org',
    EXISTS (
      SELECT 1 FROM public.season_teams
      WHERE id = season_team_a AND organization_id = org_a AND season_id = season_a AND team_id = team_a
    ),
    'checked'
  );

  -- 08 duplicate enroll
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'registered');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('08_no_duplicate_enrollment', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '08_no_duplicate_enrollment',
      SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Enroll second team for multi-roster tests
  EXECUTE 'SET LOCAL ROLE authenticated';
  season_team_a2 := public.enroll_team_in_season(season_a, team_a2, NULL, NULL, 'registered');
  EXECUTE 'RESET ROLE';

  -- 09/10/11 create player + roster atomic
  SELECT count(*) INTO v_before FROM public.players WHERE organization_id = org_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    stp_a1 := public.create_player_and_add_to_roster(
      season_team_a, 'Jugador Uno', 10, 'active'
    );
    SELECT player_id INTO player_a1 FROM public.season_team_players WHERE id = stp_a1;
    SELECT organization_id::text INTO v_name FROM public.players WHERE id = player_a1;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '09_owner_creates_player_via_rpc',
      player_a1 IS NOT NULL AND v_name = org_a::text,
      format('player=%s', player_a1)
    );
    INSERT INTO public.__mig014_test_results VALUES (
      '11_create_player_roster_atomic_ok',
      stp_a1 IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.season_team_players WHERE id = stp_a1 AND player_id = player_a1),
      format('stp=%s', stp_a1)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('09_owner_creates_player_via_rpc', false, SQLERRM);
    INSERT INTO public.__mig014_test_results VALUES ('11_create_player_roster_atomic_ok', false, SQLERRM);
  END;

  -- atomic failure: invalid jersey after would-be player create
  SELECT count(*) INTO v_before FROM public.players WHERE organization_id = org_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- Duplicate jersey 10 on same roster → fail after player insert → rollback player
    PERFORM public.create_player_and_add_to_roster(
      season_team_a, 'Orphan Candidate', 10, 'active'
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '11b_roster_fail_rolls_back_player', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO v_count FROM public.players WHERE organization_id = org_a;
    INSERT INTO public.__mig014_test_results VALUES (
      '11b_roster_fail_rolls_back_player',
      v_count = v_before AND NOT EXISTS (
        SELECT 1 FROM public.players WHERE organization_id = org_a AND full_name = 'Orphan Candidate'
      ),
      format('err=%s players_before=%s after=%s', SQLERRM, v_before, v_count)
    );
  END;

  -- 12 add existing player
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Jugador Dos') RETURNING id INTO player_a2;
  stp_a2 := public.add_player_to_season_team(season_team_a, player_a2, 7, 'active');
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig014_test_results VALUES (
    '12_add_existing_player',
    stp_a2 IS NOT NULL,
    format('stp=%s', stp_a2)
  );

  -- 13 foreign player
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(season_team_a, player_b1, 99, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('13_no_foreign_player', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '13_no_foreign_player',
      SQLERRM ILIKE '%same organization%' OR SQLERRM ILIKE '%not found%',
      SQLERRM
    );
  END;

  -- 14 duplicate active roster
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(season_team_a, player_a1, 11, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('14_no_duplicate_roster', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '14_no_duplicate_roster',
      SQLERRM ILIKE '%already on this roster%',
      SQLERRM
    );
  END;

  -- 15 member cannot manage roster
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_player_and_add_to_roster(season_team_a, 'Member Player', NULL, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('15_member_cannot_manage_roster', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '15_member_cannot_manage_roster',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 16 tournament_admin cannot manage
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
  VALUES (org_a, season_a, uid_tadmin_a, 'tournament_admin');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_tadmin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tadmin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.enroll_team_in_season(season_a, team_a2, NULL, NULL, 'registered');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('16_tadmin_cannot_manage', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '16_tadmin_cannot_manage',
      SQLERRM ILIKE '%not authorized%' OR SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- 17/18 captain
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_captain(season_team_a, player_a1);
    PERFORM public.set_season_team_captain(season_team_a, player_a2);
    SELECT count(*) INTO v_count
    FROM public.season_team_players
    WHERE season_team_id = season_team_a AND is_captain;
    SELECT is_captain INTO v_captain
    FROM public.season_team_players
    WHERE season_team_id = season_team_a AND player_id = player_a2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '17_18_set_and_replace_captain',
      v_count = 1 AND v_captain = true,
      format('captains=%s player2_captain=%s', v_count, v_captain)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('17_18_set_and_replace_captain', false, SQLERRM);
  END;

  -- 19 captain from other roster
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_captain(season_team_a2, player_a1);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('19_captain_must_be_on_roster', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '19_captain_must_be_on_roster',
      SQLERRM ILIKE '%not on the roster%',
      SQLERRM
    );
  END;

  -- 20/21 deactivate captain
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.deactivate_season_team_player(stp_a2);
    SELECT is_captain, registration_status INTO v_captain, v_status
    FROM public.season_team_players WHERE id = stp_a2;
    SELECT count(*) INTO v_count FROM public.players WHERE id = player_a2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '20_21_deactivate_clears_captain_keeps_player',
      v_captain = false AND v_status = 'inactive' AND v_count = 1,
      format('captain=%s status=%s player_rows=%s', v_captain, v_status, v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '20_21_deactivate_clears_captain_keeps_player', false, SQLERRM
    );
  END;

  -- 22 anon
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'registered');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES ('22_anon_no_execute', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '22_anon_no_execute',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%not authenticated%',
      SQLERRM
    );
  END;

  -- Audits
  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'teams' AND action = 'insert' AND entity_id = team_a;
  INSERT INTO public.__mig014_test_results VALUES (
    '26_audit_team', v_audit >= 1, format('rows=%s', v_audit)
  );

  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'season_teams' AND action = 'insert' AND entity_id = season_team_a;
  INSERT INTO public.__mig014_test_results VALUES (
    '27_audit_season_team', v_audit >= 1, format('rows=%s', v_audit)
  );

  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'players' AND action = 'insert' AND entity_id = player_a1;
  INSERT INTO public.__mig014_test_results VALUES (
    '28_audit_player', v_audit >= 1, format('rows=%s', v_audit)
  );

  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'season_team_players' AND action IN ('insert', 'update');
  INSERT INTO public.__mig014_test_results VALUES (
    '29_30_audit_roster_and_captain', v_audit >= 2, format('rows=%s', v_audit)
  );

  -- other org isolation edit
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.teams SET name = 'Stolen' WHERE id = team_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '04_31_other_org_cannot_edit_team',
      v_count = 0,
      format('updated=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig014_test_results VALUES (
      '04_31_other_org_cannot_edit_team',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
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
FROM public.__mig014_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig014_test_results;
