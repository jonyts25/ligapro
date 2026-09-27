-- Migration 031: match_participants RPCs
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/031_match_participants.sql

DROP TABLE IF EXISTS public.__mig031_test_results;
CREATE TABLE public.__mig031_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig031_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0310';
  uid_captain uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0311';
  uid_ref uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0312';
  uid_other uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0313';
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
  stp_h2 uuid;
  match_open uuid;
  match_closed uuid;
  v_count integer;
  v_status text;
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
  ALTER TABLE public.match_officials DISABLE TRIGGER USER;
  ALTER TABLE public.match_participants DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug LIKE 'org-%mig031%'
  );
  DELETE FROM public.organizations WHERE slug LIKE 'org-%mig031%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner, uid_captain, uid_ref, uid_other);

  ALTER TABLE public.match_participants ENABLE TRIGGER USER;
  ALTER TABLE public.match_officials ENABLE TRIGGER USER;
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
     'owner-mig031@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain, 'authenticated', 'authenticated',
     'captain-mig031@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
     'ref-mig031@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_other, 'authenticated', 'authenticated',
     'other-mig031@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now());

  INSERT INTO public.profiles (id, full_name) VALUES
    (uid_owner, 'Owner 031'),
    (uid_captain, 'Captain 031'),
    (uid_ref, 'Ref 031'),
    (uid_other, 'Other 031');

  INSERT INTO public.organizations (id, name, slug, created_by)
  VALUES (gen_random_uuid(), 'Org Mig031', 'org-a-mig031', uid_owner)
  RETURNING id INTO org_a;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_owner, 'organization_owner'),
    (org_a, uid_captain, 'organization_member'),
    (org_a, uid_ref, 'organization_member'),
    (org_a, uid_other, 'organization_member');

  INSERT INTO public.competitions (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Comp 031') RETURNING id INTO comp_a;

  INSERT INTO public.seasons (
    id, competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    gen_random_uuid(), comp_a, org_a, 'Season 031', 'season-031', 'round_robin', 'draft'
  ) RETURNING id INTO season_a;

  INSERT INTO public.season_rules (organization_id, season_id)
  VALUES (org_a, season_a);

  INSERT INTO public.teams (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Home 031') RETURNING id INTO team_h;
  INSERT INTO public.teams (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Away 031') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (id, season_id, team_id, organization_id)
  VALUES (gen_random_uuid(), season_a, team_h, org_a) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (id, season_id, team_id, organization_id)
  VALUES (gen_random_uuid(), season_a, team_a, org_a) RETURNING id INTO st_a;

  INSERT INTO public.players (id, organization_id, full_name, profile_id)
  VALUES (gen_random_uuid(), org_a, 'Captain Player', uid_captain) RETURNING id INTO player_h;
  INSERT INTO public.players (id, organization_id, full_name)
  VALUES (gen_random_uuid(), org_a, 'Away Player') RETURNING id INTO player_a;

  INSERT INTO public.season_team_players (
    id, season_team_id, player_id, organization_id, registration_status, is_captain
  ) VALUES (gen_random_uuid(), st_h, player_h, org_a, 'active', true)
  RETURNING id INTO stp_h;

  INSERT INTO public.season_team_players (
    id, season_team_id, player_id, organization_id, registration_status
  ) VALUES (gen_random_uuid(), st_h, player_a, org_a, 'active')
  RETURNING id INTO stp_h2;

  INSERT INTO public.season_team_players (
    id, season_team_id, player_id, organization_id, registration_status
  ) VALUES (gen_random_uuid(), st_a, player_a, org_a, 'active')
  RETURNING id INTO stp_a;

  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
  VALUES (org_a, season_a, uid_ref, 'referee');

  INSERT INTO public.matches (
    id, organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (gen_random_uuid(), org_a, season_a, st_h, st_a, 'scheduled')
  RETURNING id INTO match_open;

  INSERT INTO public.matches (
    id, organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (gen_random_uuid(), org_a, season_a, st_h, st_a, 'finished')
  RETURNING id INTO match_closed;

  INSERT INTO public.match_officials (
    organization_id, match_id, profile_id, role, status
  ) VALUES (org_a, match_open, uid_ref, 'referee', 'confirmed');

  -- Owner upsert called
  PERFORM public.__mig031_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_count := public.set_match_participants(
    match_open,
    ARRAY[stp_h, stp_a],
    'called'
  );
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig031_test_results
  SELECT '01_owner_upsert_called', v_count = 2, v_count::text;

  SELECT status INTO v_status
  FROM public.match_participants
  WHERE match_id = match_open AND season_team_player_id = stp_h;
  INSERT INTO public.__mig031_test_results
  SELECT '02_status_called', v_status = 'called', COALESCE(v_status, 'null');

  -- Captain can set own team only
  PERFORM public.__mig031_as(uid_captain);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.set_match_participants(match_open, ARRAY[stp_h], 'confirmed');
    INSERT INTO public.__mig031_test_results VALUES (
      '03_captain_own_team', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO public.__mig031_test_results VALUES (
      '03_captain_own_team', false, v_msg
    );
  END;

  BEGIN
    PERFORM public.set_match_participants(match_open, ARRAY[stp_a], 'called');
    INSERT INTO public.__mig031_test_results VALUES (
      '04_captain_other_team_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO public.__mig031_test_results VALUES (
      '04_captain_other_team_rejected', v_msg LIKE '%own team%', v_msg
    );
  END;
  EXECUTE 'RESET ROLE';

  -- Referee validates roster -> played + no_show
  PERFORM public.__mig031_as(uid_ref);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.validate_match_roster(match_open, ARRAY[stp_h]);
  EXECUTE 'RESET ROLE';

  SELECT status INTO v_status
  FROM public.match_participants
  WHERE match_id = match_open AND season_team_player_id = stp_h;
  INSERT INTO public.__mig031_test_results
  SELECT '05_validated_played', v_status = 'played', COALESCE(v_status, 'null');

  SELECT status INTO v_status
  FROM public.match_participants
  WHERE match_id = match_open AND season_team_player_id = stp_a;
  INSERT INTO public.__mig031_test_results
  SELECT '06_uncalled_no_show', v_status = 'no_show', COALESCE(v_status, 'null');

  -- Idempotent re-validation
  PERFORM public.__mig031_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.set_match_participants(match_open, ARRAY[stp_a], 'confirmed');
  PERFORM public.validate_match_roster(match_open, ARRAY[stp_h, stp_a]);
  EXECUTE 'RESET ROLE';

  SELECT status INTO v_status
  FROM public.match_participants
  WHERE match_id = match_open AND season_team_player_id = stp_a;
  INSERT INTO public.__mig031_test_results
  SELECT '07_revalidate_played', v_status = 'played', COALESCE(v_status, 'null');

  -- Closed match rejected
  PERFORM public.__mig031_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.validate_match_roster(match_closed, ARRAY[stp_h]);
    INSERT INTO public.__mig031_test_results VALUES (
      '08_closed_match_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO public.__mig031_test_results VALUES (
      '08_closed_match_rejected', v_msg LIKE '%closed match%', v_msg
    );
  END;
  EXECUTE 'RESET ROLE';

  -- Unauthorized user rejected
  PERFORM public.__mig031_as(uid_other);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.validate_match_roster(match_open, ARRAY[stp_h]);
    INSERT INTO public.__mig031_test_results VALUES (
      '09_unauthorized_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    INSERT INTO public.__mig031_test_results VALUES (
      '09_unauthorized_rejected', v_msg LIKE '%Not authorized%', v_msg
    );
  END;
  EXECUTE 'RESET ROLE';
END;
$$;

SELECT test_name, passed, details
FROM public.__mig031_test_results
ORDER BY test_name;
