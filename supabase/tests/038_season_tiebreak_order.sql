-- Migration 038: season tiebreak order tests
--
-- PREREQUISITE: apply the MIGRATION first (not this file):
--   supabase/migrations/20260928100000_season_tiebreak_order.sql
--
-- Run tests:
--   npx supabase db query --linked -f supabase/tests/038_season_tiebreak_order.sql

DROP TABLE IF EXISTS public.__mig038_test_results;
CREATE TABLE public.__mig038_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig038_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig038_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0380';
  org_id uuid;
  competition_id uuid;
  season_id uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
  team_d uuid;
  st_a uuid;
  st_b uuid;
  st_c uuid;
  st_d uuid;
  pos_a integer;
  pos_b integer;
  pos_a2 integer;
  pos_b2 integer;
  v_err text;
BEGIN
  DELETE FROM public.organizations WHERE name = 'Org Mig038 Tiebreak';
  DELETE FROM auth.users WHERE id = uid_owner;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
    'owner@ligapro-mig038.local', '$2a$06$testhashligapromigration038aa', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (uid_owner, 'owner@ligapro-mig038.local', 'Owner 038')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig038_as(uid_owner);
  org_id := public.create_organization_with_owner('Org Mig038 Tiebreak');

  INSERT INTO public.competitions (organization_id, name, is_youth)
  VALUES (org_id, 'Torneo 038', false)
  RETURNING id INTO competition_id;

  INSERT INTO public.seasons (
    organization_id, competition_id, name, slug, format_type, visibility
  ) VALUES (
    org_id, competition_id, 'Temporada 038', 'temporada-038', 'round_robin', 'public'
  ) RETURNING id INTO season_id;

  INSERT INTO public.teams (organization_id, name) VALUES
    (org_id, 'Alto GD'),
    (org_id, 'Mas Victorias'),
    (org_id, 'Rival C'),
    (org_id, 'Rival D')
  RETURNING id INTO team_a;

  SELECT id INTO team_b FROM public.teams WHERE organization_id = org_id AND name = 'Mas Victorias';
  SELECT id INTO team_c FROM public.teams WHERE organization_id = org_id AND name = 'Rival C';
  SELECT id INTO team_d FROM public.teams WHERE organization_id = org_id AND name = 'Rival D';

  INSERT INTO public.season_teams (organization_id, season_id, team_id, display_name)
  VALUES
    (org_id, season_id, team_a, 'Alto GD'),
    (org_id, season_id, team_b, 'Mas Victorias'),
    (org_id, season_id, team_c, 'Rival C'),
    (org_id, season_id, team_d, 'Rival D')
  RETURNING id INTO st_a;

  SELECT id INTO st_b FROM public.season_teams WHERE season_id = season_id AND team_id = team_b;
  SELECT id INTO st_c FROM public.season_teams WHERE season_id = season_id AND team_id = team_c;
  SELECT id INTO st_d FROM public.season_teams WHERE season_id = season_id AND team_id = team_d;

  ALTER TABLE public.matches DISABLE TRIGGER USER;

  -- Alto GD: 6 pts, GD=3, GF=10, GA=7, won=2
  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id,
    status, home_score, away_score
  ) VALUES
    (org_id, season_id, st_a, st_c, 'finished', 4, 2),
    (org_id, season_id, st_a, st_d, 'finished', 6, 5);

  -- Mas Victorias: 6 pts, GD=1, GF=8, GA=7, won=3
  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id,
    status, home_score, away_score
  ) VALUES
    (org_id, season_id, st_b, st_c, 'finished', 3, 2),
    (org_id, season_id, st_b, st_d, 'finished', 3, 2),
    (org_id, season_id, st_b, st_a, 'finished', 2, 1);

  ALTER TABLE public.matches ENABLE TRIGGER USER;

  SELECT "position" INTO pos_a
  FROM public.get_season_standings(season_id)
  WHERE team_name = 'Alto GD';

  SELECT "position" INTO pos_b
  FROM public.get_season_standings(season_id)
  WHERE team_name = 'Mas Victorias';

  INSERT INTO public.__mig038_test_results VALUES (
    '01_default_goal_difference_first',
    pos_a = 1 AND pos_b = 2,
    format('alto=%s mas=%s', pos_a, pos_b)
  );

  PERFORM public.update_season_tiebreak_order(
    season_id,
    ARRAY['wins', 'goal_difference', 'goals_for', 'goals_against']::text[]
  );

  SELECT "position" INTO pos_a2
  FROM public.get_season_standings(season_id)
  WHERE team_name = 'Alto GD';

  SELECT "position" INTO pos_b2
  FROM public.get_season_standings(season_id)
  WHERE team_name = 'Mas Victorias';

  INSERT INTO public.__mig038_test_results VALUES (
    '02_reordered_wins_first',
    pos_b2 = 1 AND pos_a2 = 2,
    format('alto=%s mas=%s', pos_a2, pos_b2)
  );

  -- Wins tiebreaker: same pts/gd/gf/ga, different wins -> distinct positions
  DELETE FROM public.matches WHERE season_id = season_id;

  ALTER TABLE public.matches DISABLE TRIGGER USER;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id,
    status, home_score, away_score
  ) VALUES
    (org_id, season_id, st_a, st_c, 'finished', 3, 1),
    (org_id, season_id, st_a, st_d, 'finished', 2, 1),
    (org_id, season_id, st_b, st_c, 'finished', 2, 0),
    (org_id, season_id, st_b, st_d, 'finished', 1, 1),
    (org_id, season_id, st_b, st_c, 'finished', 1, 1),
    (org_id, season_id, st_b, st_d, 'finished', 1, 1);

  ALTER TABLE public.matches ENABLE TRIGGER USER;

  UPDATE public.season_rules
  SET tiebreak_order = ARRAY['goal_difference', 'goals_for', 'goals_against', 'wins']::text[]
  WHERE season_id = season_id;

  SELECT "position" INTO pos_a
  FROM public.get_season_standings(season_id)
  WHERE team_name = 'Alto GD';

  SELECT "position" INTO pos_b
  FROM public.get_season_standings(season_id)
  WHERE team_name = 'Mas Victorias';

  INSERT INTO public.__mig038_test_results VALUES (
    '03_wins_breaks_old_three_way_tie',
    pos_a = 1 AND pos_b = 2,
    format('alto=%s mas=%s', pos_a, pos_b)
  );

  BEGIN
    PERFORM public.update_season_tiebreak_order(
      season_id,
      ARRAY['goal_difference', 'goals_for']::text[]
    );
    INSERT INTO public.__mig038_test_results VALUES (
      '04_reject_incomplete_array', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig038_test_results VALUES (
      '04_reject_incomplete_array',
      v_err ILIKE '%invalid tiebreak%',
      v_err
    );
  END;

  BEGIN
    PERFORM public.update_season_tiebreak_order(
      season_id,
      ARRAY['goal_difference', 'goal_difference', 'goals_for', 'wins']::text[]
    );
    INSERT INTO public.__mig038_test_results VALUES (
      '05_reject_duplicate_values', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig038_test_results VALUES (
      '05_reject_duplicate_values',
      v_err ILIKE '%invalid tiebreak%',
      v_err
    );
  END;

  BEGIN
    PERFORM public.update_season_tiebreak_order(
      season_id,
      ARRAY['goal_difference', 'goals_for', 'goals_against', 'head_to_head']::text[]
    );
    INSERT INTO public.__mig038_test_results VALUES (
      '06_reject_invalid_value', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig038_test_results VALUES (
      '06_reject_invalid_value',
      v_err ILIKE '%invalid tiebreak%',
      v_err
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig038_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM public.__mig038_test_results;
