-- Score derived from goal events, with manual override.
--
-- PREREQUISITE: apply supabase/migrations/20261006100000_score_from_events.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/047_score_from_events.sql

DROP TABLE IF EXISTS public.__mig047_test_results;
CREATE TABLE public.__mig047_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig047_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig047_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0471';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  player_h uuid;
  player_a uuid;
  stp_h uuid;
  stp_a uuid;
  match_live uuid;
  match_override uuid;
  goal_home uuid;
  goal_away uuid;
  v_home integer;
  v_away integer;
  v_override boolean;
  v_source text;
  v_actor uuid;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'org-mig047-score-events'
  );
  DELETE FROM public.organizations WHERE slug = 'org-mig047-score-events';
  DELETE FROM auth.users WHERE id = uid_owner;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
    'owner@ligapro-mig047.local', '$2a$06$testhashligapromigration047aa', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (uid_owner, 'owner@ligapro-mig047.local', 'Owner 047')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig047_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Score Events 047');
  UPDATE public.organizations SET slug = 'org-mig047-score-events' WHERE id = org_a;

  INSERT INTO public.competitions (organization_id, name, slug, format_type)
  VALUES (org_a, 'Liga 047', 'liga-047', 'round_robin')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, competition_a, 'Apertura 047', 'apertura-047', 'private')
  RETURNING id INTO season_a;

  INSERT INTO public.season_rules (organization_id, season_id)
  VALUES (org_a, season_a);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Local 047') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Visita 047') RETURNING id INTO team_a;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_h) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_a) RETURNING id INTO st_a;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Local') RETURNING id INTO player_h;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Visita') RETURNING id INTO player_a;
  INSERT INTO public.season_team_players (
    organization_id, season_id, season_team_id, player_id, registration_status
  ) VALUES (org_a, season_a, st_h, player_h, 'active') RETURNING id INTO stp_h;
  INSERT INTO public.season_team_players (
    organization_id, season_id, season_team_id, player_id, registration_status
  ) VALUES (org_a, season_a, st_a, player_a, 'active') RETURNING id INTO stp_a;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_a, st_h, st_a, 'in_progress')
  RETURNING id INTO match_live;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id,
    status, home_score, away_score, score_manual_override
  ) VALUES (org_a, season_a, st_h, st_a, 'in_progress', 9, 9, true)
  RETURNING id INTO match_override;

  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES (match_live, org_a, stp_h, 'goal', 10)
  RETURNING id INTO goal_home;

  SELECT home_score, away_score INTO v_home, v_away FROM public.matches WHERE id = match_live;
  INSERT INTO public.__mig047_test_results VALUES (
    '01_home_goal',
    v_home = 1 AND v_away = 0,
    format('%s-%s', v_home, v_away)
  );

  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES (match_live, org_a, stp_a, 'goal', 20)
  RETURNING id INTO goal_away;

  SELECT home_score, away_score INTO v_home, v_away FROM public.matches WHERE id = match_live;
  INSERT INTO public.__mig047_test_results VALUES (
    '02_away_goal',
    v_home = 1 AND v_away = 1,
    format('%s-%s', v_home, v_away)
  );

  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES (match_live, org_a, stp_h, 'own_goal', 30);

  SELECT home_score, away_score INTO v_home, v_away FROM public.matches WHERE id = match_live;
  INSERT INTO public.__mig047_test_results VALUES (
    '03_own_goal_credits_opponent',
    v_home = 1 AND v_away = 2,
    format('%s-%s', v_home, v_away)
  );

  PERFORM set_config('app.match_event_void', 'true', true);
  UPDATE public.match_events
  SET
    voided_at = now(),
    voided_by_profile_id = uid_owner,
    void_reason = 'mal anotado'
  WHERE id = goal_away;
  PERFORM set_config('app.match_event_void', '', true);

  SELECT home_score, away_score INTO v_home, v_away FROM public.matches WHERE id = match_live;
  INSERT INTO public.__mig047_test_results VALUES (
    '04_void_goal_recalculates',
    v_home = 1 AND v_away = 1,
    format('%s-%s', v_home, v_away)
  );

  UPDATE public.matches
  SET status = 'finished', home_score = 5, away_score = 5
  WHERE id = match_live;

  PERFORM set_config('app.match_event_void', 'true', true);
  UPDATE public.match_events
  SET
    voided_at = now(),
    voided_by_profile_id = uid_owner,
    void_reason = 'partido cerrado'
  WHERE id = goal_home;
  PERFORM set_config('app.match_event_void', '', true);

  SELECT home_score, away_score INTO v_home, v_away FROM public.matches WHERE id = match_live;
  INSERT INTO public.__mig047_test_results VALUES (
    '05_finished_match_not_touched',
    v_home = 5 AND v_away = 5,
    format('%s-%s', v_home, v_away)
  );

  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES (match_override, org_a, stp_h, 'goal', 5);

  SELECT home_score, away_score, score_manual_override
  INTO v_home, v_away, v_override
  FROM public.matches WHERE id = match_override;
  INSERT INTO public.__mig047_test_results VALUES (
    '06_override_true_not_touched',
    v_home = 9 AND v_away = 9 AND v_override,
    format('%s-%s override=%s', v_home, v_away, v_override)
  );

  SELECT source, actor_profile_id
  INTO v_source, v_actor
  FROM public.audit_log
  WHERE entity_type = 'matches'
    AND entity_id = match_live
    AND changed_fields @> ARRAY['home_score']::text[]
    AND source = 'system:events'
  ORDER BY created_at
  LIMIT 1;
  INSERT INTO public.__mig047_test_results VALUES (
    '07_audit_source_system_events',
    v_source = 'system:events' AND v_actor IS NULL,
    COALESCE(v_source, 'null')
  );

  PERFORM public.__mig047_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.update_match_result(match_override, 'walkover', 3, 0, true);
  EXECUTE 'RESET ROLE';

  SELECT home_score, away_score, score_manual_override, status
  INTO v_home, v_away, v_override, v_source
  FROM public.matches WHERE id = match_override;
  INSERT INTO public.__mig047_test_results VALUES (
    '08_walkover_manual_score',
    v_home = 3 AND v_away = 0 AND v_override AND v_source = 'walkover',
    format('%s-%s %s override=%s', v_home, v_away, v_source, v_override)
  );
END;
$$;
