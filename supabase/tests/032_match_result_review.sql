-- Migration 032: match result review + disputes
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/032_match_result_review.sql

DROP TABLE IF EXISTS public.__mig032_test_results;
CREATE TABLE public.__mig032_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig032_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0320';
  uid_home_captain uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0321';
  uid_away_captain uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0322';
  uid_other uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0323';
  org_a uuid;
  comp_a uuid;
  season_a uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  player_h uuid;
  player_a uuid;
  stp_h uuid;
  stp_a uuid;
  match_review uuid;
  match_auto uuid;
  match_reset uuid;
  v_opened timestamptz;
  v_auto_close timestamptz;
  v_first_close timestamptz;
  v_second_close timestamptz;
  v_approved timestamptz;
  v_dispute_status text;
  v_count integer;
  v_msg text;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.players DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_players DISABLE TRIGGER USER;
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.match_result_disputes DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug LIKE 'org-%mig032%'
  );
  DELETE FROM public.organizations WHERE slug LIKE 'org-%mig032%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner, uid_home_captain, uid_away_captain, uid_other);

  ALTER TABLE public.match_result_disputes ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
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
     'owner-mig032@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_home_captain, 'authenticated', 'authenticated',
     'home-captain-mig032@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_away_captain, 'authenticated', 'authenticated',
     'away-captain-mig032@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_other, 'authenticated', 'authenticated',
     'other-mig032@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now());

  INSERT INTO public.profiles (id, full_name) VALUES
    (uid_owner, 'Owner 032'),
    (uid_home_captain, 'Home Captain 032'),
    (uid_away_captain, 'Away Captain 032'),
    (uid_other, 'Other 032');

  INSERT INTO public.organizations (id, name, slug, created_by)
  VALUES (gen_random_uuid(), 'Org Mig032', 'org-a-mig032', uid_owner)
  RETURNING id INTO org_a;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_owner, 'organization_owner'),
    (org_a, uid_home_captain, 'organization_member'),
    (org_a, uid_away_captain, 'organization_member'),
    (org_a, uid_other, 'organization_member');

  INSERT INTO public.competitions (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Comp 032') RETURNING id INTO comp_a;

  INSERT INTO public.seasons (
    id, competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    gen_random_uuid(), comp_a, org_a, 'Season 032', 'season-032', 'round_robin', 'draft'
  ) RETURNING id INTO season_a;

  INSERT INTO public.season_rules (organization_id, season_id)
  VALUES (org_a, season_a);

  INSERT INTO public.teams (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Home 032') RETURNING id INTO team_h;
  INSERT INTO public.teams (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Away 032') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (id, season_id, team_id, organization_id)
  VALUES (gen_random_uuid(), season_a, team_h, org_a) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (id, season_id, team_id, organization_id)
  VALUES (gen_random_uuid(), season_a, team_a, org_a) RETURNING id INTO st_a;

  INSERT INTO public.players (id, organization_id, full_name, profile_id)
  VALUES (gen_random_uuid(), org_a, 'Home Captain Player', uid_home_captain)
  RETURNING id INTO player_h;
  INSERT INTO public.players (id, organization_id, full_name, profile_id)
  VALUES (gen_random_uuid(), org_a, 'Away Captain Player', uid_away_captain)
  RETURNING id INTO player_a;

  INSERT INTO public.season_team_players (
    id, season_team_id, player_id, organization_id, registration_status, is_captain
  ) VALUES (gen_random_uuid(), st_h, player_h, org_a, 'active', true)
  RETURNING id INTO stp_h;

  INSERT INTO public.season_team_players (
    id, season_team_id, player_id, organization_id, registration_status, is_captain
  ) VALUES (gen_random_uuid(), st_a, player_a, org_a, 'active', true)
  RETURNING id INTO stp_a;

  INSERT INTO public.season_team_players (
    id, season_team_id, player_id, organization_id, registration_status
  ) VALUES (gen_random_uuid(), st_h, player_a, org_a, 'active');

  INSERT INTO public.matches (
    id, organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (gen_random_uuid(), org_a, season_a, st_h, st_a, 'scheduled')
  RETURNING id INTO match_review;

  INSERT INTO public.matches (
    id, organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (gen_random_uuid(), org_a, season_a, st_h, st_a, 'scheduled')
  RETURNING id INTO match_auto;

  INSERT INTO public.matches (
    id, organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (gen_random_uuid(), org_a, season_a, st_h, st_a, 'scheduled')
  RETURNING id INTO match_reset;

  -- Close match and open review window
  PERFORM public.__mig032_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.update_match_result(match_review, 'finished', 2, 1);
  EXECUTE 'RESET ROLE';

  SELECT result_review_opened_at, result_review_auto_close_at, result_approved_at
  INTO v_opened, v_auto_close, v_approved
  FROM public.matches WHERE id = match_review;

  INSERT INTO public.__mig032_test_results
  SELECT '01_close_opens_review_window',
    v_opened IS NOT NULL
      AND v_auto_close IS NOT NULL
      AND v_approved IS NULL
      AND v_auto_close > v_opened,
    COALESCE(v_opened::text, 'null');

  -- Home captain opens dispute
  PERFORM public.__mig032_as(uid_home_captain);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.open_match_result_dispute(match_review, 'Marcador incorrecto');
  EXECUTE 'RESET ROLE';

  SELECT status INTO v_dispute_status
  FROM public.match_result_disputes
  WHERE match_id = match_review AND status = 'open';
  INSERT INTO public.__mig032_test_results
  SELECT '02_home_captain_opens_dispute', v_dispute_status = 'open', COALESCE(v_dispute_status, 'null');

  -- Unrelated member cannot open dispute
  PERFORM public.__mig032_as(uid_other);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.open_match_result_dispute(match_review, 'No debería');
    INSERT INTO public.__mig032_test_results VALUES (
      '03_unrelated_captain_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO public.__mig032_test_results VALUES (
      '03_unrelated_captain_rejected', v_msg LIKE '%captain%', v_msg
    );
  END;
  EXECUTE 'RESET ROLE';

  -- Duplicate open dispute rejected
  PERFORM public.__mig032_as(uid_away_captain);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.open_match_result_dispute(match_review, 'Segunda disputa');
    INSERT INTO public.__mig032_test_results VALUES (
      '04_duplicate_open_dispute_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO public.__mig032_test_results VALUES (
      '04_duplicate_open_dispute_rejected',
      v_msg LIKE '%disputa abierta%',
      v_msg
    );
  END;
  EXECUTE 'RESET ROLE';

  -- Admin approves and resolves dispute
  PERFORM public.__mig032_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.approve_match_result(match_review);
  EXECUTE 'RESET ROLE';

  SELECT result_approved_at INTO v_approved FROM public.matches WHERE id = match_review;
  SELECT status INTO v_dispute_status
  FROM public.match_result_disputes WHERE match_id = match_review;
  INSERT INTO public.__mig032_test_results
  SELECT '05_admin_approves_and_resolves',
    v_approved IS NOT NULL AND v_dispute_status = 'resolved',
    COALESCE(v_dispute_status, 'null');

  -- Auto-close without open dispute
  PERFORM public.__mig032_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.update_match_result(match_auto, 'finished', 1, 0);
  EXECUTE 'RESET ROLE';

  UPDATE public.matches
  SET result_review_auto_close_at = now() - interval '1 minute'
  WHERE id = match_auto;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.auto_close_pending_match_results()
  WHERE match_id = match_auto;
  INSERT INTO public.__mig032_test_results
  SELECT '06_auto_close_without_dispute', v_count = 1, v_count::text;

  SELECT result_approved_at INTO v_approved FROM public.matches WHERE id = match_auto;
  INSERT INTO public.__mig032_test_results
  SELECT '07_auto_close_sets_approved', v_approved IS NOT NULL, COALESCE(v_approved::text, 'null');

  -- Auto-close blocked by open dispute
  PERFORM public.__mig032_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.update_match_result(match_reset, 'finished', 3, 2);
  EXECUTE 'RESET ROLE';

  UPDATE public.matches
  SET result_review_auto_close_at = now() - interval '1 minute'
  WHERE id = match_reset;

  PERFORM public.__mig032_as(uid_home_captain);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.open_match_result_dispute(match_reset, 'Congela autocierre');
  EXECUTE 'RESET ROLE';

  SELECT COUNT(*)::integer INTO v_count
  FROM public.auto_close_pending_match_results()
  WHERE match_id = match_reset;
  INSERT INTO public.__mig032_test_results
  SELECT '08_auto_close_skips_open_dispute', v_count = 0, v_count::text;

  -- Admin correction resets 24h window
  PERFORM public.__mig032_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.update_match_result(match_reset, 'finished', 4, 3);
  SELECT result_review_auto_close_at INTO v_first_close FROM public.matches WHERE id = match_reset;
  PERFORM pg_sleep(1);
  PERFORM public.update_match_result(match_reset, 'finished', 5, 4);
  SELECT result_review_auto_close_at INTO v_second_close FROM public.matches WHERE id = match_reset;
  EXECUTE 'RESET ROLE';

  INSERT INTO public.__mig032_test_results
  SELECT '09_admin_correction_resets_window',
    v_second_close > v_first_close,
    v_first_close::text || ' -> ' || v_second_close::text;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig032_test_results
ORDER BY test_name;
