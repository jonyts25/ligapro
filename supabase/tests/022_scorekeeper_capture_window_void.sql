-- Migration 022: scorekeeper, capture window, void match events
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/022_scorekeeper_capture_window_void.sql

DROP TABLE IF EXISTS public.__mig022_test_results;
CREATE TABLE public.__mig022_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig022_as(p_uid uuid)
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

CREATE OR REPLACE FUNCTION public.__mig022_link_reservation(
  p_org uuid,
  p_field uuid,
  p_match uuid,
  p_starts_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_res uuid;
BEGIN
  INSERT INTO public.field_reservations (
    organization_id,
    field_id,
    match_id,
    reservation_type,
    status,
    starts_at,
    ends_at
  ) VALUES (
    p_org,
    p_field,
    p_match,
    'match',
    'confirmed',
    p_starts_at,
    p_starts_at + interval '2 hours'
  ) RETURNING id INTO v_res;

  UPDATE public.matches
  SET field_reservation_id = v_res
  WHERE id = p_match;

  RETURN v_res;
END;
$$;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0220';
  uid_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0221';
  uid_tadmin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0222';
  uid_ref uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0223';
  uid_sk uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0224';
  uid_sk_unconfirmed uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0225';
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
  venue_id uuid;
  field_id uuid;
  match_open uuid;
  match_no_res uuid;
  match_closed uuid;
  ev_id uuid;
  ev_yellow uuid;
  v_count int;
  v_goals int;
  v_goals_before int;
  v_yellow int;
  v_msg text;
  v_voided boolean;
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
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.discipline_suspensions DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug LIKE 'org-%mig022%'
  );
  DELETE FROM public.organizations WHERE slug LIKE 'org-%mig022%';
  DELETE FROM auth.users
  WHERE id IN (
    uid_owner, uid_admin, uid_tadmin, uid_ref, uid_sk, uid_sk_unconfirmed
  );

  ALTER TABLE public.discipline_suspensions ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
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
     'owner@ligapro-mig022.local', '$2a$06$testhashligapromigration022aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin, 'authenticated', 'authenticated',
     'admin@ligapro-mig022.local', '$2a$06$testhashligapromigration022aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tadmin, 'authenticated', 'authenticated',
     'tadmin@ligapro-mig022.local', '$2a$06$testhashligapromigration022aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
     'ref@ligapro-mig022.local', '$2a$06$testhashligapromigration022aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_sk, 'authenticated', 'authenticated',
     'sk@ligapro-mig022.local', '$2a$06$testhashligapromigration022aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_sk_unconfirmed, 'authenticated', 'authenticated',
     'sk-u@ligapro-mig022.local', '$2a$06$testhashligapromigration022aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (uid_owner, 'owner@ligapro-mig022.local', 'Owner 022'),
    (uid_admin, 'admin@ligapro-mig022.local', 'Admin 022'),
    (uid_tadmin, 'tadmin@ligapro-mig022.local', 'TAdmin 022'),
    (uid_ref, 'ref@ligapro-mig022.local', 'Ref 022'),
    (uid_sk, 'sk@ligapro-mig022.local', 'SK 022'),
    (uid_sk_unconfirmed, 'sk-u@ligapro-mig022.local', 'SK Unconf 022')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig022_as(uid_owner);
  org_a := public.create_organization_with_owner('Org A Mig022');
  INSERT INTO public.organization_members (organization_id, profile_id, role) VALUES
    (org_a, uid_admin, 'organization_admin'),
    (org_a, uid_tadmin, 'organization_member'),
    (org_a, uid_ref, 'organization_member'),
    (org_a, uid_sk, 'organization_member'),
    (org_a, uid_sk_unconfirmed, 'organization_member');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp 022') RETURNING id INTO competition_a;

  season_a := public.create_season_with_rules(
    competition_a, 'Season A 022', 'season-a-mig022',
    'round_robin', 'draft', NULL, NULL,
    3, 1, 0, true, 90, 0, 2, 1
  );

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_a;
  PERFORM public.__mig022_as(uid_owner);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home 022') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away 022') RETURNING id INTO team_a;

  st_h := public.enroll_team_in_season(season_a, team_h, NULL, NULL, 'confirmed');
  st_a := public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'confirmed');

  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'P Home 022') RETURNING id INTO player_h;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'P Away 022') RETURNING id INTO player_a;

  stp_h := public.add_player_to_season_team(st_h, player_h, NULL, 'active');
  stp_a := public.add_player_to_season_team(st_a, player_a, NULL, 'active');

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_number, leg_number, sequence_in_round
  ) VALUES (
    season_a, org_a, st_h, st_a, 'scheduled', 1, 1, 1
  ) RETURNING id INTO match_open;

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_number, leg_number, sequence_in_round
  ) VALUES (
    season_a, org_a, st_h, st_a, 'scheduled', 1, 1, 2
  ) RETURNING id INTO match_no_res;

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_number, leg_number, sequence_in_round
  ) VALUES (
    season_a, org_a, st_h, st_a, 'scheduled', 1, 1, 3
  ) RETURNING id INTO match_closed;

  INSERT INTO public.venues (organization_id, name, is_active)
  VALUES (org_a, 'Venue 022', true) RETURNING id INTO venue_id;
  INSERT INTO public.fields (organization_id, venue_id, name, is_active)
  VALUES (org_a, venue_id, 'Field 022', true) RETURNING id INTO field_id;

  PERFORM public.__mig022_link_reservation(
    org_a, field_id, match_open, now() - interval '30 minutes'
  );
  PERFORM public.__mig022_link_reservation(
    org_a, field_id, match_closed, now() - interval '3 days'
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role) VALUES
    (org_a, season_a, uid_tadmin, 'tournament_admin'),
    (org_a, season_a, uid_ref, 'referee'),
    (org_a, season_a, uid_sk, 'scorekeeper'),
    (org_a, season_a, uid_sk_unconfirmed, 'scorekeeper');
  INSERT INTO public.match_officials (organization_id, match_id, profile_id, role, status) VALUES
    (org_a, match_open, uid_ref, 'referee', 'confirmed'),
    (org_a, match_open, uid_sk, 'scorekeeper', 'confirmed'),
    (org_a, match_open, uid_sk_unconfirmed, 'scorekeeper', 'assigned'),
    (org_a, match_no_res, uid_ref, 'referee', 'confirmed'),
    (org_a, match_closed, uid_ref, 'referee', 'confirmed');
  EXECUTE 'RESET ROLE';

  -- 01 scorekeeper confirmed captures inside window
  PERFORM public.__mig022_as(uid_sk);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    ev_id := public.record_match_event(match_open, stp_h, 'goal', 10, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '01_scorekeeper_confirmed_captures',
      ev_id IS NOT NULL,
      coalesce(ev_id::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '01_scorekeeper_confirmed_captures', false, SQLERRM
    );
  END;

  -- 02 scorekeeper assigned (not confirmed) rejected
  PERFORM public.__mig022_as(uid_sk_unconfirmed);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_open, stp_a, 'goal', 11, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '02_scorekeeper_unconfirmed_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '02_scorekeeper_unconfirmed_rejected',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 03 referee rejected outside window
  PERFORM public.__mig022_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_closed, stp_h, 'goal', 5, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '03_referee_outside_window_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '03_referee_outside_window_rejected',
      SQLERRM ILIKE '%ventana de captura%',
      SQLERRM
    );
  END;

  -- 04 referee allowed inside window
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    ev_id := public.record_match_event(match_open, stp_a, 'goal', 12, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '04_referee_inside_window_allowed',
      ev_id IS NOT NULL,
      coalesce(ev_id::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '04_referee_inside_window_allowed', false, SQLERRM
    );
  END;

  -- 05 tournament_admin bypass outside window
  PERFORM public.__mig022_as(uid_tadmin);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    ev_id := public.record_match_event(match_closed, stp_h, 'goal', 6, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '05_tadmin_bypass_outside_window',
      ev_id IS NOT NULL,
      coalesce(ev_id::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '05_tadmin_bypass_outside_window', false, SQLERRM
    );
  END;

  -- 06 owner bypass outside window on update_match_result
  PERFORM public.__mig022_as(uid_owner);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_match_result(match_closed, 'finished', 1, 0);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '06_owner_bypass_update_result', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '06_owner_bypass_update_result', false, SQLERRM
    );
  END;

  -- 07 no reservation: field role rejected
  PERFORM public.__mig022_as(uid_ref);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.record_match_event(match_no_res, stp_h, 'goal', 1, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '07_no_reservation_field_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '07_no_reservation_field_rejected',
      SQLERRM ILIKE '%ventana de captura%',
      SQLERRM
    );
  END;

  -- 08 no reservation: admin bypass
  PERFORM public.__mig022_as(uid_admin);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    ev_id := public.record_match_event(match_no_res, stp_h, 'goal', 2, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '08_no_reservation_admin_bypass',
      ev_id IS NOT NULL,
      coalesce(ev_id::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '08_no_reservation_admin_bypass', false, SQLERRM
    );
  END;

  -- Setup finished match with goals for void/scorers tests
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches
  SET status = 'in_progress', home_score = NULL, away_score = NULL
  WHERE id = match_open;
  ALTER TABLE public.matches ENABLE TRIGGER USER;

  PERFORM public.__mig022_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  ev_id := public.record_match_event(match_open, stp_h, 'goal', 20, NULL);
  ev_yellow := public.record_match_event(match_open, stp_h, 'yellow_card', 25, NULL);
  EXECUTE 'RESET ROLE';

  ALTER TABLE public.matches DISABLE TRIGGER USER;
  UPDATE public.matches SET status = 'finished', home_score = 3, away_score = 1 WHERE id = match_open;
  ALTER TABLE public.matches ENABLE TRIGGER USER;

  SELECT goals INTO v_goals FROM public.get_season_top_scorers(season_a) WHERE player_name = 'P Home 022';
  v_goals_before := v_goals;
  INSERT INTO public.__mig022_test_results VALUES (
    '09_scorers_before_void',
    v_goals >= 2,
    format('goals=%s', v_goals)
  );

  -- 10 void without reason fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_match_event(ev_id, '   ');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '10_void_empty_reason_fails', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '10_void_empty_reason_fails',
      SQLERRM ILIKE '%reason is required%',
      SQLERRM
    );
  END;

  -- 11 scorekeeper cannot void
  PERFORM public.__mig022_as(uid_sk);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_match_event(ev_id, 'error de captura');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '11_scorekeeper_void_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '11_scorekeeper_void_rejected',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 12 owner voids with reason
  PERFORM public.__mig022_as(uid_owner);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_match_event(ev_id, 'Gol duplicado por error de captura');
    EXECUTE 'RESET ROLE';
    SELECT voided_at IS NOT NULL, void_reason INTO v_voided, v_msg
    FROM public.match_events WHERE id = ev_id;
    INSERT INTO public.__mig022_test_results VALUES (
      '12_owner_void_success',
      v_voided,
      coalesce(v_msg, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '12_owner_void_success', false, SQLERRM
    );
  END;

  -- 13 second void fails (idempotency = explicit error)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_match_event(ev_id, 'otro motivo');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '13_second_void_fails', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '13_second_void_fails',
      SQLERRM ILIKE '%already voided%',
      SQLERRM
    );
  END;

  -- 14 scorers exclude voided
  SELECT goals INTO v_goals FROM public.get_season_top_scorers(season_a) WHERE player_name = 'P Home 022';
  INSERT INTO public.__mig022_test_results VALUES (
    '14_scorers_exclude_voided',
    v_goals = v_goals_before - 1,
    format('goals=%s before=%s', v_goals, v_goals_before)
  );

  -- 15 discipline summary excludes voided yellow (void yellow event)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_match_event(ev_yellow, 'Tarjeta registrada al jugador equivocado');
    EXECUTE 'RESET ROLE';
    SELECT yellow_cards INTO v_yellow
    FROM public.get_season_discipline_summary(season_a)
    WHERE player_name = 'P Home 022';
    INSERT INTO public.__mig022_test_results VALUES (
      '15_discipline_excludes_voided_cards',
      COALESCE(v_yellow, 0) = 0,
      format('yellow=%s', v_yellow)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig022_test_results VALUES (
      '15_discipline_excludes_voided_cards', false, SQLERRM
    );
  END;

EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig022_test_results VALUES ('zz_suite_fatal', false, SQLERRM)
  ON CONFLICT (test_name) DO UPDATE SET passed = EXCLUDED.passed, details = EXCLUDED.details;
END;
$$;

DROP FUNCTION IF EXISTS public.__mig022_as(uuid);
DROP FUNCTION IF EXISTS public.__mig022_link_reservation(uuid, uuid, uuid, timestamptz);

SELECT test_name, passed, details FROM public.__mig022_test_results ORDER BY test_name;
SELECT COUNT(*) FILTER (WHERE passed) AS passed,
       COUNT(*) FILTER (WHERE NOT passed) AS failed,
       COUNT(*) AS total
FROM public.__mig022_test_results;

DROP TABLE IF EXISTS public.__mig022_test_results;