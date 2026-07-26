-- Migration 025: knockout bracket engine isolation tests
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/025_knockout_bracket.sql

DROP TABLE IF EXISTS public.__mig025_test_results;
CREATE TABLE public.__mig025_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig025_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig025_assert_bracket(
  p_season_id uuid,
  p_team_count integer,
  p_expected_bracket_size integer,
  p_test_name text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_bracket_size integer;
  v_byes integer;
  v_matches integer;
  v_distinct_teams integer;
BEGIN
  SELECT kr.bracket_size INTO v_bracket_size
  FROM public.season_knockout_rounds kr
  WHERE kr.season_id = p_season_id AND kr.round_number = 1;

  SELECT COUNT(*) INTO v_byes
  FROM public.season_knockout_ties t
  JOIN public.season_knockout_rounds kr ON kr.id = t.knockout_round_id
  WHERE kr.season_id = p_season_id AND kr.round_number = 1
    AND t.away_season_team_id IS NULL;

  SELECT COUNT(*) INTO v_matches
  FROM public.matches m
  WHERE m.season_id = p_season_id;

  SELECT COUNT(DISTINCT team_id) INTO v_distinct_teams
  FROM (
    SELECT t.home_season_team_id AS team_id
    FROM public.season_knockout_ties t
    JOIN public.season_knockout_rounds kr ON kr.id = t.knockout_round_id
    WHERE kr.season_id = p_season_id AND kr.round_number = 1
    UNION
    SELECT t.away_season_team_id
    FROM public.season_knockout_ties t
    JOIN public.season_knockout_rounds kr ON kr.id = t.knockout_round_id
    WHERE kr.season_id = p_season_id AND kr.round_number = 1
      AND t.away_season_team_id IS NOT NULL
  ) s;

  INSERT INTO public.__mig025_test_results VALUES (
    p_test_name,
    v_bracket_size = p_expected_bracket_size
      AND v_byes = p_expected_bracket_size - p_team_count
      AND v_matches = (p_team_count - (p_expected_bracket_size - p_team_count)) / 2
      AND v_distinct_teams = p_team_count,
    format(
      'bracket=%s expected=%s byes=%s matches=%s distinct_teams=%s',
      v_bracket_size, p_expected_bracket_size, v_byes, v_matches, v_distinct_teams
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.__mig025_finish_knockout_match(
  p_match_id uuid,
  p_home_score integer,
  p_away_score integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.update_match_result(p_match_id, 'finished', p_home_score, p_away_score);
END;
$$;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0250';
  org_a uuid;
  competition_a uuid;
  season_ko uuid;
  season_ko5 uuid;
  season_ko6 uuid;
  season_ko10 uuid;
  season_ko4 uuid;
  season_bill uuid;
  venue_a uuid;
  field_a uuid;
  team1 uuid;
  team2 uuid;
  team3 uuid;
  team4 uuid;
  team5 uuid;
  team6 uuid;
  team7 uuid;
  team8 uuid;
  team9 uuid;
  team10 uuid;
  st_ids1 uuid;
  st_ids2 uuid;
  st_ids3 uuid;
  st_ids4 uuid;
  v_round_id uuid;
  v_result jsonb;
  v_match uuid;
  v_round2_id uuid;
  v_winner1 uuid;
  v_winner2 uuid;
  v_final_home uuid;
  v_final_away uuid;
  v_champion uuid;
  v_count integer;
  v_slot integer;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
    'owner-a@ligapro-mig025.local', '$2a$06$testhashligapromigration025aa', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig025');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Copa KO') RETURNING id INTO competition_a;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'KO 4', 'ko-4-025', 'knockout', 'public'
  ) RETURNING id INTO season_ko4;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'KO 5', 'ko-5-025', 'knockout', 'public'
  ) RETURNING id INTO season_ko5;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'KO 6', 'ko-6-025', 'knockout', 'public'
  ) RETURNING id INTO season_ko6;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'KO 10', 'ko-10-025', 'knockout', 'public'
  ) RETURNING id INTO season_ko10;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'KO Bill', 'ko-bill-025', 'knockout', 'public'
  ) RETURNING id INTO season_bill;

  season_ko := season_ko4;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 1') RETURNING id INTO team1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 2') RETURNING id INTO team2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 3') RETURNING id INTO team3;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 4') RETURNING id INTO team4;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 5') RETURNING id INTO team5;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 6') RETURNING id INTO team6;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 7') RETURNING id INTO team7;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 8') RETURNING id INTO team8;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 9') RETURNING id INTO team9;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'KO Team 10') RETURNING id INTO team10;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado'
  WHERE id IN (season_ko4, season_ko5, season_ko6, season_ko10);

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  st_ids1 := public.enroll_team_in_season(season_ko4, team1, NULL, NULL, 'confirmed');
  st_ids2 := public.enroll_team_in_season(season_ko4, team2, NULL, NULL, 'confirmed');
  st_ids3 := public.enroll_team_in_season(season_ko4, team3, NULL, NULL, 'confirmed');
  st_ids4 := public.enroll_team_in_season(season_ko4, team4, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko5, team1, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko5, team2, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko5, team3, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko5, team4, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko5, team5, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko6, team1, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko6, team2, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko6, team3, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko6, team4, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko6, team5, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko6, team6, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team1, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team2, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team3, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team4, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team5, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team6, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team7, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team8, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team9, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_ko10, team10, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_bill, team1, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_bill, team2, NULL, NULL, 'confirmed');

  INSERT INTO public.venues (organization_id, name, address)
  VALUES (org_a, 'Venue KO', 'Addr') RETURNING id INTO venue_a;
  INSERT INTO public.fields (venue_id, organization_id, name, surface_type)
  VALUES (venue_a, org_a, 'Field KO', 'pasto') RETURNING id INTO field_a;
  PERFORM public.replace_field_availability(
    field_a,
    '[{"day_of_week":1,"starts_at":"08:00","ends_at":"22:00"}]'::jsonb
  );
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Billing gate (season_bill still pendiente)
  BEGIN
    PERFORM public.create_season_knockout_bracket(season_bill, 'random');
    INSERT INTO public.__mig025_test_results VALUES (
      '1_billing_lock_blocks_bracket', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    INSERT INTO public.__mig025_test_results VALUES (
      '1_billing_lock_blocks_bracket',
      SQLERRM ILIKE '%facturaci%n%',
      SQLERRM
    );
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_bill;

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  PERFORM public.create_season_knockout_bracket(season_ko5, 'random');
  PERFORM public.__mig025_assert_bracket(season_ko5, 5, 8, '2_bracket_size_5_teams');

  PERFORM public.create_season_knockout_bracket(season_ko6, 'random');
  PERFORM public.__mig025_assert_bracket(season_ko6, 6, 8, '3_bracket_size_6_teams');

  PERFORM public.create_season_knockout_bracket(season_ko10, 'random');
  PERFORM public.__mig025_assert_bracket(season_ko10, 10, 16, '4_bracket_size_10_teams');

  v_result := public.create_season_knockout_bracket(season_ko4, 'random');
  v_round_id := (v_result->>'round_id')::uuid;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT DISTINCT unnest(ARRAY[t.home_season_team_id, t.away_season_team_id]) AS tid
    FROM public.season_knockout_ties t
    WHERE t.knockout_round_id = v_round_id
      AND t.away_season_team_id IS NOT NULL
    UNION
    SELECT t.home_season_team_id
    FROM public.season_knockout_ties t
    WHERE t.knockout_round_id = v_round_id
      AND t.away_season_team_id IS NULL
  ) x
  WHERE tid IS NOT NULL;
  INSERT INTO public.__mig025_test_results VALUES (
    '5_no_duplicate_teams_round1',
    v_count = 4,
    format('distinct=%s', v_count)
  );

  -- Two legs configuration
  PERFORM public.configure_knockout_round(v_round_id, true);
  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  WHERE m.knockout_round_id = v_round_id;
  INSERT INTO public.__mig025_test_results VALUES (
    '6_two_legs_doubles_matches',
    v_count = 4,
    format('matches=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  JOIN public.season_knockout_ties t
    ON t.knockout_round_id = m.knockout_round_id
   AND t.bracket_slot = m.bracket_slot
  WHERE m.knockout_round_id = v_round_id
    AND m.leg_number = 2
    AND m.home_season_team_id = t.away_season_team_id
    AND m.away_season_team_id = t.home_season_team_id
    AND t.away_season_team_id IS NOT NULL;
  INSERT INTO public.__mig025_test_results VALUES (
    '7_two_legs_inverts_home_away',
    v_count = 2,
    format('inverted_legs=%s', v_count)
  );

  -- Penalty winner validation on single-leg tie (reconfigure back to single for simpler flow)
  PERFORM public.configure_knockout_round(v_round_id, false);

  SELECT m.id INTO v_match
  FROM public.matches m
  JOIN public.season_knockout_ties t
    ON t.knockout_round_id = m.knockout_round_id
   AND t.bracket_slot = m.bracket_slot
  WHERE m.knockout_round_id = v_round_id
    AND t.bracket_slot = (
      SELECT MIN(t2.bracket_slot)
      FROM public.season_knockout_ties t2
      WHERE t2.knockout_round_id = v_round_id
        AND t2.away_season_team_id IS NOT NULL
    )
    AND m.leg_number = 1
  LIMIT 1;

  PERFORM public.__mig025_finish_knockout_match(v_match, 2, 1);

  BEGIN
    PERFORM public.set_knockout_tie_penalty_winner(
      v_round_id,
      (SELECT t.bracket_slot FROM public.season_knockout_ties t
       JOIN public.matches m ON m.knockout_round_id = t.knockout_round_id
         AND m.bracket_slot = t.bracket_slot
       WHERE m.id = v_match),
      (SELECT m.home_season_team_id FROM public.matches m WHERE m.id = v_match)
    );
    INSERT INTO public.__mig025_test_results VALUES (
      '8_penalty_rejects_non_draw', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    INSERT INTO public.__mig025_test_results VALUES (
      '8_penalty_rejects_non_draw',
      SQLERRM ILIKE '%drawn%' OR SQLERRM ILIKE '%empat%',
      SQLERRM
    );
  END;

  PERFORM public.__mig025_finish_knockout_match(v_match, 1, 1);
  PERFORM public.set_knockout_tie_penalty_winner(
    v_round_id,
    (SELECT m.bracket_slot FROM public.matches m WHERE m.id = v_match),
    (SELECT m.home_season_team_id FROM public.matches m WHERE m.id = v_match)
  );
  INSERT INTO public.__mig025_test_results VALUES (
    '9_penalty_accepts_draw',
    EXISTS (
      SELECT 1
      FROM public.season_knockout_ties t
      JOIN public.matches m
        ON m.knockout_round_id = t.knockout_round_id
       AND m.bracket_slot = t.bracket_slot
      WHERE m.id = v_match
        AND t.penalty_winner_season_team_id = m.home_season_team_id
    ),
    'penalty winner set'
  );

  -- Finish remaining round 1 ties + byes auto-resolve
  FOR v_match IN
    SELECT m.id
    FROM public.matches m
    WHERE m.knockout_round_id = v_round_id
      AND m.status = 'scheduled'
  LOOP
    PERFORM public.__mig025_finish_knockout_match(v_match, 3, 0);
  END LOOP;

  BEGIN
    PERFORM public.advance_knockout_round(season_ko4, 2);
    INSERT INTO public.__mig025_test_results VALUES (
      '10_advance_rejects_missing_round', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    INSERT INTO public.__mig025_test_results VALUES (
      '10_advance_rejects_missing_round', true, SQLERRM
    );
  END;

  -- Unresolve one slot by clearing a finished match score — use fresh season flow
  -- Instead test advance rejects when a slot unresolved before finishing all
  SELECT m.id INTO v_match
  FROM public.matches m
  WHERE m.knockout_round_id = v_round_id
    AND m.status = 'finished'
  LIMIT 1;
  UPDATE public.matches SET status = 'scheduled', home_score = NULL, away_score = NULL
  WHERE id = v_match;

  BEGIN
    PERFORM public.advance_knockout_round(season_ko4, 1);
    INSERT INTO public.__mig025_test_results VALUES (
      '11_advance_rejects_unresolved', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    INSERT INTO public.__mig025_test_results VALUES (
      '11_advance_rejects_unresolved',
      SQLERRM ILIKE '%Unresolved%',
      SQLERRM
    );
  END;

  PERFORM public.__mig025_finish_knockout_match(v_match, 2, 0);

  SELECT
    CASE
      WHEN t.penalty_winner_season_team_id IS NOT NULL THEN t.penalty_winner_season_team_id
      WHEN m.home_score > m.away_score THEN m.home_season_team_id
      ELSE m.away_season_team_id
    END
  INTO v_winner1
  FROM public.season_knockout_ties t
  JOIN public.matches m
    ON m.knockout_round_id = t.knockout_round_id
   AND m.bracket_slot = t.bracket_slot
   AND m.leg_number = 1
  WHERE t.knockout_round_id = v_round_id AND t.bracket_slot = 1;

  SELECT
    CASE
      WHEN t.penalty_winner_season_team_id IS NOT NULL THEN t.penalty_winner_season_team_id
      WHEN m.home_score > m.away_score THEN m.home_season_team_id
      ELSE m.away_season_team_id
    END
  INTO v_winner2
  FROM public.season_knockout_ties t
  JOIN public.matches m
    ON m.knockout_round_id = t.knockout_round_id
   AND m.bracket_slot = t.bracket_slot
   AND m.leg_number = 1
  WHERE t.knockout_round_id = v_round_id AND t.bracket_slot = 2;

  v_result := public.advance_knockout_round(season_ko4, 1);
  v_round2_id := (v_result->>'next_round_id')::uuid;

  SELECT t.home_season_team_id, t.away_season_team_id
  INTO v_final_home, v_final_away
  FROM public.season_knockout_ties t
  WHERE t.knockout_round_id = v_round2_id AND t.bracket_slot = 1;

  INSERT INTO public.__mig025_test_results VALUES (
    '12_bracket_pairing_respects_slots',
    v_final_home = v_winner1 AND v_final_away = v_winner2,
    format('home=%s away=%s w1=%s w2=%s', v_final_home, v_final_away, v_winner1, v_winner2)
  );

  SELECT m.id INTO v_match
  FROM public.matches m
  WHERE m.knockout_round_id = v_round2_id
  LIMIT 1;

  PERFORM public.schedule_match(
    v_match,
    field_a,
    timestamptz '2026-07-13 16:00:00+00'
  );
  INSERT INTO public.__mig025_test_results VALUES (
    '13_schedule_knockout_match',
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = v_match AND m.field_reservation_id IS NOT NULL
    ),
    'scheduled'
  );

  PERFORM public.__mig025_finish_knockout_match(v_match, 1, 0);
  v_result := public.advance_knockout_round(season_ko4, 2);
  v_champion := (v_result->>'champion_season_team_id')::uuid;
  INSERT INTO public.__mig025_test_results VALUES (
    '14_final_advance_returns_champion',
    v_result->>'is_final' = 'true'
      AND v_champion = public.get_season_knockout_champion(season_ko4),
    format('champion=%s', v_champion)
  );

  EXECUTE 'RESET ROLE';
END;
$$;

SELECT
  test_name,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result,
  details
FROM public.__mig025_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_fail integer;
BEGIN
  SELECT COUNT(*) INTO v_fail FROM public.__mig025_test_results WHERE NOT passed;
  IF v_fail > 0 THEN
    RAISE EXCEPTION '%/% tests FAILED', v_fail, (SELECT COUNT(*) FROM public.__mig025_test_results);
  END IF;
  RAISE NOTICE 'All % tests PASSED', (SELECT COUNT(*) FROM public.__mig025_test_results);
END;
$$;

DROP FUNCTION IF EXISTS public.__mig025_assert_bracket(uuid, integer, integer, text);
DROP FUNCTION IF EXISTS public.__mig025_finish_knockout_match(uuid, integer, integer);
