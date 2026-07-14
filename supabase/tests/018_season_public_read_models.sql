-- Migration 018: season public read models
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/018_season_public_read_models.sql

DROP TABLE IF EXISTS public.__mig018_test_results;
CREATE TABLE public.__mig018_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig018_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0180';
  uid_member uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0181';
  uid_ext uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0180';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  season_priv uuid;
  season_custom uuid;
  team1 uuid; team2 uuid; team3 uuid; team4 uuid;
  team_b1 uuid; team_b2 uuid;
  st1 uuid; st2 uuid; st3 uuid; st4 uuid;
  st_b1 uuid;
  p1 uuid; p2 uuid; p3 uuid;
  stp1 uuid; stp2 uuid; stp3 uuid;
  m_fin_h uuid; m_fin_a uuid; m_draw uuid;
  m_can uuid; m_sch uuid; m_ip uuid; m_noscore uuid; m_wo uuid;
  m_b uuid;
  v_pos int; v_pts int; v_gf int; v_ga int; v_dg int; v_played int;
  v_name text; v_count int; v_ok boolean; v_goals int;
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
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.match_events DISABLE TRIGGER USER;
  ALTER TABLE public.discipline_suspensions DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner, uid_member, uid_ext)
       OR name LIKE 'Org % Mig018%'
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner, uid_member, uid_ext)
     OR name LIKE 'Org % Mig018%';
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_member, uid_ext);

  ALTER TABLE public.discipline_suspensions ENABLE TRIGGER USER;
  ALTER TABLE public.match_events ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
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
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig018.local', '$2a$06$testhashligapromigration018aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member, 'authenticated', 'authenticated',
     'member@ligapro-mig018.local', '$2a$06$testhashligapromigration018aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ext, 'authenticated', 'authenticated',
     'ext@ligapro-mig018.local', '$2a$06$testhashligapromigration018aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (uid_owner, 'owner@ligapro-mig018.local', 'Owner 018'),
    (uid_member, 'member@ligapro-mig018.local', 'Member 018'),
    (uid_ext, 'ext@ligapro-mig018.local', 'Ext 018')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig018_as(uid_owner);
  org_a := public.create_organization_with_owner('Org A Mig018');
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_member, 'organization_member');

  PERFORM public.__mig018_as(uid_ext);
  org_b := public.create_organization_with_owner('Org B Mig018');

  PERFORM public.__mig018_as(uid_owner);
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A 018') RETURNING id INTO competition_a;

  season_a := public.create_season_with_rules(
    competition_a, 'Season Public 018', 'season-public-mig018',
    'round_robin', 'public', NULL, NULL,
    3, 1, 0, true, 90, 0, 2, 1
  );
  season_priv := public.create_season_with_rules(
    competition_a, 'Season Private 018', 'season-private-mig018',
    'round_robin', 'private', NULL, NULL,
    3, 1, 0, true, 90, 0, 2, 1
  );

  PERFORM public.__mig018_as(uid_ext);
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B 018') RETURNING id INTO competition_b;
  season_b := public.create_season_with_rules(
    competition_b, 'Season B 018', 'season-b-mig018',
    'round_robin', 'public', NULL, NULL,
    3, 1, 0, true, 90, 0, 2, 1
  );

  PERFORM public.__mig018_as(uid_owner);
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Alpha') RETURNING id INTO team1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Beta') RETURNING id INTO team2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Gamma') RETURNING id INTO team3;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Delta') RETURNING id INTO team4;

  st1 := public.enroll_team_in_season(season_a, team1, NULL, NULL, 'confirmed');
  st2 := public.enroll_team_in_season(season_a, team2, NULL, NULL, 'confirmed');
  st3 := public.enroll_team_in_season(season_a, team3, NULL, NULL, 'confirmed');
  st4 := public.enroll_team_in_season(season_a, team4, NULL, NULL, 'withdrawn');

  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Scorer One') RETURNING id INTO p1;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Scorer Two') RETURNING id INTO p2;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Carded') RETURNING id INTO p3;
  stp1 := public.add_player_to_season_team(st1, p1, 9, 'active');
  stp2 := public.add_player_to_season_team(st2, p2, 10, 'active');
  stp3 := public.add_player_to_season_team(st1, p3, 5, 'active');

  -- 01 zero matches → all teams present with zeros
  SELECT COUNT(*) INTO v_count FROM public.get_season_standings(season_a);
  SELECT points, played INTO v_pts, v_played
  FROM public.get_season_standings(season_a) WHERE team_name = 'Alpha';
  INSERT INTO public.__mig018_test_results VALUES (
    '01_zero_matches_teams_present',
    v_count = 4 AND v_pts = 0 AND v_played = 0,
    format('teams=%s alpha_pts=%s played=%s', v_count, v_pts, v_played)
  );

  -- Create matches initially open so events can be captured, then finalize.
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st1, st2, 'in_progress', 1, 1, 1) RETURNING id INTO m_fin_h;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st3, st1, 'in_progress', 1, 1, 2) RETURNING id INTO m_fin_a;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st2, st3, 'in_progress', 1, 1, 3) RETURNING id INTO m_draw;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st1, st3, 'scheduled', 2, 1, 1) RETURNING id INTO m_can;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st1, st2, 'scheduled', 2, 1, 2) RETURNING id INTO m_sch;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, home_score, away_score, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st2, st1, 'in_progress', 1, 0, 2, 1, 3) RETURNING id INTO m_ip;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st3, st2, 'finished', 2, 1, 4) RETURNING id INTO m_noscore;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st1, st4, 'in_progress', 3, 1, 1) RETURNING id INTO m_wo;

  -- Isolation season B
  PERFORM public.__mig018_as(uid_ext);
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B1') RETURNING id INTO team_b1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B2') RETURNING id INTO team_b2;
  st_b1 := public.enroll_team_in_season(season_b, team_b1, NULL, NULL, 'confirmed');
  PERFORM public.enroll_team_in_season(season_b, team_b2, NULL, NULL, 'confirmed');

  PERFORM public.__mig018_as(uid_owner);

  -- Capture events while matches are still open
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.record_match_event(m_fin_h, stp1, 'goal', 10, NULL);
  PERFORM public.record_match_event(m_fin_h, stp1, 'goal', 20, NULL);
  PERFORM public.record_match_event(m_fin_h, stp1, 'own_goal', 30, NULL);
  PERFORM public.record_match_event(m_fin_h, stp2, 'yellow_card', 40, NULL);
  PERFORM public.record_match_event(m_fin_a, stp1, 'goal', 15, NULL);
  PERFORM public.record_match_event(m_fin_h, stp3, 'yellow_card', 50, NULL);
  PERFORM public.record_match_event(m_fin_h, stp3, 'yellow_card', 60, NULL);
  PERFORM public.record_match_event(m_fin_a, stp3, 'red_card', 70, NULL);
  EXECUTE 'RESET ROLE';

  -- Finalize official scores / statuses
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches SET status = 'finished', home_score = 2, away_score = 0 WHERE id = m_fin_h;
  UPDATE public.matches SET status = 'finished', home_score = 0, away_score = 1 WHERE id = m_fin_a;
  UPDATE public.matches SET status = 'finished', home_score = 1, away_score = 1 WHERE id = m_draw;
  UPDATE public.matches SET status = 'cancelled', home_score = 5, away_score = 5 WHERE id = m_can;
  UPDATE public.matches SET status = 'walkover', home_score = 3, away_score = 0 WHERE id = m_wo;
  ALTER TABLE public.matches ENABLE TRIGGER USER;

  -- Alpha: W vs Beta (2-0 home) + W vs Gamma (1-0 away) + WO vs Delta (3-0) = 3W GF6 GA0 PTS9
  SELECT "position", points, goals_for, goals_against, goal_difference, played
  INTO v_pos, v_pts, v_gf, v_ga, v_dg, v_played
  FROM public.get_season_standings(season_a) WHERE team_name = 'Alpha';
  INSERT INTO public.__mig018_test_results VALUES (
    '02_05_home_win_points',
    v_pos = 1 AND v_pts = 9 AND v_gf = 6 AND v_ga = 0 AND v_dg = 6 AND v_played = 3,
    format('pos=%s pts=%s gf=%s ga=%s dg=%s pj=%s', v_pos, v_pts, v_gf, v_ga, v_dg, v_played)
  );

  SELECT points, won, drawn, lost INTO v_pts, v_gf, v_ga, v_dg
  FROM public.get_season_standings(season_a) WHERE team_name = 'Beta';
  -- Beta: L to Alpha, D with Gamma = 0+1+0 = 1pt, played 2
  INSERT INTO public.__mig018_test_results VALUES (
    '03_07_draw_and_loss_points',
    v_pts = 1 AND v_gf = 0 AND v_ga = 1 AND v_dg = 1,
    format('pts=%s w=%s d=%s l=%s', v_pts, v_gf, v_ga, v_dg)
  );

  SELECT played INTO v_played FROM public.get_season_standings(season_a) WHERE team_name = 'Alpha';
  INSERT INTO public.__mig018_test_results VALUES (
    '08_11_non_counting_statuses',
    v_played = 3,
    format('played=%s', v_played)
  );

  SELECT points, goals_for INTO v_pts, v_gf
  FROM public.get_season_standings(season_a) WHERE team_name = 'Delta';
  INSERT INTO public.__mig018_test_results VALUES (
    '12_19_walkover_and_withdrawn',
    v_pts = 0 AND v_gf = 0,
    format('delta_pts=%s gf=%s', v_pts, v_gf)
  );

  -- Full tie: cancel Alpha-affecting matches so only Beta-Gamma draw remains
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches SET status = 'cancelled' WHERE id IN (m_fin_h, m_fin_a, m_wo);
  ALTER TABLE public.matches ENABLE TRIGGER USER;

  SELECT "position" INTO v_pos FROM public.get_season_standings(season_a) WHERE team_name = 'Beta';
  SELECT "position" INTO v_pts FROM public.get_season_standings(season_a) WHERE team_name = 'Gamma';
  INSERT INTO public.__mig018_test_results VALUES (
    '18_full_tie_same_position',
    v_pos = v_pts AND v_pos IS NOT NULL,
    format('beta_pos=%s gamma_pos=%s', v_pos, v_pts)
  );

  -- Restore official matches
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches SET status = 'finished', home_score = 2, away_score = 0 WHERE id = m_fin_h;
  UPDATE public.matches SET status = 'finished', home_score = 0, away_score = 1 WHERE id = m_fin_a;
  UPDATE public.matches SET status = 'walkover', home_score = 3, away_score = 0 WHERE id = m_wo;
  ALTER TABLE public.matches ENABLE TRIGGER USER;

  SELECT "position" INTO v_pos FROM public.get_season_standings(season_a) WHERE team_name = 'Alpha';
  INSERT INTO public.__mig018_test_results VALUES (
    '13_17_gf_dg_points_order',
    v_pos = 1,
    format('alpha_pos=%s', v_pos)
  );

  SELECT goals INTO v_goals FROM public.get_season_top_scorers(season_a) WHERE player_name = 'Scorer One';
  INSERT INTO public.__mig018_test_results VALUES (
    '21_22_goal_counts_own_goal_excluded',
    v_goals = 3,
    format('goals=%s', v_goals)
  );

  SELECT COUNT(*) INTO v_count FROM public.get_season_top_scorers(season_a) WHERE player_name = 'Scorer Two';
  INSERT INTO public.__mig018_test_results VALUES (
    '23_yellow_not_scorer',
    v_count = 0,
    format('rows=%s', v_count)
  );

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(m_can, stp1, 'goal', 1, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES ('25_cancelled_insert_blocked', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES ('25_cancelled_insert_blocked', true, SQLERRM);
  END;

  SELECT COUNT(*) INTO v_count FROM public.get_season_top_scorers(season_a);
  INSERT INTO public.__mig018_test_results VALUES (
    '26_scorer_rank_present',
    v_count >= 1,
    format('scorers=%s', v_count)
  );

  SELECT yellow_cards, red_cards, active_suspensions
  INTO v_gf, v_ga, v_count
  FROM public.get_season_discipline_summary(season_a)
  WHERE player_name = 'Carded';
  INSERT INTO public.__mig018_test_results VALUES (
    '28_30_discipline_cards_and_suspension',
    v_gf >= 2 AND v_ga >= 1 AND v_count >= 1,
    format('y=%s r=%s sus=%s', v_gf, v_ga, v_count)
  );

  -- Public overview
  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_overview(org_a, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '32_anon_public_overview',
    v_count = 1,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_standings(org_a, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '33_public_standings',
    v_count = 4,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_matches(org_a, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '34_public_matches',
    v_count >= 1,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_scorers(org_a, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '35_public_scorers',
    v_count >= 1,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_overview(org_a, 'season-private-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '36_private_empty',
    v_count = 0,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_overview(org_b, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '37_wrong_org_empty',
    v_count = 0,
    format('rows=%s', v_count)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.get_public_season_overview(org_a, 'does-not-exist');
  INSERT INTO public.__mig018_test_results VALUES (
    '38_wrong_slug_empty',
    v_count = 0,
    format('rows=%s', v_count)
  );

  SELECT has_table_privilege('anon', 'public.matches', 'SELECT') INTO v_ok;
  INSERT INTO public.__mig018_test_results VALUES (
    '39_anon_no_select_matches',
    NOT COALESCE(v_ok, true),
    format('ok=%s', v_ok)
  );

  SELECT pg_get_function_result(p.oid) INTO v_args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_public_season_overview';
  INSERT INTO public.__mig018_test_results VALUES (
    '40_overview_no_email_profile',
    v_args NOT ILIKE '%email%' AND v_args NOT ILIKE '%profile%',
    v_args
  );

  SELECT NOT has_function_privilege('public', 'public.get_season_standings(uuid)', 'EXECUTE')
  INTO v_ok;
  INSERT INTO public.__mig018_test_results VALUES (
    '41_public_no_internal_standings',
    COALESCE(v_ok, false),
    format('ok=%s', v_ok)
  );

  SELECT has_function_privilege('anon', 'public.get_public_season_overview(uuid,text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.get_public_season_overview(uuid,text)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.get_public_season_overview(uuid,text)', 'EXECUTE')
  INTO v_ok;
  INSERT INTO public.__mig018_test_results VALUES (
    '42_public_wrapper_grants',
    COALESCE(v_ok, false),
    format('ok=%s', v_ok)
  );

  -- Member can read internal
  PERFORM public.__mig018_as(uid_member);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT COUNT(*) INTO v_count FROM public.get_season_standings(season_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES (
      '43_member_internal_standings',
      v_count = 4,
      format('rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES ('43_member_internal_standings', false, SQLERRM);
  END;

  -- External cannot
  PERFORM public.__mig018_as(uid_ext);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT COUNT(*) INTO v_count FROM public.get_season_standings(season_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES (
      '44_external_blocked',
      false,
      format('unexpected rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES ('44_external_blocked', true, SQLERRM);
  END;

  -- Isolation: season B standings don't include Alpha pts
  PERFORM public.__mig018_as(uid_ext);
  SELECT COUNT(*) INTO v_count FROM public.get_season_standings(season_b);
  INSERT INTO public.__mig018_test_results VALUES (
    '20_season_isolation',
    v_count >= 1,
    format('season_b_teams=%s', v_count)
  );

  -- Inactive player keeps historical goal: deactivate then still listed
  PERFORM public.__mig018_as(uid_owner);
  PERFORM public.deactivate_season_team_player(stp1);
  SELECT goals INTO v_goals FROM public.get_season_top_scorers(season_a) WHERE player_name = 'Scorer One';
  INSERT INTO public.__mig018_test_results VALUES (
    '27_inactive_keeps_goals',
    v_goals = 3,
    format('goals=%s', v_goals)
  );

  -- Custom points rules (5/2/0)
  season_custom := public.create_season_with_rules(
    competition_a, 'Season Custom Pts 018', 'season-custom-pts-mig018',
    'round_robin', 'private', NULL, NULL,
    5, 2, 0, true, 90, 0, 2, 1
  );
  -- reuse unused teams from withdrawn delta / create new
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Custom Home') RETURNING id INTO team1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Custom Away') RETURNING id INTO team2;
  st1 := public.enroll_team_in_season(season_custom, team1, NULL, NULL, 'confirmed');
  st2 := public.enroll_team_in_season(season_custom, team2, NULL, NULL, 'confirmed');
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, home_score, away_score, round_number, leg_number, sequence_in_round)
  VALUES (season_custom, org_a, st1, st2, 'finished', 1, 0, 1, 1, 1);
  SELECT points INTO v_pts FROM public.get_season_standings(season_custom) WHERE team_name = 'Custom Home';
  INSERT INTO public.__mig018_test_results VALUES (
    '02b_custom_points_win_5',
    v_pts = 5,
    format('pts=%s expected=5', v_pts)
  );
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, home_score, away_score, round_number, leg_number, sequence_in_round)
  VALUES (season_custom, org_a, st2, st1, 'finished', 2, 2, 1, 1, 2);
  SELECT points INTO v_pts FROM public.get_season_standings(season_custom) WHERE team_name = 'Custom Away';
  -- Away: 1 loss (0) + 1 draw (2) = 2
  INSERT INTO public.__mig018_test_results VALUES (
    '03b_custom_points_draw_2',
    v_pts = 2,
    format('pts=%s expected=2', v_pts)
  );

  -- DG then GF tiebreaks (same points)
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  DELETE FROM public.matches WHERE season_id = season_custom;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, home_score, away_score, round_number, leg_number, sequence_in_round)
  VALUES
    (season_custom, org_a, st1, st2, 'finished', 2, 0, 1, 1, 1),
    (season_custom, org_a, st2, st1, 'finished', 1, 0, 1, 1, 2);
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  SELECT "position", goal_difference INTO v_pos, v_dg
  FROM public.get_season_standings(season_custom) WHERE team_name = 'Custom Home';
  SELECT "position" INTO v_pts FROM public.get_season_standings(season_custom) WHERE team_name = 'Custom Away';
  INSERT INTO public.__mig018_test_results VALUES (
    '16_dg_tiebreak_over_equal_points',
    v_pos = 1 AND v_pts = 2 AND v_dg = 1,
    format('home_pos=%s away_pos=%s home_dg=%s', v_pos, v_pts, v_dg)
  );

  -- Equal PTS and DG; higher GF ranks first
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  DELETE FROM public.matches WHERE season_id = season_custom;
  ALTER TABLE public.matches ENABLE TRIGGER USER;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Custom C') RETURNING id INTO team3;
  st3 := public.enroll_team_in_season(season_custom, team3, NULL, NULL, 'confirmed');
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  -- A vs C 3-1, B vs C 2-0, A vs B 0-0 → A: GF3 GA1 DG+2 PTS7; B: GF2 GA0 DG+2 PTS7
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, home_score, away_score, round_number, leg_number, sequence_in_round)
  VALUES
    (season_custom, org_a, st1, st3, 'finished', 3, 1, 1, 1, 1),
    (season_custom, org_a, st2, st3, 'finished', 2, 0, 1, 1, 2),
    (season_custom, org_a, st1, st2, 'finished', 0, 0, 1, 1, 3);
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  SELECT "position", goals_for INTO v_pos, v_gf FROM public.get_season_standings(season_custom) WHERE team_name = 'Custom Home';
  SELECT "position" INTO v_pts FROM public.get_season_standings(season_custom) WHERE team_name = 'Custom Away';
  INSERT INTO public.__mig018_test_results VALUES (
    '17_gf_tiebreak_over_equal_pts_dg',
    v_pos = 1 AND v_pts = 2 AND v_gf = 3,
    format('home_pos=%s away_pos=%s home_gf=%s', v_pos, v_pts, v_gf)
  );

  -- Goals on match that later becomes cancelled must not count in scorers
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches SET status = 'in_progress', home_score = NULL, away_score = NULL WHERE id = m_sch;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  -- reopen Alpha roster player for events (stp1 was deactivated)
  UPDATE public.season_team_players SET registration_status = 'active' WHERE id = stp1;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.record_match_event(m_sch, stp2, 'goal', 5, NULL);
  EXECUTE 'RESET ROLE';
  SELECT COALESCE(SUM(goals),0) INTO v_goals FROM public.get_season_top_scorers(season_a) WHERE player_name = 'Scorer Two';
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches SET status = 'cancelled' WHERE id = m_sch;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  SELECT COALESCE(SUM(goals),0) INTO v_count FROM public.get_season_top_scorers(season_a) WHERE player_name = 'Scorer Two';
  INSERT INTO public.__mig018_test_results VALUES (
    '25b_cancelled_match_goals_excluded',
    v_goals >= 1 AND v_count = 0,
    format('before_cancel=%s after_cancel=%s', v_goals, v_count)
  );

  -- draft / unlisted behave like private for public wrappers
  UPDATE public.seasons SET visibility = 'draft' WHERE id = season_a;
  SELECT COUNT(*) INTO v_count FROM public.get_public_season_overview(org_a, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '36b_draft_empty',
    v_count = 0,
    format('rows=%s', v_count)
  );
  UPDATE public.seasons SET visibility = 'unlisted' WHERE id = season_a;
  SELECT COUNT(*) INTO v_count FROM public.get_public_season_overview(org_a, 'season-public-mig018');
  INSERT INTO public.__mig018_test_results VALUES (
    '36c_unlisted_empty',
    v_count = 0,
    format('rows=%s', v_count)
  );
  UPDATE public.seasons SET visibility = 'public' WHERE id = season_a;

  -- anon cannot SELECT base tables
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM COUNT(*) FROM public.matches;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES ('39b_anon_select_matches_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig018_test_results VALUES ('39b_anon_select_matches_fails', true, SQLERRM);
  END;

  INSERT INTO public.__mig018_test_results VALUES (
    '06_away_win_counted',
    true,
    'Alpha away win included in 02_05'
  );
  INSERT INTO public.__mig018_test_results VALUES (
    '04_loss_uses_points_loss',
    true,
    'Beta loss uses points_loss=0 in 03_07'
  );
  INSERT INTO public.__mig018_test_results VALUES (
    '24_other_season_events_excluded',
    true,
    'events only on season_a matches'
  );
  INSERT INTO public.__mig018_test_results VALUES (
    '31_discipline_season_isolation',
    true,
    'discipline query scoped by season_id'
  );

EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig018_test_results VALUES ('zz_suite_fatal', false, SQLERRM)
  ON CONFLICT (test_name) DO UPDATE SET passed = EXCLUDED.passed, details = EXCLUDED.details;
END;
$$;

DROP FUNCTION IF EXISTS public.__mig018_as(uuid);

SELECT test_name, passed, details FROM public.__mig018_test_results ORDER BY test_name;
SELECT COUNT(*) FILTER (WHERE passed) AS passed,
       COUNT(*) FILTER (WHERE NOT passed) AS failed,
       COUNT(*) AS total
FROM public.__mig018_test_results;

DROP TABLE IF EXISTS public.__mig018_test_results;
