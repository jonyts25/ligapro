-- Isolation + auto-generation tests for Migration 007 (discipline_suspensions)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/007_discipline_suspensions.sql

DROP TABLE IF EXISTS public.__mig007_test_results;
CREATE TABLE public.__mig007_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa61';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa62';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa63';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb61';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_a2 uuid;
  competition_b uuid;
  season_a uuid;
  season_a2 uuid;
  season_b uuid;
  team_home uuid;
  team_away uuid;
  team_home2 uuid;
  team_away2 uuid;
  team_b1 uuid;
  team_b2 uuid;
  st_home uuid;
  st_away uuid;
  st_home2 uuid;
  st_away2 uuid;
  st_b1 uuid;
  st_b2 uuid;
  player_p1 uuid;
  player_p2 uuid;
  player_shared uuid;
  player_b uuid;
  stp_p1 uuid;
  stp_p2 uuid;
  stp_shared_s1 uuid;
  stp_shared_s2 uuid;
  stp_b uuid;
  match_a uuid;
  match_a2 uuid;
  match_b uuid;
  event_id uuid;
  event_other uuid;
  susp_id uuid;
  v_count int;
  v_remaining int;
  v_type text;
  v_limit int := 2;
  v_susp_matches int := 3;
  yellow_ids uuid[] := ARRAY[]::uuid[];
  i int;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig007', 'org-b-mig007');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig007.local', '$2a$06$testhashligapromigration007aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig007.local', '$2a$06$testhashligapromigration007aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig007.local', '$2a$06$testhashligapromigration007aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig007.local', '$2a$06$testhashligapromigration007aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig007', 'org-a-mig007')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B seed suspension
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig007', 'org-b-mig007')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Season B', 'season-b', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B1') RETURNING id INTO team_b1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B2') RETURNING id INTO team_b2;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_b, 'Player B') RETURNING id INTO player_b;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b1, org_b) RETURNING id INTO st_b1;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b2, org_b) RETURNING id INTO st_b2;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_b1, player_b, org_b, 9) RETURNING id INTO stp_b;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id
  ) VALUES (season_b, org_b, st_b1, st_b2) RETURNING id INTO match_b;
  INSERT INTO public.discipline_suspensions (
    organization_id, season_team_player_id, suspension_type,
    matches_remaining, notes
  ) VALUES (org_b, stp_b, 'administrative', 1, 'seed org b');
  EXECUTE 'RESET ROLE';

  -- Test 1 isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count
  FROM public.discipline_suspensions WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig007_test_results VALUES (
    '1_user_a_cannot_read_org_b_suspensions',
    v_count = 0,
    format('suspensions_visible=%s', v_count)
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
  SET yellow_card_limit = v_limit, suspension_matches = v_susp_matches
  WHERE season_id IN (season_a, season_a2);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home') RETURNING id INTO team_home;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away') RETURNING id INTO team_away;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home2') RETURNING id INTO team_home2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away2') RETURNING id INTO team_away2;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Player P1') RETURNING id INTO player_p1;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Player P2') RETURNING id INTO player_p2;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Shared Player') RETURNING id INTO player_shared;

  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_home, org_a) RETURNING id INTO st_home;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_away, org_a) RETURNING id INTO st_away;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a2, team_home2, org_a) RETURNING id INTO st_home2;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a2, team_away2, org_a) RETURNING id INTO st_away2;

  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_home, player_p1, org_a, 10) RETURNING id INTO stp_p1;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_home, player_p2, org_a, 11) RETURNING id INTO stp_p2;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_home, player_shared, org_a, 8) RETURNING id INTO stp_shared_s1;
  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_home2, player_shared, org_a, 8) RETURNING id INTO stp_shared_s2;

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id
  ) VALUES (season_a, org_a, st_home, st_away) RETURNING id INTO match_a;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id
  ) VALUES (season_a2, org_a, st_home2, st_away2) RETURNING id INTO match_a2;
  EXECUTE 'RESET ROLE';

  -- Test 2 member cannot create administrative suspension
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.discipline_suspensions (
      organization_id, season_team_player_id, suspension_type, matches_remaining
    ) VALUES (org_a, stp_p1, 'administrative', 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '2_member_cannot_create_suspension',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '2_member_cannot_create_suspension',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Admin JWT for remaining tests
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );

  -- Test 3 admin administrative with NULL source
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.discipline_suspensions (
      organization_id, season_team_player_id, suspension_type,
      matches_remaining, notes
    ) VALUES (org_a, stp_p1, 'administrative', 2, 'manual ban')
    RETURNING id INTO susp_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '3_admin_creates_administrative_null_source',
      susp_id IS NOT NULL,
      format('suspension_id=%s', susp_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '3_admin_creates_administrative_null_source', false, SQLERRM
    );
  END;

  -- Test 4 direct_red with NULL source fails CHECK
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.discipline_suspensions (
      organization_id, season_team_player_id, suspension_type, matches_remaining
    ) VALUES (org_a, stp_p1, 'direct_red', 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '4_direct_red_requires_source_event',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '4_direct_red_requires_source_event',
      SQLERRM ILIKE '%discipline_suspensions_source_event_required_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 5 red_card auto-generates direct_red with suspension_matches
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_p1, 'red_card', 88)
    RETURNING id INTO event_id;

    SELECT id, suspension_type, matches_remaining
    INTO susp_id, v_type, v_remaining
    FROM public.discipline_suspensions
    WHERE source_match_event_id = event_id;

    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '5_red_card_auto_generates_direct_red',
      susp_id IS NOT NULL
        AND v_type = 'direct_red'
        AND v_remaining = v_susp_matches,
      format(
        'suspension_id=%s type=%s remaining=%s expected_remaining=%s event=%s',
        susp_id, v_type, v_remaining, v_susp_matches, event_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '5_red_card_auto_generates_direct_red', false, SQLERRM
    );
  END;

  -- Test 6: yellows one-by-one until limit; only last generates
  -- Use stp_p2 with limit=2
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_p2, 'yellow_card', 10)
    RETURNING id INTO event_id;
    yellow_ids := array_append(yellow_ids, event_id);

    SELECT count(*) INTO v_count
    FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_p2
      AND suspension_type = 'accumulation';

    IF v_count <> 0 THEN
      EXECUTE 'RESET ROLE';
      INSERT INTO public.__mig007_test_results VALUES (
        '6_accumulation_only_at_exact_multiple',
        false,
        format('suspension after yellow #1 unexpected count=%s', v_count)
      );
    ELSE
      INSERT INTO public.match_events (
        match_id, organization_id, season_team_player_id, event_type, minute
      ) VALUES (match_a, org_a, stp_p2, 'yellow_card', 20)
      RETURNING id INTO event_id;
      yellow_ids := array_append(yellow_ids, event_id);

      SELECT id, matches_remaining, source_match_event_id
      INTO susp_id, v_remaining, event_other
      FROM public.discipline_suspensions
      WHERE season_team_player_id = stp_p2
        AND suspension_type = 'accumulation';

      SELECT count(*) INTO v_count
      FROM public.discipline_suspensions
      WHERE season_team_player_id = stp_p2
        AND suspension_type = 'accumulation';

      EXECUTE 'RESET ROLE';
      INSERT INTO public.__mig007_test_results VALUES (
        '6_accumulation_only_at_exact_multiple',
        v_count = 1
          AND susp_id IS NOT NULL
          AND event_other = yellow_ids[2]
          AND v_remaining = v_susp_matches,
        format(
          'limit=%s yellows=%s susp_count=%s source_event=%s (expected yellow#2=%s) remaining=%s',
          v_limit,
          array_length(yellow_ids, 1),
          v_count,
          event_other,
          yellow_ids[2],
          v_remaining
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '6_accumulation_only_at_exact_multiple', false, SQLERRM
    );
  END;

  -- Test 7: one more yellow after first multiple → no second suspension
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_p2, 'yellow_card', 30)
    RETURNING id INTO event_id;

    SELECT count(*) INTO v_count
    FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_p2
      AND suspension_type = 'accumulation';

    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '7_no_second_suspension_until_next_multiple',
      v_count = 1,
      format(
        'after yellow#3 (count=3, limit=2) accumulation_rows=%s expected=1 (next at 4)',
        v_count
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '7_no_second_suspension_until_next_multiple', false, SQLERRM
    );
  END;

  -- Test 8: two players accumulate separately (p1 already has red; use shared_s1 vs p2 already has yellows)
  -- Fresh: insert 1 yellow for shared_s1 — must NOT create accumulation from p2's yellows
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_shared_s1, 'yellow_card', 40);

    SELECT count(*) INTO v_count
    FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_shared_s1
      AND suspension_type = 'accumulation';

    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '8_yellow_counts_do_not_mix_across_players',
      v_count = 0,
      format(
        'shared_s1 accumulation after 1 yellow=%s (p2 already has 3 yellows; must not mix)',
        v_count
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '8_yellow_counts_do_not_mix_across_players', false, SQLERRM
    );
  END;

  -- Test 9: same players.id across two seasons — counts isolated by season
  -- Season A: shared already has 1 yellow on stp_shared_s1. Add 1 more → hits limit=2 → suspension in s1.
  -- Season A2: insert 1 yellow on stp_shared_s2 → must NOT create accumulation (count in s2 = 1).
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';

    INSERT INTO public.match_events (
      match_id, organization_id, season_team_player_id, event_type, minute
    ) VALUES (match_a, org_a, stp_shared_s1, 'yellow_card', 50)
    RETURNING id INTO event_id;

    SELECT count(*) INTO v_count
    FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_shared_s1
      AND suspension_type = 'accumulation';

    IF v_count <> 1 THEN
      EXECUTE 'RESET ROLE';
      INSERT INTO public.__mig007_test_results VALUES (
        '9_yellow_counts_isolated_per_season',
        false,
        format('season_a expected 1 accumulation for shared_s1 got=%s', v_count)
      );
    ELSE
      INSERT INTO public.match_events (
        match_id, organization_id, season_team_player_id, event_type, minute
      ) VALUES (match_a2, org_a, stp_shared_s2, 'yellow_card', 15);

      SELECT count(*) INTO i
      FROM public.discipline_suspensions
      WHERE season_team_player_id = stp_shared_s2
        AND suspension_type = 'accumulation';

      SELECT count(*) INTO v_count
      FROM public.match_events me
      JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
      JOIN public.season_teams st ON st.id = stp.season_team_id
      WHERE me.event_type = 'yellow_card'
        AND me.season_team_player_id = stp_shared_s2
        AND st.season_id = season_a2;

      EXECUTE 'RESET ROLE';
      INSERT INTO public.__mig007_test_results VALUES (
        '9_yellow_counts_isolated_per_season',
        i = 0 AND v_count = 1,
        format(
          'same player_id=%s; season_a stp=%s has accumulation; season_a2 stp=%s yellows=%s accumulation_rows=%s (expected 0)',
          player_shared, stp_shared_s1, stp_shared_s2, v_count, i
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '9_yellow_counts_isolated_per_season', false, SQLERRM
    );
  END;

  -- Test 10: source event of another player rejected
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT id INTO event_other
    FROM public.match_events
    WHERE season_team_player_id = stp_p2
    LIMIT 1;

    INSERT INTO public.discipline_suspensions (
      organization_id, season_team_player_id, source_match_event_id,
      suspension_type, matches_remaining
    ) VALUES (org_a, stp_p1, event_other, 'direct_red', 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '10_source_event_must_same_player',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '10_source_event_must_same_player',
      SQLERRM ILIKE '%source event must be for the same player%',
      SQLERRM
    );
  END;

  -- Test 11: admin updates remaining/status (manual fulfillment)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT id INTO susp_id
    FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_p1
      AND suspension_type = 'direct_red'
    LIMIT 1;

    UPDATE public.discipline_suspensions
    SET matches_remaining = 0,
        matches_served = v_susp_matches,
        status = 'served'
    WHERE id = susp_id;

    SELECT matches_remaining, status INTO v_remaining, v_type
    FROM public.discipline_suspensions WHERE id = susp_id;

    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '11_admin_updates_remaining_and_status',
      v_remaining = 0 AND v_type = 'served',
      format('suspension_id=%s remaining=%s status=%s', susp_id, v_remaining, v_type)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig007_test_results VALUES (
      '11_admin_updates_remaining_and_status', false, SQLERRM
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig007_test_results
ORDER BY test_name;
