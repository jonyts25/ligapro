-- Migration 026: groups_knockout phase isolation tests
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/026_groups_knockout.sql

DROP TABLE IF EXISTS public.__mig026_test_results;
CREATE TABLE public.__mig026_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig026_test_results DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0260';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0260';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_gk uuid;
  season_league uuid;
  season_bill uuid;
  season_other uuid;
  group_a uuid;
  group_b uuid;
  group_c uuid;
  team1 uuid;
  team2 uuid;
  team3 uuid;
  team4 uuid;
  team5 uuid;
  team6 uuid;
  team_l1 uuid;
  team_l2 uuid;
  team_other uuid;
  st_a1 uuid;
  st_a2 uuid;
  st_b1 uuid;
  st_b2 uuid;
  st_l1 uuid;
  st_l2 uuid;
  st_bill1 uuid;
  st_bill2 uuid;
  st_other uuid;
  v_count integer;
  v_match uuid;
  v_err text;
  v_result jsonb;
  v_round_id uuid;
  v_same_group boolean;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
    'owner-a@ligapro-mig026.local', '$2a$06$testhashligapromigration026aa', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
    'owner-b@ligapro-mig026.local', '$2a$06$testhashligapromigration026bb', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig026');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Copa Grupos') RETURNING id INTO competition_a;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'GK 2026', 'gk-026', 'groups_knockout', 'public'
  ) RETURNING id INTO season_gk;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'Liga Simple', 'liga-026', 'round_robin', 'public'
  ) RETURNING id INTO season_league;

  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_a, org_a, 'GK Bill', 'gk-bill-026', 'groups_knockout', 'public'
  ) RETURNING id INTO season_bill;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'GK A1') RETURNING id INTO team1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'GK A2') RETURNING id INTO team2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'GK B1') RETURNING id INTO team3;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'GK B2') RETURNING id INTO team4;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'GK C1') RETURNING id INTO team5;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'GK C2') RETURNING id INTO team6;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Liga L1') RETURNING id INTO team_l1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Liga L2') RETURNING id INTO team_l2;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado'
  WHERE id IN (season_gk, season_league);

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  st_a1 := public.enroll_team_in_season(season_gk, team1, NULL, NULL, 'confirmed');
  st_a2 := public.enroll_team_in_season(season_gk, team2, NULL, NULL, 'confirmed');
  st_b1 := public.enroll_team_in_season(season_gk, team3, NULL, NULL, 'confirmed');
  st_b2 := public.enroll_team_in_season(season_gk, team4, NULL, NULL, 'confirmed');

  st_l1 := public.enroll_team_in_season(season_league, team_l1, NULL, NULL, 'confirmed');
  st_l2 := public.enroll_team_in_season(season_league, team_l2, NULL, NULL, 'confirmed');
  st_bill1 := public.enroll_team_in_season(season_bill, team1, NULL, NULL, 'confirmed');
  st_bill2 := public.enroll_team_in_season(season_bill, team2, NULL, NULL, 'confirmed');

  UPDATE public.season_rules
  SET groups_advance_per_group = 1
  WHERE season_id = season_gk;

  -- set_season_groups atomic replace
  PERFORM public.set_season_groups(
    season_gk,
    '["Grupo A", "Grupo B"]'::jsonb
  );

  SELECT id INTO group_a FROM public.season_groups
  WHERE season_id = season_gk AND name = 'Grupo A';
  SELECT id INTO group_b FROM public.season_groups
  WHERE season_id = season_gk AND name = 'Grupo B';

  PERFORM public.set_season_groups(
    season_gk,
    '["Grupo A", "Grupo B", "Grupo C"]'::jsonb
  );

  SELECT COUNT(*) INTO v_count FROM public.season_groups WHERE season_id = season_gk;
  INSERT INTO public.__mig026_test_results VALUES (
    '1_set_season_groups_replace_adds_group',
    v_count = 3,
    format('groups=%s', v_count)
  );

  SELECT id INTO group_c FROM public.season_groups
  WHERE season_id = season_gk AND name = 'Grupo C';

  PERFORM public.assign_teams_to_groups(
    season_gk,
    jsonb_build_array(
      jsonb_build_object('season_team_id', st_a1, 'group_id', group_a),
      jsonb_build_object('season_team_id', st_a2, 'group_id', group_a),
      jsonb_build_object('season_team_id', st_b1, 'group_id', group_b),
      jsonb_build_object('season_team_id', st_b2, 'group_id', group_b)
    )
  );

  -- Group fixture for A
  PERFORM public.create_season_round_robin_fixture(
    season_gk,
    'single',
    jsonb_build_array(
      jsonb_build_object(
        'home_season_team_id', st_a1,
        'away_season_team_id', st_a2,
        'leg_number', 1,
        'round_number', 1,
        'sequence_in_round', 1
      )
    ),
    group_a
  );

  -- Atomic replace blocked when group has matches
  BEGIN
    PERFORM public.set_season_groups(season_gk, '["Grupo B"]'::jsonb);
    INSERT INTO public.__mig026_test_results VALUES (
      '2_set_season_groups_blocks_remove_with_matches', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    SELECT COUNT(*) INTO v_count FROM public.season_groups WHERE season_id = season_gk;
    INSERT INTO public.__mig026_test_results VALUES (
      '2_set_season_groups_blocks_remove_with_matches',
      v_err ILIKE '%matches%' AND v_count = 3,
      format('err=%s groups=%s', v_err, v_count)
    );
  END;

  -- Org B cross-org isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig026');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_b, org_b, 'GK B', 'gk-b-026', 'groups_knockout', 'public'
  ) RETURNING id INTO season_other;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Other') RETURNING id INTO team_other;
  st_other := public.enroll_team_in_season(season_other, team_other, NULL, NULL, 'confirmed');
  PERFORM public.set_season_groups(season_other, '["Grupo X"]'::jsonb);
  SELECT id INTO group_a FROM public.season_groups
  WHERE season_id = season_other AND name = 'Grupo X';

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.assign_teams_to_groups(
      season_gk,
      jsonb_build_array(
        jsonb_build_object('season_team_id', st_other, 'group_id', group_b)
      )
    );
    INSERT INTO public.__mig026_test_results VALUES (
      '3_assign_teams_rejects_cross_org', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig026_test_results VALUES (
      '3_assign_teams_rejects_cross_org',
      v_err ILIKE '%season%organization%',
      v_err
    );
  END;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
      true
    );
    PERFORM public.assign_teams_to_groups(
      season_other,
      jsonb_build_array(
        jsonb_build_object('season_team_id', st_a1, 'group_id', group_a)
      )
    );
    INSERT INTO public.__mig026_test_results VALUES (
      '4_assign_teams_rejects_cross_season', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig026_test_results VALUES (
      '4_assign_teams_rejects_cross_season',
      v_err ILIKE '%season%organization%',
      v_err
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );

  -- Group-scoped fixture
  SELECT id INTO group_a FROM public.season_groups
  WHERE season_id = season_gk AND name = 'Grupo A';
  SELECT id INTO group_b FROM public.season_groups
  WHERE season_id = season_gk AND name = 'Grupo B';

  PERFORM public.create_season_round_robin_fixture(
    season_gk,
    'single',
    jsonb_build_array(
      jsonb_build_object(
        'home_season_team_id', st_b1,
        'away_season_team_id', st_b2,
        'leg_number', 1,
        'round_number', 1,
        'sequence_in_round', 1
      )
    ),
    group_b
  );

  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  WHERE m.season_id = season_gk AND m.season_group_id = group_a;
  INSERT INTO public.__mig026_test_results VALUES (
    '5_group_fixture_only_group_teams',
    v_count = 1,
    format('group_a_matches=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  WHERE m.season_id = season_gk
    AND m.season_group_id = group_b
    AND (m.home_season_team_id NOT IN (st_b1, st_b2)
      OR m.away_season_team_id NOT IN (st_b1, st_b2));
  INSERT INTO public.__mig026_test_results VALUES (
    '6_group_fixture_teams_scoped',
    v_count = 0,
    format('foreign_teams=%s', v_count)
  );

  -- League simple regression (no p_group_id)
  PERFORM public.create_season_round_robin_fixture(
    season_league,
    'single',
    jsonb_build_array(
      jsonb_build_object(
        'home_season_team_id', st_l1,
        'away_season_team_id', st_l2,
        'leg_number', 1,
        'round_number', 1,
        'sequence_in_round', 1
      )
    )
  );
  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  WHERE m.season_id = season_league AND m.season_group_id IS NULL;
  INSERT INTO public.__mig026_test_results VALUES (
    '7_league_fixture_no_regression',
    v_count = 1,
    format('league_matches=%s', v_count)
  );

  -- Standings isolation
  SELECT id INTO v_match FROM public.matches
  WHERE season_id = season_gk AND season_group_id = group_a LIMIT 1;
  PERFORM public.update_match_result(v_match, 'finished', 2, 0);

  SELECT id INTO v_match FROM public.matches
  WHERE season_id = season_gk AND season_group_id = group_b LIMIT 1;
  PERFORM public.update_match_result(v_match, 'finished', 0, 1);

  SELECT COUNT(*) INTO v_count
  FROM public.get_season_standings(season_gk, group_a);
  INSERT INTO public.__mig026_test_results VALUES (
    '8_standings_group_a_row_count',
    v_count = 2,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_season_standings(season_gk, group_a) s
  WHERE s.season_team_id NOT IN (st_a1, st_a2);
  INSERT INTO public.__mig026_test_results VALUES (
    '9_standings_group_a_isolated',
    v_count = 0,
    format('foreign=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_season_standings(season_gk, group_b) s
  WHERE s.season_team_id NOT IN (st_b1, st_b2);
  INSERT INTO public.__mig026_test_results VALUES (
    '10_standings_group_b_isolated',
    v_count = 0,
    format('foreign=%s', v_count)
  );

  -- Incomplete fixture blocks knockout
  UPDATE public.matches
  SET status = 'scheduled', home_score = NULL, away_score = NULL
  WHERE season_id = season_gk AND season_group_id = group_b;

  BEGIN
    PERFORM public.generate_knockout_from_groups(season_gk);
    INSERT INTO public.__mig026_test_results VALUES (
      '11_knockout_rejects_incomplete_fixture', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig026_test_results VALUES (
      '11_knockout_rejects_incomplete_fixture',
      v_err ILIKE '%result%' OR v_err ILIKE '%fixture%',
      v_err
    );
  END;

  -- Complete fixtures and generate knockout (G=2, K=1 cross: A1 vs B1)
  SELECT id INTO v_match FROM public.matches
  WHERE season_id = season_gk AND season_group_id = group_b LIMIT 1;
  PERFORM public.update_match_result(v_match, 'finished', 0, 1);

  -- Drop empty Grupo C so only groups with teams are considered
  PERFORM public.set_season_groups(
    season_gk,
    '["Grupo A", "Grupo B"]'::jsonb
  );

  UPDATE public.season_rules SET groups_advance_per_group = 1 WHERE season_id = season_gk;

  v_result := public.generate_knockout_from_groups(season_gk);
  v_round_id := (v_result->>'round_id')::uuid;

  SELECT EXISTS (
    SELECT 1
    FROM public.season_knockout_ties t
    JOIN public.season_teams h ON h.id = t.home_season_team_id
    JOIN public.season_teams a ON a.id = t.away_season_team_id
    WHERE t.knockout_round_id = v_round_id
      AND t.away_season_team_id IS NOT NULL
      AND h.season_group_id = a.season_group_id
  ) INTO v_same_group;

  INSERT INTO public.__mig026_test_results VALUES (
    '12_knockout_r1_no_same_group_when_cross',
    NOT v_same_group,
    format('same_group_pair=%s', v_same_group)
  );

  -- Billing gate on group fixture
  BEGIN
    PERFORM public.create_season_round_robin_fixture(
      season_bill,
      'single',
      jsonb_build_array(
        jsonb_build_object(
          'home_season_team_id', st_bill1,
          'away_season_team_id', st_bill2,
          'leg_number', 1,
          'round_number', 1,
          'sequence_in_round', 1
        )
      )
    );
    INSERT INTO public.__mig026_test_results VALUES (
      '13_billing_lock_blocks_group_fixture', false, 'expected failure'
    );
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig026_test_results VALUES (
      '13_billing_lock_blocks_group_fixture',
      v_err ILIKE '%facturaci%n%',
      v_err
    );
  END;
END;
$$;

SELECT
  test_name,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
  details
FROM public.__mig026_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM public.__mig026_test_results;
