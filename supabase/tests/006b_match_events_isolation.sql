-- Isolation tests for Migration 006b (match_events)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/006b_match_events_isolation.sql

DROP TABLE IF EXISTS public.__mig006b_test_results;
CREATE TABLE public.__mig006b_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa51';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa52';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa53';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb51';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  team_home uuid;
  team_away uuid;
  team_other uuid;
  team_b1 uuid;
  team_b2 uuid;
  st_home uuid;
  st_away uuid;
  st_other uuid;
  st_b1 uuid;
  st_b2 uuid;
  player_home uuid;
  player_away uuid;
  player_other uuid;
  player_b uuid;
  stp_home uuid;
  stp_away uuid;
  stp_other uuid;
  stp_b uuid;
  match_a uuid;
  match_b uuid;
  event_id uuid;
  event_id2 uuid;
  v_count int;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig006b', 'org-b-mig006b');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig006b.local', '$2a$06$testhashligapromigration006bb', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig006b.local', '$2a$06$testhashligapromigration006bb', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig006b.local', '$2a$06$testhashligapromigration006bb', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig006b.local', '$2a$06$testhashligapromigration006bb', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig006b');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B + seed match + event
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig006b');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Season B', 'season-b', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Team B1') RETURNING id INTO team_b1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Team B2') RETURNING id INTO team_b2;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_b, 'Player B1') RETURNING id INTO player_b;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b1, org_b) RETURNING id INTO st_b1;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b2, org_b) RETURNING id INTO st_b2;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_b1, player_b, org_b, 9) RETURNING id INTO stp_b;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id, status
  ) VALUES (season_b, org_b, st_b1, st_b2, 'scheduled')
  RETURNING id INTO match_b;
  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES (match_b, org_b, stp_b, 'goal', 12);
  EXECUTE 'RESET ROLE';

  -- Test 1: user A cannot read org B match_events
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.match_events WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig006b_test_results VALUES (
    '1_user_a_cannot_read_org_b_match_events',
    v_count = 0,
    format('events_visible=%s', v_count)
  );

  -- Admin setup for org A (match + rosters)
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
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home') RETURNING id INTO team_home;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away') RETURNING id INTO team_away;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Other') RETURNING id INTO team_other;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Home Player') RETURNING id INTO player_home;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Away Player') RETURNING id INTO player_away;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Other Player') RETURNING id INTO player_other;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_home, org_a) RETURNING id INTO st_home;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_away, org_a) RETURNING id INTO st_away;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_other, org_a) RETURNING id INTO st_other;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_home, player_home, org_a, 10) RETURNING id INTO stp_home;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_away, player_away, org_a, 7) RETURNING id INTO stp_away;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_other, player_other, org_a, 5) RETURNING id INTO stp_other;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id, status
  ) VALUES (season_a, org_a, st_home, st_away, 'in_progress')
  RETURNING id INTO match_a;
  EXECUTE 'RESET ROLE';

  -- Test 2: member cannot create event
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'goal', 5);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '2_member_cannot_create_event',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '2_member_cannot_create_event',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Switch back to admin for remaining writes
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );

  -- Test 3: admin creates valid goal
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute, notes
    ) VALUES (match_a, org_a, stp_home, 'goal', 23, 'gol de tiro libre')
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '3_admin_creates_valid_goal',
      event_id IS NOT NULL,
      format('event_id=%s', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '3_admin_creates_valid_goal', false, SQLERRM
    );
  END;

  -- Test 4: org mismatch vs match
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_b, stp_home, 'goal', 10);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '4_event_org_must_match_match',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '4_event_org_must_match_match',
      SQLERRM ILIKE '%must match matches.organization_id%'
        OR SQLERRM ILIKE '%row-level security%'
        OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 5: player not on home/away roster
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_other, 'yellow_card', 40);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '5_player_must_be_on_match_roster',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '5_player_must_be_on_match_roster',
      SQLERRM ILIKE '%must be on one of the two match teams%',
      SQLERRM
    );
  END;

  -- Test 6: invalid event_type
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'penalty', 50);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '6_invalid_event_type_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '6_invalid_event_type_rejected',
      SQLERRM ILIKE '%match_events_event_type_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 7: negative minute
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'goal', -1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '7_negative_minute_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '7_negative_minute_rejected',
      SQLERRM ILIKE '%match_events_minute_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 8: minute > 130
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'goal', 131);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '8_minute_over_130_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '8_minute_over_130_rejected',
      SQLERRM ILIKE '%match_events_minute_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 9: two distinct events same player same match
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'yellow_card', 55)
    RETURNING id INTO event_id;
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'goal', 60)
    RETURNING id INTO event_id2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '9_multiple_events_same_player_allowed',
      event_id IS NOT NULL AND event_id2 IS NOT NULL AND event_id <> event_id2,
      format('event1=%s event2=%s', event_id, event_id2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '9_multiple_events_same_player_allowed', false, SQLERRM
    );
  END;

  -- Test 10a: home player event
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_home, 'substitution_out', 70)
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '10a_home_player_event_ok',
      event_id IS NOT NULL,
      format('event_id=%s', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '10a_home_player_event_ok', false, SQLERRM
    );
  END;

  -- Test 10b: away player event same match
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_away, 'substitution_in', 70)
    RETURNING id INTO event_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '10b_away_player_event_ok',
      event_id IS NOT NULL,
      format('event_id=%s', event_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006b_test_results VALUES (
      '10b_away_player_event_ok', false, SQLERRM
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig006b_test_results
ORDER BY test_name;
