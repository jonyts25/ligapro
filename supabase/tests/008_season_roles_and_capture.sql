-- Tests for Migration 008 (season_roles and capture permissions)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/008_season_roles_and_capture.sql

DROP TABLE IF EXISTS public.__mig008_test_results;
CREATE TABLE public.__mig008_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa71';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa72';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa73';
  uid_tourn_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa74';
  uid_tourn_b uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa75';
  uid_referee uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa76';
  uid_delegate uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa77';
  uid_official_only uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa78';
  uid_nomember uuid := 'cccccccc-cccc-cccc-cccc-cccccccccc71';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb71';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_a2 uuid;
  competition_b uuid;
  season_a uuid;
  season_a2 uuid;
  season_b uuid;
  team_h uuid;
  team_a uuid;
  team_h2 uuid;
  team_a2 uuid;
  team_b1 uuid;
  team_b2 uuid;
  st_h uuid;
  st_a uuid;
  st_h2 uuid;
  st_a2 uuid;
  st_b1 uuid;
  st_b2 uuid;
  player_p uuid;
  stp_p uuid;
  match_a1 uuid;
  match_a2 uuid;
  match_a3 uuid;
  match_a2_season uuid;
  match_b uuid;
  event_id uuid;
  susp_id uuid;
  v_count int;
  v_status text;
  v_home int;
  v_away int;
  v_season uuid;
  v_org uuid;
  v_home_st uuid;
  v_away_st uuid;
  v_res uuid;
  v_round text;
  v_roles_before int;
  v_roles_after int;
  v_fn_ok boolean;
  event_id2 uuid;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (
    uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_tourn_b,
    uid_referee, uid_delegate, uid_official_only, uid_owner_b
  )
     OR slug IN ('org-a-mig008', 'org-b-mig008');

  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_tourn_b,
    uid_referee, uid_delegate, uid_official_only, uid_nomember, uid_owner_b
  );

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tourn_a, 'authenticated', 'authenticated',
     'tourn-a@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tourn_b, 'authenticated', 'authenticated',
     'tourn-b@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_referee, 'authenticated', 'authenticated',
     'referee@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_delegate, 'authenticated', 'authenticated',
     'delegate@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_official_only, 'authenticated', 'authenticated',
     'official-only@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_nomember, 'authenticated', 'authenticated',
     'nomember@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig008.local', '$2a$06$testhashligapromigration008aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig008', 'org-a-mig008')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tourn_a, 'organization_member'),
    (org_a, uid_tourn_b, 'organization_member'),
    (org_a, uid_referee, 'organization_member'),
    (org_a, uid_delegate, 'organization_member'),
    (org_a, uid_official_only, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B seed season_role
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig008', 'org-b-mig008')).id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Season B', 'season-b', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.season_roles (
    organization_id, season_id, profile_id, role
  ) VALUES (org_b, season_b, uid_owner_b, 'tournament_admin');
  EXECUTE 'RESET ROLE';

  -- Test 1 isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_roles WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig008_test_results VALUES (
    '1_user_a_cannot_read_org_b_season_roles',
    v_count = 0,
    format('season_roles_visible=%s', v_count)
  );

  -- Admin setup org A
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a, org_a, 'Season A', 'season-a', 'round_robin')
  RETURNING id INTO season_a;
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A2') RETURNING id INTO competition_a2;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a2, org_a, 'Season A2', 'season-a2', 'round_robin')
  RETURNING id INTO season_a2;

  UPDATE public.season_rules
  SET yellow_card_limit = 1, suspension_matches = 2
  WHERE season_id = season_a;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home2') RETURNING id INTO team_h2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away2') RETURNING id INTO team_a2;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Player P') RETURNING id INTO player_p;

  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_h, org_a) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_a, org_a) RETURNING id INTO st_a;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a2, team_h2, org_a) RETURNING id INTO st_h2;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a2, team_a2, org_a) RETURNING id INTO st_a2;

  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_h, player_p, org_a, 9) RETURNING id INTO stp_p;

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_label
  ) VALUES (season_a, org_a, st_h, st_a, 'scheduled', 'Jornada 1')
  RETURNING id INTO match_a1;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_label
  ) VALUES (season_a, org_a, st_h, st_a, 'scheduled', 'Jornada 2')
  RETURNING id INTO match_a2;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_label
  ) VALUES (season_a, org_a, st_h, st_a, 'scheduled', 'Jornada 3')
  RETURNING id INTO match_a3;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_label
  ) VALUES (season_a2, org_a, st_h2, st_a2, 'scheduled', 'Jornada 1')
  RETURNING id INTO match_a2_season;

  INSERT INTO public.match_officials (
    match_id, organization_id, profile_id, role, status
  ) VALUES (match_a1, org_a, uid_referee, 'referee', 'confirmed');
  INSERT INTO public.match_officials (
    match_id, organization_id, profile_id, role, status
  ) VALUES (match_a1, org_a, uid_delegate, 'delegate', 'confirmed');
  INSERT INTO public.match_officials (
    match_id, organization_id, profile_id, role, status
  ) VALUES (match_a2, org_a, uid_referee, 'referee', 'assigned');
  INSERT INTO public.match_officials (
    match_id, organization_id, profile_id, role, status
  ) VALUES (match_a1, org_a, uid_official_only, 'referee', 'confirmed');
  EXECUTE 'RESET ROLE';

  -- Test 2 member cannot create season_role
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a, uid_member_a, 'tournament_admin');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '2_member_cannot_create_season_role', false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '2_member_cannot_create_season_role',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Admin JWT for role assignments
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );

  -- Test 3 admin assigns tournament_admin
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a, uid_tourn_a, 'tournament_admin')
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '3_admin_assigns_tournament_admin',
      event_id IS NOT NULL,
      format('season_role_id=%s', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '3_admin_assigns_tournament_admin', false, SQLERRM
    );
  END;

  -- Test 4 admin assigns referee
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a, uid_referee, 'referee')
    RETURNING id INTO event_id;
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a, uid_delegate, 'delegate')
    RETURNING id INTO susp_id;
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a2, uid_tourn_b, 'tournament_admin');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '4_admin_assigns_referee',
      event_id IS NOT NULL AND susp_id IS NOT NULL,
      format('referee_role_id=%s delegate_role_id=%s', event_id, susp_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '4_admin_assigns_referee', false, SQLERRM
    );
  END;

  -- Test 5 org mismatch vs season
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_b, season_a, uid_admin_a, 'tournament_admin');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '5_season_role_org_must_match_season', false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '5_season_role_org_must_match_season',
      SQLERRM ILIKE '%must match seasons.organization_id%',
      SQLERRM
    );
  END;

  -- Test 6 non-member profile cannot receive season_role
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a, uid_nomember, 'referee');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '6_non_member_cannot_receive_season_role', false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '6_non_member_cannot_receive_season_role',
      SQLERRM ILIKE '%must be an organization_members row%',
      SQLERRM
    );
  END;

  -- Test 7 duplicate season/profile/role
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_roles (
      organization_id, season_id, profile_id, role
    ) VALUES (org_a, season_a, uid_tourn_a, 'tournament_admin');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '7_duplicate_season_profile_role_fails', false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '7_duplicate_season_profile_role_fails',
      SQLERRM ILIKE '%season_roles_season_profile_role_unique%'
        OR SQLERRM ILIKE '%unique%',
      SQLERRM
    );
  END;

  -- Test 8 referee season_role but no match_official on this match (match_a3)
  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a3, org_a, stp_p, 'goal', 10);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '8_referee_without_confirmed_assignment_cannot_insert',
      false,
      format('unexpected success on unassigned match inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '8_referee_without_confirmed_assignment_cannot_insert',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 9 confirmed match_official but no season_role
  PERFORM set_config('request.jwt.claim.sub', uid_official_only::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_official_only::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'goal', 11);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '9_confirmed_official_without_season_role_cannot_insert',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '9_confirmed_official_without_season_role_cannot_insert',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 10 referee season_role + assigned (not confirmed) on match_a2
  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a2, org_a, stp_p, 'goal', 12);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '10_referee_assigned_not_confirmed_cannot_insert',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '10_referee_assigned_not_confirmed_cannot_insert',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 11 referee confirmed on match_a1 can insert
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'goal', 15)
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '11_referee_confirmed_can_insert_on_assigned_match',
      event_id IS NOT NULL,
      format('event_id=%s match_id=%s', event_id, match_a1)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '11_referee_confirmed_can_insert_on_assigned_match', false, SQLERRM
    );
  END;

  -- Test 12 same referee cannot insert on match_a2 (not confirmed there)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a2, org_a, stp_p, 'goal', 16);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '12_referee_cannot_insert_on_other_match_same_season',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '12_referee_cannot_insert_on_other_match_same_season',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 13 delegate confirmed on match_a1
  PERFORM set_config('request.jwt.claim.sub', uid_delegate::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_delegate::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'yellow_card', 20)
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '13_delegate_confirmed_can_insert_on_assigned_match',
      event_id IS NOT NULL,
      format('event_id=%s', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '13_delegate_confirmed_can_insert_on_assigned_match', false, SQLERRM
    );
  END;

  -- Test 14 tournament_admin any match in season without match_official
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a2, org_a, stp_p, 'injury', 25)
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '14_tournament_admin_can_insert_any_match_in_season',
      event_id IS NOT NULL,
      format('event_id=%s on match_a2 without official assignment', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '14_tournament_admin_can_insert_any_match_in_season', false, SQLERRM
    );
  END;

  -- Test 15 tournament_admin of season_a2 cannot insert on season_a match
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'goal', 30);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '15_tournament_admin_wrong_season_cannot_insert',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '15_tournament_admin_wrong_season_cannot_insert',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 16 tournament_admin can update_match_result
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_match_result(match_a1, 'finished', 2, 1);
    SELECT status, home_score, away_score
    INTO v_status, v_home, v_away
    FROM public.matches WHERE id = match_a1;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '16_tournament_admin_can_update_match_result',
      v_status = 'finished' AND v_home = 2 AND v_away = 1,
      format('status=%s home=%s away=%s', v_status, v_home, v_away)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '16_tournament_admin_can_update_match_result', false, SQLERRM
    );
  END;

  -- Test 17 tournament_admin wrong season cannot RPC
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_match_result(match_a1, 'finished', 9, 9);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '17_tournament_admin_wrong_season_cannot_update_result',
      false,
      'unexpected RPC success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '17_tournament_admin_wrong_season_cannot_update_result',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- Test 18 referee cannot update_match_result
  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_match_result(match_a1, 'in_progress', 0, 0);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '18_referee_cannot_update_match_result',
      false,
      'unexpected RPC success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '18_referee_cannot_update_match_result',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- Test 19 RPC only changes score/status; preserves season/teams/org/reservation/round
  SELECT season_id, organization_id, home_season_team_id, away_season_team_id,
         field_reservation_id, round_label
  INTO v_season, v_org, v_home_st, v_away_st, v_res, v_round
  FROM public.matches WHERE id = match_a1;

  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_match_result(match_a1, 'finished', 3, 2);
    SELECT count(*) INTO v_count
    FROM public.matches m
    WHERE m.id = match_a1
      AND m.season_id = v_season
      AND m.organization_id = v_org
      AND m.home_season_team_id = v_home_st
      AND m.away_season_team_id = v_away_st
      AND m.field_reservation_id IS NOT DISTINCT FROM v_res
      AND m.round_label = v_round
      AND m.status = 'finished'
      AND m.home_score = 3
      AND m.away_score = 2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '19_update_match_result_only_score_status',
      v_count = 1,
      format(
        'preserved season=%s org=%s home_st=%s away_st=%s reservation=%s round=%s',
        v_season, v_org, v_home_st, v_away_st, v_res, v_round
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '19_update_match_result_only_score_status', false, SQLERRM
    );
  END;

  -- Test 20 official cannot reparent match_event
  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  SELECT id INTO event_id
  FROM public.match_events
  WHERE match_id = match_a1
  LIMIT 1;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events
    SET match_id = match_a2
    WHERE id = event_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '20_official_cannot_change_match_id_on_event',
      v_count = 0,
      format('updated_rows=%s expected=0 (RLS blocks UPDATE)', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '20_official_cannot_change_match_id_on_event',
      SQLERRM ILIKE '%match_id cannot be changed%'
        OR SQLERRM ILIKE '%row-level security%'
        OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 21 owner inserts event without season_role
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'substitution_out', 70)
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '21_owner_inserts_event_without_season_role',
      event_id IS NOT NULL,
      format('event_id=%s', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '21_owner_inserts_event_without_season_role', false, SQLERRM
    );
  END;

  -- Test 22 admin updates matches directly
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.matches
    SET status = 'in_progress', round_label = 'Jornada 1 updated'
    WHERE id = match_a2;
    SELECT status, round_label INTO v_status, v_round
    FROM public.matches WHERE id = match_a2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '22_admin_direct_match_update_still_works',
      v_status = 'in_progress' AND v_round = 'Jornada 1 updated',
      format('status=%s round_label=%s', v_status, v_round)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '22_admin_direct_match_update_still_works', false, SQLERRM
    );
  END;

  -- Test 23 referee yellow triggers discipline suspension (limit=1)
  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'yellow_card', 88)
    RETURNING id INTO event_id;

    SELECT id, suspension_type, matches_remaining
    INTO susp_id, v_status, v_count
    FROM public.discipline_suspensions
    WHERE source_match_event_id = event_id;

    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '23_referee_yellow_triggers_discipline_suspension',
      susp_id IS NOT NULL
        AND v_status = 'accumulation'
        AND v_count = 2,
      format(
        'event=%s suspension=%s type=%s remaining=%s (expected accumulation remaining=2)',
        event_id, susp_id, v_status, v_count
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '23_referee_yellow_triggers_discipline_suspension', false, SQLERRM
    );
  END;

  -- Test 28 referee confirmed cannot UPDATE match_event
  SELECT id INTO event_id
  FROM public.match_events
  WHERE match_id = match_a1
  ORDER BY created_at
  LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events SET notes = 'referee edit attempt' WHERE id = event_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '28_referee_cannot_update_match_event',
      v_count = 0,
      format('updated_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '28_referee_cannot_update_match_event',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 29 tournament_admin cannot UPDATE match_event
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events SET notes = 'tournament admin edit' WHERE id = event_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '29_tournament_admin_cannot_update_match_event',
      v_count = 0,
      format('updated_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '29_tournament_admin_cannot_update_match_event',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 30 tournament_admin and referee cannot DELETE
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.match_events WHERE id = event_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '30a_tournament_admin_cannot_delete_match_event',
      v_count = 0,
      format('deleted_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '30a_tournament_admin_cannot_delete_match_event',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.match_events WHERE id = event_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '30b_referee_cannot_delete_match_event',
      v_count = 0,
      format('deleted_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '30b_referee_cannot_delete_match_event',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 31 admin retains UPDATE and DELETE on match_events
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events
    SET notes = 'admin corrected note'
    WHERE id = event_id;
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a3, org_a, stp_p, 'injury', 99)
    RETURNING id INTO event_id2;
    DELETE FROM public.match_events WHERE id = event_id2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    SELECT notes INTO v_status FROM public.match_events WHERE id = event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '31_admin_update_and_delete_match_events',
      v_status = 'admin corrected note' AND v_count = 1,
      format('updated_notes=%s delete_rows=%s', v_status, v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '31_admin_update_and_delete_match_events', false, SQLERRM
    );
  END;

  -- Test 25 revoked membership blocks referee capture
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT count(*) INTO v_roles_before
  FROM public.season_roles
  WHERE profile_id = uid_referee AND season_id = season_a;

  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.organization_members
  WHERE organization_id = org_a AND profile_id = uid_referee;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_roles_after
  FROM public.season_roles
  WHERE profile_id = uid_referee AND season_id = season_a;

  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a1, org_a, stp_p, 'goal', 91);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '25_revoked_member_referee_cannot_insert',
      false,
      format('unexpected success inserted_rows=%s roles_before=%s roles_after=%s',
        v_count, v_roles_before, v_roles_after)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '25_revoked_member_referee_cannot_insert',
      (SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%')
        AND v_roles_before >= 1 AND v_roles_after = 0,
      format('roles_before=%s roles_after=%s err=%s', v_roles_before, v_roles_after, SQLERRM)
    );
  END;

  -- Test 26 revoked membership blocks tournament_admin
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.organization_members
  WHERE organization_id = org_a AND profile_id = uid_tourn_a;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a3, org_a, stp_p, 'goal', 92);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'insert unexpectedly returned 0 rows';
    END IF;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '26_revoked_member_tournament_admin_blocked', false, 'insert unexpectedly succeeded'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    IF SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%' THEN
      BEGIN
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM public.update_match_result(match_a1, 'finished', 4, 4);
        EXECUTE 'RESET ROLE';
        INSERT INTO public.__mig008_test_results VALUES (
          '26_revoked_member_tournament_admin_blocked', false, 'RPC unexpectedly succeeded after insert fail'
        );
      EXCEPTION WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        INSERT INTO public.__mig008_test_results VALUES (
          '26_revoked_member_tournament_admin_blocked',
          SQLERRM ILIKE '%Not authorized%' OR SQLERRM ILIKE '%row-level security%',
          format('insert_err=RLS rpc_err=%s', SQLERRM)
        );
      END;
    ELSE
      INSERT INTO public.__mig008_test_results VALUES (
        '26_revoked_member_tournament_admin_blocked', false, SQLERRM
      );
    END IF;
  END;

  -- Test 27 ON DELETE CASCADE removes season_roles (delegate)
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT count(*) INTO v_roles_before
  FROM public.season_roles
  WHERE profile_id = uid_delegate AND season_id = season_a;

  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.organization_members
  WHERE organization_id = org_a AND profile_id = uid_delegate;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO v_roles_after
  FROM public.season_roles
  WHERE profile_id = uid_delegate AND season_id = season_a;

  INSERT INTO public.__mig008_test_results VALUES (
    '27_cascade_removes_season_roles_on_member_delete',
    v_roles_before >= 1 AND v_roles_after = 0,
    format('delegate roles before=%s after=%s', v_roles_before, v_roles_after)
  );

  -- Test 32 anon cannot execute update_match_result
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.update_match_result(match_a1, 'finished', 0, 0);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '32_anon_cannot_execute_update_match_result', false, 'unexpected RPC success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '32_anon_cannot_execute_update_match_result',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%must be owner%',
      SQLERRM
    );
  END;

  -- Test 33 authenticated member without capture role
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_match_result(match_a1, 'finished', 0, 0);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '33_member_cannot_execute_update_match_result', false, 'unexpected RPC success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '33_member_cannot_execute_update_match_result',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- Test 34 no external profile_id parameter on auth functions
  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('has_season_role', 'can_capture_match', 'update_match_result')
      AND 'profile_id' = ANY (COALESCE(p.proargnames, ARRAY[]::text[]))
  ) INTO v_fn_ok;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('has_season_role', 'can_capture_match', 'update_match_result');

  INSERT INTO public.__mig008_test_results VALUES (
    '34_auth_functions_no_external_profile_id',
    v_fn_ok AND v_count = 3,
    format('functions_found=%s no_profile_id_arg=%s', v_count, v_fn_ok)
  );

  -- Test 24 (original) referee cannot DELETE — run after 30b for completeness label
  SELECT id INTO event_id
  FROM public.match_events
  WHERE match_id = match_a1
  LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', uid_referee::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_referee::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.match_events WHERE id = event_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '24_official_cannot_delete_match_event',
      v_count = 0,
      format('deleted_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig008_test_results VALUES (
      '24_official_cannot_delete_match_event',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig008_test_results
ORDER BY test_name;
