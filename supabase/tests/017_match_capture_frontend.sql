-- Frontend F7 + Migration 017 harden capture
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/017_match_capture_frontend.sql

DROP TABLE IF EXISTS public.__mig017_test_results;
CREATE TABLE public.__mig017_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig017_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0170';
  uid_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0171';
  uid_member uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0172';
  uid_tadmin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0173';
  uid_ref uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0174';
  uid_del uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0175';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0170';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  season_a uuid;
  team_h uuid;
  team_a uuid;
  team_b uuid;
  st_h uuid;
  st_a uuid;
  st_b uuid;
  player_h uuid;
  player_a uuid;
  player_x uuid;
  player_other uuid;
  stp_h uuid;
  stp_a uuid;
  stp_inactive uuid;
  stp_b uuid;
  match_open uuid;
  match_other uuid;
  match_fin uuid;
  match_can uuid;
  match_wo uuid;
  mo_ref uuid;
  mo_del uuid;
  ev_id uuid;
  v_count int;
  v_ok boolean;
  v_args text;
  v_id uuid;
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
  ALTER TABLE public.match_events DISABLE TRIGGER USER;
  ALTER TABLE public.discipline_suspensions DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner, uid_admin, uid_member, uid_tadmin, uid_ref, uid_del, uid_owner_b)
       OR slug LIKE 'org-%mig017%'
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner, uid_admin, uid_member, uid_tadmin, uid_ref, uid_del, uid_owner_b)
     OR name LIKE 'Org % Mig017%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner, uid_admin, uid_member, uid_tadmin, uid_ref, uid_del, uid_owner_b);

  ALTER TABLE public.discipline_suspensions ENABLE TRIGGER USER;
  ALTER TABLE public.match_events ENABLE TRIGGER USER;
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
     'owner@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin, 'authenticated', 'authenticated',
     'admin@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member, 'authenticated', 'authenticated',
     'member@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tadmin, 'authenticated', 'authenticated',
     'tadmin@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
     'ref@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_del, 'authenticated', 'authenticated',
     'del@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig017.local', '$2a$06$testhashligapromigration017aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (uid_owner, 'owner@ligapro-mig017.local', 'Owner 017'),
    (uid_admin, 'admin@ligapro-mig017.local', 'Admin 017'),
    (uid_member, 'member@ligapro-mig017.local', 'Member 017'),
    (uid_tadmin, 'tadmin@ligapro-mig017.local', 'TAdmin 017'),
    (uid_ref, 'ref@ligapro-mig017.local', 'Ref 017'),
    (uid_del, 'del@ligapro-mig017.local', 'Del 017'),
    (uid_owner_b, 'owner-b@ligapro-mig017.local', 'Owner B 017')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig017_as(uid_owner);
  org_a := public.create_organization_with_owner('Org A Mig017');
  INSERT INTO public.organization_members (organization_id, profile_id, role) VALUES
    (org_a, uid_admin, 'organization_admin'),
    (org_a, uid_member, 'organization_member'),
    (org_a, uid_tadmin, 'organization_member'),
    (org_a, uid_ref, 'organization_member'),
    (org_a, uid_del, 'organization_member');

  PERFORM public.__mig017_as(uid_owner_b);
  org_b := public.create_organization_with_owner('Org B Mig017');

  PERFORM public.__mig017_as(uid_owner);
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp 017') RETURNING id INTO competition_a;

  season_a := public.create_season_with_rules(
    competition_a, 'Season A 017', 'season-a-mig017-h',
    'round_robin', 'draft', NULL, NULL,
    3, 1, 0, true, 90, 0, 2, 1
  );

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home 017') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away 017') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Other 017') RETURNING id INTO team_b;

  st_h := public.enroll_team_in_season(season_a, team_h, NULL, NULL, 'confirmed');
  st_a := public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'confirmed');
  st_b := public.enroll_team_in_season(season_a, team_b, NULL, NULL, 'confirmed');

  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'P Home') RETURNING id INTO player_h;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'P Away') RETURNING id INTO player_a;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'P Inact') RETURNING id INTO player_x;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'P Other Team') RETURNING id INTO player_other;

  stp_h := public.add_player_to_season_team(st_h, player_h, NULL, 'active');
  stp_a := public.add_player_to_season_team(st_a, player_a, NULL, 'active');
  stp_inactive := public.add_player_to_season_team(st_h, player_x, NULL, 'inactive');
  stp_b := public.add_player_to_season_team(st_b, player_other, NULL, 'active');

  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st_h, st_a, 'scheduled', 1, 1, 1) RETURNING id INTO match_open;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st_h, st_b, 'scheduled', 1, 1, 2) RETURNING id INTO match_other;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st_h, st_a, 'finished', 2, 1, 1) RETURNING id INTO match_fin;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st_h, st_a, 'cancelled', 2, 1, 2) RETURNING id INTO match_can;
  INSERT INTO public.matches (season_id, organization_id, home_season_team_id, away_season_team_id, status, round_number, leg_number, sequence_in_round)
  VALUES (season_a, org_a, st_h, st_a, 'walkover', 2, 1, 3) RETURNING id INTO match_wo;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role) VALUES
    (org_a, season_a, uid_tadmin, 'tournament_admin'),
    (org_a, season_a, uid_ref, 'referee'),
    (org_a, season_a, uid_del, 'delegate');
  INSERT INTO public.match_officials (organization_id, match_id, profile_id, role, status)
  VALUES (org_a, match_open, uid_ref, 'referee', 'confirmed') RETURNING id INTO mo_ref;
  INSERT INTO public.match_officials (organization_id, match_id, profile_id, role, status)
  VALUES (org_a, match_open, uid_del, 'delegate', 'confirmed') RETURNING id INTO mo_del;
  -- also assign ref to finished match so can_capture would pass if status weren't blocked
  INSERT INTO public.match_officials (organization_id, match_id, profile_id, role, status)
  VALUES
    (org_a, match_fin, uid_ref, 'referee', 'confirmed'),
    (org_a, match_can, uid_ref, 'referee', 'confirmed'),
    (org_a, match_wo, uid_ref, 'referee', 'confirmed');
  EXECUTE 'RESET ROLE';

  -- 01 ref confirmed inserts via RPC
  PERFORM public.__mig017_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_id := public.record_match_event(match_open, stp_h, 'goal', 10, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('01_ref_insert_open', v_id IS NOT NULL, coalesce(v_id::text, 'null'));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('01_ref_insert_open', false, SQLERRM);
  END;

  -- 02 delegate inserts
  PERFORM public.__mig017_as(uid_del);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_id := public.record_match_event(match_open, stp_a, 'goal', 11, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('02_delegate_insert_open', v_id IS NOT NULL, coalesce(v_id::text, 'null'));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('02_delegate_insert_open', false, SQLERRM);
  END;

  -- 03 tadmin inserts
  PERFORM public.__mig017_as(uid_tadmin);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_id := public.record_match_event(match_other, stp_h, 'goal', 5, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('03_tadmin_insert_season', v_id IS NOT NULL, coalesce(v_id::text, 'null'));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('03_tadmin_insert_season', false, SQLERRM);
  END;

  -- 04 member unauthorized
  PERFORM public.__mig017_as(uid_member);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_h, 'goal', 20, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('04_unauthorized_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('04_unauthorized_fails', true, SQLERRM);
  END;

  -- 05 ref other match fails
  PERFORM public.__mig017_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_other, stp_h, 'goal', 20, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('05_ref_other_match_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('05_ref_other_match_fails', true, SQLERRM);
  END;

  -- 06 player of other team fails
  PERFORM public.__mig017_as(uid_tadmin);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_b, 'goal', 21, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('06_other_team_player_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('06_other_team_player_fails', true, SQLERRM);
  END;

  -- 07 inactive player fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_inactive, 'goal', 22, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('07_inactive_player_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('07_inactive_player_fails', true, SQLERRM);
  END;

  -- 08 invalid event type
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_h, 'penalty_goal', 23, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('08_invalid_event_type_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('08_invalid_event_type_fails', true, SQLERRM);
  END;

  -- 09 invalid minute
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_h, 'goal', 200, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('09_invalid_minute_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('09_invalid_minute_fails', true, SQLERRM);
  END;

  -- 10 finished rejects (bypass frontend = direct RPC)
  PERFORM public.__mig017_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_fin, stp_h, 'goal', 1, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('10_finished_rejects', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('10_finished_rejects', true, SQLERRM);
  END;

  -- 11 cancelled
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_can, stp_h, 'goal', 1, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('11_cancelled_rejects', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('11_cancelled_rejects', true, SQLERRM);
  END;

  -- 12 walkover
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_wo, stp_h, 'goal', 1, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('12_walkover_rejects', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('12_walkover_rejects', true, SQLERRM);
  END;

  SELECT id INTO ev_id FROM public.match_events WHERE match_id = match_open ORDER BY created_at LIMIT 1;

  -- 13-16 UPDATE fails for roles
  PERFORM public.__mig017_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events SET notes = 'x' WHERE id = ev_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('13_ref_update_fails', v_count = 0, 'updated=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('13_ref_update_fails', true, SQLERRM);
  END;

  PERFORM public.__mig017_as(uid_del);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events SET notes = 'y' WHERE id = ev_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('14_delegate_update_fails', v_count = 0, 'updated=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('14_delegate_update_fails', true, SQLERRM);
  END;

  PERFORM public.__mig017_as(uid_tadmin);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events SET notes = 'z' WHERE id = ev_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('15_tadmin_update_fails', v_count = 0, 'updated=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('15_tadmin_update_fails', true, SQLERRM);
  END;

  PERFORM public.__mig017_as(uid_owner);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.match_events SET notes = 'owner' WHERE id = ev_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('16_owner_update_fails', v_count = 0, 'updated=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('16_owner_update_fails', true, SQLERRM);
  END;

  -- 17-18 DELETE fails
  PERFORM public.__mig017_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.match_events WHERE id = ev_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('17_ref_delete_fails', v_count = 0, 'deleted=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('17_ref_delete_fails', true, SQLERRM);
  END;

  PERFORM public.__mig017_as(uid_owner);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.match_events WHERE id = ev_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('18_owner_delete_fails', v_count = 0, 'deleted=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('18_owner_delete_fails', true, SQLERRM);
  END;

  -- 19 red → suspension
  PERFORM public.__mig017_as(uid_tadmin);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_a, 'red_card', 40, NULL);
    EXECUTE 'RESET ROLE';
    SELECT COUNT(*) INTO v_count FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_a AND suspension_type = 'direct_red';
    INSERT INTO public.__mig017_test_results VALUES ('19_red_generates_suspension', v_count >= 1, 'count=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('19_red_generates_suspension', false, SQLERRM);
  END;

  -- 20 yellow accumulation (limit 2)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_h, 'yellow_card', 50, NULL);
    PERFORM public.record_match_event(match_open, stp_h, 'yellow_card', 60, NULL);
    EXECUTE 'RESET ROLE';
    SELECT COUNT(*) INTO v_count FROM public.discipline_suspensions
    WHERE season_team_player_id = stp_h AND suspension_type = 'accumulation';
    INSERT INTO public.__mig017_test_results VALUES ('20_yellow_accumulation', v_count >= 1, 'count=' || v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('20_yellow_accumulation', false, SQLERRM);
  END;

  -- 21 audit insert
  SELECT COUNT(*) INTO v_count FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'match_events' AND action = 'insert';
  INSERT INTO public.__mig017_test_results VALUES ('21_audit_insert', v_count >= 1, 'count=' || v_count);

  -- 22 anon RPC
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.record_match_event(match_open, stp_h, 'goal', 1, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('22_anon_rpc_fails', false, 'should fail');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig017_test_results VALUES ('22_anon_rpc_fails', true, SQLERRM);
  END;

  -- 23 PUBLIC execute
  SELECT NOT has_function_privilege(
    'public', 'public.record_match_event(uuid, uuid, text, integer, text)', 'EXECUTE'
  ) INTO v_ok;
  INSERT INTO public.__mig017_test_results
  VALUES ('23_public_no_execute', COALESCE(v_ok, false), format('ok=%s', v_ok));

  -- 24-25 signature
  SELECT pg_get_function_identity_arguments(p.oid) INTO v_args
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'record_match_event';
  INSERT INTO public.__mig017_test_results VALUES (
    '24_rpc_no_organization_id',
    v_args NOT ILIKE '%organization%',
    v_args
  );
  INSERT INTO public.__mig017_test_results VALUES (
    '25_rpc_no_actor_profile',
    v_args NOT ILIKE '%profile%' AND v_args NOT ILIKE '%actor%',
    v_args
  );

EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig017_test_results VALUES ('zz_suite_fatal', false, SQLERRM)
  ON CONFLICT (test_name) DO UPDATE SET passed = EXCLUDED.passed, details = EXCLUDED.details;
END;
$$;

DROP FUNCTION IF EXISTS public.__mig017_as(uuid);

SELECT test_name, passed, details FROM public.__mig017_test_results ORDER BY test_name;
SELECT COUNT(*) FILTER (WHERE passed) AS passed,
       COUNT(*) FILTER (WHERE NOT passed) AS failed,
       COUNT(*) AS total
FROM public.__mig017_test_results;

DROP TABLE IF EXISTS public.__mig017_test_results;
