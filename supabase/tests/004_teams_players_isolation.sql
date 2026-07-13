-- Isolation tests for Migration 004 (teams / players / rosters / captain)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/004_teams_players_isolation.sql

DROP TABLE IF EXISTS public.__mig004_test_results;
CREATE TABLE public.__mig004_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa21';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa22';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa23';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb21';
  uid_shared uuid := 'cccccccc-cccc-cccc-cccc-cccccccccc21';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  team_a uuid;
  team_a2 uuid;
  team_b uuid;
  player_a1 uuid;
  player_a2 uuid;
  player_a3 uuid;
  player_b1 uuid;
  player_shared_a uuid;
  player_shared_b uuid;
  season_team_a uuid;
  season_team_b uuid;
  stp_a1 uuid;
  stp_a2 uuid;
  v_count int;
  v_captain_count int;
  v_captain_player uuid;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_shared)
     OR slug IN ('org-a-mig004', 'org-b-mig004');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_shared);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig004.local', '$2a$06$testhashligapromigration004aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig004.local', '$2a$06$testhashligapromigration004aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig004.local', '$2a$06$testhashligapromigration004aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig004.local', '$2a$06$testhashligapromigration004aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_shared, 'authenticated', 'authenticated',
     'shared@ligapro-mig004.local', '$2a$06$testhashligapromigration004aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig004');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B + seed
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig004');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (
    competition_b, org_b, 'Season B', 'season-b', 'round_robin'
  ) RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name)
  VALUES (org_b, 'Team B') RETURNING id INTO team_b;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_b, 'Player B1') RETURNING id INTO player_b1;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b, org_b) RETURNING id INTO season_team_b;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number, is_captain
  ) VALUES (season_team_b, player_b1, org_b, 9, true);
  EXECUTE 'RESET ROLE';

  -- Test 1 isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.teams WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig004_test_results VALUES (
    '1a_user_a_cannot_read_org_b_teams', v_count = 0, format('teams_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.players WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig004_test_results VALUES (
    '1b_user_a_cannot_read_org_b_players', v_count = 0, format('players_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_teams WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig004_test_results VALUES (
    '1c_user_a_cannot_read_org_b_season_teams', v_count = 0, format('season_teams_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_team_players WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig004_test_results VALUES (
    '1d_user_a_cannot_read_org_b_season_team_players',
    v_count = 0,
    format('season_team_players_visible=%s', v_count)
  );

  -- Test 2 member cannot create team
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Member Team');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '2_member_cannot_create_team', false, format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '2_member_cannot_create_team',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 3 admin full flow
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.competitions (organization_id, name)
    VALUES (org_a, 'Comp A') RETURNING id INTO competition_a;
    INSERT INTO public.seasons (
      competition_id, organization_id, name, slug, format_type
    ) VALUES (
      competition_a, org_a, 'Season A', 'season-a', 'round_robin'
    ) RETURNING id INTO season_a;
    INSERT INTO public.teams (organization_id, name)
    VALUES (org_a, 'Team A') RETURNING id INTO team_a;
    INSERT INTO public.teams (organization_id, name)
    VALUES (org_a, 'Team A2') RETURNING id INTO team_a2;
    INSERT INTO public.players (organization_id, full_name)
    VALUES (org_a, 'Player A1') RETURNING id INTO player_a1;
    INSERT INTO public.players (organization_id, full_name)
    VALUES (org_a, 'Player A2') RETURNING id INTO player_a2;
    INSERT INTO public.players (organization_id, full_name)
    VALUES (org_a, 'Player A3') RETURNING id INTO player_a3;
    INSERT INTO public.season_teams (season_id, team_id, organization_id)
    VALUES (season_a, team_a, org_a) RETURNING id INTO season_team_a;
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id, jersey_number, is_captain
    ) VALUES (season_team_a, player_a1, org_a, 10, true)
    RETURNING id INTO stp_a1;
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id, jersey_number, is_captain
    ) VALUES (season_team_a, player_a2, org_a, 7, false)
    RETURNING id INTO stp_a2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '3_admin_full_roster_flow',
      team_a IS NOT NULL AND player_a1 IS NOT NULL
        AND season_team_a IS NOT NULL AND stp_a1 IS NOT NULL AND stp_a2 IS NOT NULL,
      format('team=%s st=%s p1=%s p2=%s', team_a, season_team_a, player_a1, player_a2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '3_admin_full_roster_flow', false, SQLERRM
    );
  END;

  -- Test 4a: season_team.organization_id must match season
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_teams (season_id, team_id, organization_id)
    VALUES (season_b, team_a2, org_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '4a_season_team_org_must_match_season',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '4a_season_team_org_must_match_season',
      SQLERRM ILIKE '%must match seasons.organization_id%',
      SQLERRM
    );
  END;

  -- Test 4b: season_team.organization_id must match team
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_teams (season_id, team_id, organization_id)
    VALUES (season_a, team_b, org_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '4b_season_team_org_must_match_team',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '4b_season_team_org_must_match_team',
      SQLERRM ILIKE '%must match teams.organization_id%',
      SQLERRM
    );
  END;

  -- Test 5a: roster org must match season_team
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id
    ) VALUES (season_team_a, player_a3, org_b);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '5a_roster_org_must_match_season_team',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '5a_roster_org_must_match_season_team',
      SQLERRM ILIKE '%must match season_teams.organization_id%',
      SQLERRM
    );
  END;

  -- Test 5b: roster org must match player
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id
    ) VALUES (season_team_a, player_b1, org_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '5b_roster_org_must_match_player',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '5b_roster_org_must_match_player',
      SQLERRM ILIKE '%must match players.organization_id%',
      SQLERRM
    );
  END;

  -- Test 6: second captain via direct UPDATE
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.season_team_players SET is_captain = true WHERE id = stp_a2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '6_second_captain_direct_update_rejected',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '6_second_captain_direct_update_rejected',
      SQLERRM ILIKE '%season_team_players_one_captain_per_team%'
        OR SQLERRM ILIKE '%unique%',
      SQLERRM
    );
  END;

  -- Test 7: RPC switches captain
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_captain(season_team_a, player_a2);
    SELECT count(*) INTO v_captain_count
    FROM public.season_team_players
    WHERE season_team_id = season_team_a AND is_captain = true;
    SELECT player_id INTO v_captain_player
    FROM public.season_team_players
    WHERE season_team_id = season_team_a AND is_captain = true;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '7_rpc_switches_captain_atomically',
      v_captain_count = 1 AND v_captain_player = player_a2,
      format('captain_count=%s captain_player=%s expected=%s', v_captain_count, v_captain_player, player_a2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '7_rpc_switches_captain_atomically', false, SQLERRM
    );
  END;

  -- Test 8a: player not on roster
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_captain(season_team_a, player_a3);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '8a_rpc_fails_if_player_not_on_roster', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '8a_rpc_fails_if_player_not_on_roster',
      SQLERRM ILIKE '%not on the roster%',
      SQLERRM
    );
  END;

  -- Seed inactive roster row for tests 8b and 9 (must survive exception blocks)
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number, registration_status
  ) VALUES (season_team_a, player_a3, org_a, 11, 'inactive');
  EXECUTE 'RESET ROLE';

  -- Test 8b: player not active
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.set_season_team_captain(season_team_a, player_a3);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '8b_rpc_fails_if_player_not_active', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '8b_rpc_fails_if_player_not_active',
      SQLERRM ILIKE '%registration_status = active%',
      SQLERRM
    );
  END;

  -- Test 9: CHECK captain must be active (direct UPDATE)
  -- Clear current captain first so UNIQUE does not mask the CHECK.
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.season_team_players
    SET is_captain = false
    WHERE season_team_id = season_team_a AND is_captain = true;

    UPDATE public.season_team_players
    SET is_captain = true
    WHERE player_id = player_a3
      AND season_team_id = season_team_a
      AND registration_status = 'inactive';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '9_inactive_or_suspended_cannot_be_captain',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '9_inactive_or_suspended_cannot_be_captain',
      SQLERRM ILIKE '%season_team_players_captain_must_be_active_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 10: duplicate player on roster
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_team_players (
      season_team_id, player_id, organization_id
    ) VALUES (season_team_a, player_a1, org_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '10_duplicate_player_on_roster_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '10_duplicate_player_on_roster_rejected',
      SQLERRM ILIKE '%season_team_players_season_team_id_player_id_unique%'
        OR SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Test 11: duplicate jersey
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.season_team_players SET jersey_number = 10 WHERE id = stp_a2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '11_duplicate_jersey_rejected',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '11_duplicate_jersey_rejected',
      SQLERRM ILIKE '%season_team_players_jersey_unique_per_team%'
        OR SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Test 12a: same profile twice in same org
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.players (organization_id, profile_id, full_name)
    VALUES (org_a, uid_shared, 'Shared A1') RETURNING id INTO player_shared_a;
    INSERT INTO public.players (organization_id, profile_id, full_name)
    VALUES (org_a, uid_shared, 'Shared A2');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '12a_same_profile_same_org_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '12a_same_profile_same_org_rejected',
      SQLERRM ILIKE '%players_organization_id_profile_id_unique%'
        OR SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Test 12b: same profile in two orgs
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.players
      WHERE organization_id = org_a AND profile_id = uid_shared
    ) THEN
      INSERT INTO public.players (organization_id, profile_id, full_name)
      VALUES (org_a, uid_shared, 'Shared A1')
      RETURNING id INTO player_shared_a;
    ELSE
      SELECT id INTO player_shared_a
      FROM public.players
      WHERE organization_id = org_a AND profile_id = uid_shared;
    END IF;

    PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
      true
    );
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.players (organization_id, profile_id, full_name)
    VALUES (org_b, uid_shared, 'Shared B1')
    RETURNING id INTO player_shared_b;
    EXECUTE 'RESET ROLE';

    INSERT INTO public.__mig004_test_results VALUES (
      '12b_same_profile_different_orgs_allowed',
      player_shared_a IS NOT NULL AND player_shared_b IS NOT NULL
        AND player_shared_a IS DISTINCT FROM player_shared_b,
      format('player_a=%s player_b=%s', player_shared_a, player_shared_b)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig004_test_results VALUES (
      '12b_same_profile_different_orgs_allowed', false, SQLERRM
    );
  END;

  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_shared)
     OR slug IN ('org-a-mig004', 'org-b-mig004');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_shared);
END $$;

SELECT test_name, passed, details
FROM public.__mig004_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig004_test_results;
