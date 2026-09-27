-- Migration 036: get_organization_matchday
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/036_organization_matchday.sql

DROP TABLE IF EXISTS public.__mig036_test_results;
CREATE TABLE public.__mig036_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig036_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0360';
  uid_member uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0361';
  uid_outsider uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0362';
  org_a uuid;
  org_b uuid;
  comp_a uuid;
  comp_arch uuid;
  season_a uuid;
  season_arch uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  st_h_arch uuid;
  st_a_arch uuid;
  player_h uuid;
  player_a uuid;
  stp_h uuid;
  stp_a uuid;
  venue_id uuid;
  field_id uuid;
  match_today uuid;
  match_archived uuid;
  match_other_org uuid;
  local_date date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  starts_local timestamptz;
  v_count int;
  v_home int;
  v_away int;
  v_dispute boolean;
  v_err text;
  v_ok boolean;
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
  ALTER TABLE public.match_participants DISABLE TRIGGER USER;
  ALTER TABLE public.match_result_disputes DISABLE TRIGGER USER;
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;

  DELETE FROM public.organizations WHERE created_by IN (uid_owner, uid_outsider);
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_member, uid_outsider);

  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
  ALTER TABLE public.match_result_disputes ENABLE TRIGGER USER;
  ALTER TABLE public.match_participants ENABLE TRIGGER USER;
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
     'owner-mig036@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member, 'authenticated', 'authenticated',
     'member-mig036@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_outsider, 'authenticated', 'authenticated',
     'outsider-mig036@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now());

  INSERT INTO public.profiles (id, full_name) VALUES
    (uid_owner, 'Owner 036'),
    (uid_member, 'Member 036'),
    (uid_outsider, 'Outsider 036');

  PERFORM public.__mig036_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Matchday 036');

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_member, 'organization_member');

  INSERT INTO public.competitions (organization_id, name, slug, format_type)
  VALUES (org_a, 'Liga 036', 'liga-036', 'round_robin')
  RETURNING id INTO comp_a;

  INSERT INTO public.competitions (organization_id, name, slug, format_type)
  VALUES (org_a, 'Archivada 036', 'arch-036', 'round_robin')
  RETURNING id INTO comp_arch;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, comp_a, 'Apertura 036', 'apertura-036', 'private')
  RETURNING id INTO season_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, comp_arch, 'Archivada 036', 'archivada-036', 'archived')
  RETURNING id INTO season_arch;

  INSERT INTO public.season_rules (organization_id, season_id, match_duration_minutes)
  VALUES (org_a, season_a, 90);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Local FC') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Visit FC') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_h) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_a) RETURNING id INTO st_a;

  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_arch, team_h) RETURNING id INTO st_h_arch;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_arch, team_a) RETURNING id INTO st_a_arch;

  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Jugador H') RETURNING id INTO player_h;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Jugador A') RETURNING id INTO player_a;

  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_h, player_h, 'active') RETURNING id INTO stp_h;
  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_a, player_a, 'active') RETURNING id INTO stp_a;

  INSERT INTO public.venues (organization_id, name) VALUES (org_a, 'Sede 036') RETURNING id INTO venue_id;
  INSERT INTO public.fields (organization_id, venue_id, name) VALUES (org_a, venue_id, 'Cancha 1') RETURNING id INTO field_id;

  starts_local := (local_date::text || ' 15:00:00')::timestamp AT TIME ZONE 'America/Mexico_City';

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_a, st_h, st_a, 'finished') RETURNING id INTO match_today;

  INSERT INTO public.field_reservations (
    organization_id, field_id, match_id, reservation_type, status, starts_at, ends_at
  ) VALUES (
    org_a, field_id, match_today, 'match', 'confirmed', starts_local, starts_local + interval '2 hours'
  );

  INSERT INTO public.match_participants (match_id, season_team_player_id, organization_id, status)
  VALUES
    (match_today, stp_h, org_a, 'played'),
    (match_today, stp_a, org_a, 'played');

  INSERT INTO public.match_result_disputes (
    match_id, organization_id, season_team_id, opened_by_profile_id, reason, status
  ) VALUES (
    match_today, org_a, st_h, uid_owner, 'Marcador incorrecto', 'open'
  );

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_arch, st_h_arch, st_a_arch, 'scheduled')
  RETURNING id INTO match_archived;

  INSERT INTO public.field_reservations (
    organization_id, field_id, match_id, reservation_type, status, starts_at, ends_at
  ) VALUES (
    org_a, field_id, match_archived, 'match', 'confirmed', starts_local, starts_local + interval '2 hours'
  );

  PERFORM public.__mig036_as(uid_outsider);
  org_b := public.create_organization_with_owner('Org Other 036');

  INSERT INTO public.competitions (organization_id, name, slug, format_type)
  VALUES (org_b, 'Otra liga', 'otra-036', 'round_robin');

  PERFORM public.__mig036_as(uid_member);

  -- 01 only active-season match for org_a on local date
  SELECT count(*)::int INTO v_count
  FROM public.get_organization_matchday(org_a, local_date)
  WHERE match_id = match_today;

  INSERT INTO public.__mig036_test_results VALUES (
    '01_active_season_match_listed',
    v_count = 1,
    format('count=%s', v_count)
  );

  -- 02 archived season excluded
  SELECT count(*)::int INTO v_count
  FROM public.get_organization_matchday(org_a, local_date)
  WHERE match_id = match_archived;

  INSERT INTO public.__mig036_test_results VALUES (
    '02_archived_season_excluded',
    v_count = 0,
    format('count=%s', v_count)
  );

  -- 03 validated counts
  SELECT home_validated_count, away_validated_count
  INTO v_home, v_away
  FROM public.get_organization_matchday(org_a, local_date)
  WHERE match_id = match_today;

  INSERT INTO public.__mig036_test_results VALUES (
    '03_validated_counts',
    v_home = 1 AND v_away = 1,
    format('home=%s away=%s', v_home, v_away)
  );

  -- 04 open dispute reflected
  SELECT has_open_dispute INTO v_dispute
  FROM public.get_organization_matchday(org_a, local_date)
  WHERE match_id = match_today;

  INSERT INTO public.__mig036_test_results VALUES (
    '04_open_dispute',
    v_dispute = true,
    format('dispute=%s', v_dispute)
  );

  -- 05 outsider cannot read org_a matchday
  PERFORM public.__mig036_as(uid_outsider);
  BEGIN
    PERFORM public.get_organization_matchday(org_a, local_date);
    v_ok := false;
    v_err := 'outsider read allowed';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;

  INSERT INTO public.__mig036_test_results VALUES (
    '05_outsider_denied',
    v_ok,
    v_err
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig036_test_results
ORDER BY test_name;

SELECT count(*) FILTER (WHERE NOT passed) AS failures, count(*) AS total
FROM public.__mig036_test_results;
