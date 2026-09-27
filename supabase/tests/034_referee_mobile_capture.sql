-- Tests for referee mobile capture migration (dedup, assist, official void window)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/034_referee_mobile_capture.sql

DROP TABLE IF EXISTS public.__mig034_test_results;
CREATE TABLE public.__mig034_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig034_as(p_uid uuid)
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

CREATE OR REPLACE FUNCTION public.__mig034_link_reservation(
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
  uid_ref uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0340';
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0341';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  player_h uuid;
  player_h2 uuid;
  player_a uuid;
  stp_h uuid;
  stp_h2 uuid;
  stp_a uuid;
  venue_id uuid;
  field_id uuid;
  match_open uuid;
  match_no_reservation uuid;
  ev_id uuid;
  ev_id2 uuid;
  dedup_key text := 'dedup-key-034-test';
  v_ok boolean;
  v_err text;
  v_count int;
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
  ALTER TABLE public.match_events DISABLE TRIGGER USER;
  ALTER TABLE public.match_officials DISABLE TRIGGER USER;

  DELETE FROM public.match_events WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE created_by = uid_owner
  );
  DELETE FROM public.organizations WHERE created_by IN (uid_owner, uid_ref);

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
    ('00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
     'ref@ligapro-mig034.local', '$2a$06$testhashligapromigration034aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig034.local', '$2a$06$testhashligapromigration034aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM public.__mig034_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Ref Mobile 034');

  INSERT INTO public.competitions (organization_id, name, slug, format_type)
  VALUES (org_a, 'Liga 034', 'liga-034', 'round_robin')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, competition_a, 'Apertura 034', 'apertura-034', 'private')
  RETURNING id INTO season_a;

  INSERT INTO public.season_rules (organization_id, season_id, match_duration_minutes)
  VALUES (org_a, season_a, 90);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Local FC') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Visit FC') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_h) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_a) RETURNING id INTO st_a;

  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Goleador') RETURNING id INTO player_h;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Asistente') RETURNING id INTO player_h2;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Rival') RETURNING id INTO player_a;

  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_h, player_h, 'active') RETURNING id INTO stp_h;
  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_h, player_h2, 'active') RETURNING id INTO stp_h2;
  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_a, player_a, 'active') RETURNING id INTO stp_a;

  INSERT INTO public.venues (organization_id, name) VALUES (org_a, 'Sede 034') RETURNING id INTO venue_id;
  INSERT INTO public.fields (organization_id, venue_id, name) VALUES (org_a, venue_id, 'Cancha 1') RETURNING id INTO field_id;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_a, st_h, st_a, 'scheduled') RETURNING id INTO match_open;

  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
  VALUES (org_a, season_a, uid_ref, 'referee');

  INSERT INTO public.match_officials (
    organization_id, match_id, profile_id, role, status
  ) VALUES (org_a, match_open, uid_ref, 'referee', 'confirmed');

  PERFORM public.__mig034_link_reservation(org_a, field_id, match_open, now() - interval '30 minutes');

  PERFORM public.__mig034_as(uid_ref);

  -- 01 dedup returns same id
  ev_id := public.record_match_event(
    match_open, stp_h, 'goal', 10, NULL, NULL, dedup_key
  );
  ev_id2 := public.record_match_event(
    match_open, stp_h, 'goal', 10, NULL, NULL, dedup_key
  );
  SELECT count(*)::int INTO v_count FROM public.match_events WHERE client_dedup_key = dedup_key;
  INSERT INTO public.__mig034_test_results VALUES (
    '01_dedup_same_client_key',
    ev_id = ev_id2 AND v_count = 1,
    format('ev1=%s ev2=%s count=%s', ev_id, ev_id2, v_count)
  );

  -- 02 assist allowed for goal same team
  ev_id := public.record_match_event(
    match_open, stp_h, 'goal', 11, NULL, stp_h2, gen_random_uuid()::text
  );
  INSERT INTO public.__mig034_test_results VALUES (
    '02_assist_same_team_goal_ok',
    ev_id IS NOT NULL,
    format('ev=%s', ev_id)
  );

  -- 03 assist rejected for yellow_card
  BEGIN
    PERFORM public.record_match_event(
      match_open, stp_h, 'yellow_card', 12, NULL, stp_h2, gen_random_uuid()::text
    );
    v_ok := false;
    v_err := 'assist on card accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig034_test_results VALUES ('03_assist_on_card_fails', v_ok, v_err);

  -- 04 assist rejected for other team
  BEGIN
    PERFORM public.record_match_event(
      match_open, stp_h, 'goal', 13, NULL, stp_a, gen_random_uuid()::text
    );
    v_ok := false;
    v_err := 'cross team assist accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig034_test_results VALUES ('04_assist_other_team_fails', v_ok, v_err);

  -- 05 referee can void within 3 minutes
  ev_id := public.record_match_event(
    match_open, stp_h, 'yellow_card', 14, NULL, NULL, gen_random_uuid()::text
  );
  PERFORM public.void_match_event(ev_id, 'Corrección del árbitro');
  SELECT voided_at IS NOT NULL INTO v_ok FROM public.match_events WHERE id = ev_id;
  INSERT INTO public.__mig034_test_results VALUES (
    '05_referee_void_within_window',
    v_ok,
    format('ev=%s', ev_id)
  );

  -- 06 referee cannot void after 3 minutes
  ev_id := public.record_match_event(
    match_open, stp_h, 'yellow_card', 15, NULL, NULL, gen_random_uuid()::text
  );
  UPDATE public.match_events SET created_at = now() - interval '5 minutes' WHERE id = ev_id;
  BEGIN
    PERFORM public.void_match_event(ev_id, 'Corrección del árbitro');
    v_ok := false;
    v_err := 'old void allowed for referee';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig034_test_results VALUES ('06_referee_void_after_window_fails', v_ok, v_err);

  -- 07 referee can capture without confirmed field_reservation (fixture-only match)
  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_a, st_h, st_a, 'scheduled') RETURNING id INTO match_no_reservation;

  INSERT INTO public.match_officials (
    organization_id, match_id, profile_id, role, status
  ) VALUES (org_a, match_no_reservation, uid_ref, 'referee', 'confirmed');

  PERFORM public.__mig034_as(uid_ref);

  BEGIN
    ev_id := public.record_match_event(
      match_no_reservation, stp_h, 'goal', 1, NULL, NULL, gen_random_uuid()::text
    );
    v_ok := ev_id IS NOT NULL;
    v_err := format('ev=%s', ev_id);
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig034_test_results VALUES (
    '07_referee_capture_without_confirmed_reservation',
    v_ok,
    v_err
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig034_test_results
ORDER BY test_name;

SELECT count(*) FILTER (WHERE NOT passed) AS failures, count(*) AS total
FROM public.__mig034_test_results;
