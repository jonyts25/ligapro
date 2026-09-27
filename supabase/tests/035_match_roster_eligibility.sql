-- Migration 035: get_match_roster_eligibility
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/035_match_roster_eligibility.sql

DROP TABLE IF EXISTS public.__mig035_test_results;
CREATE TABLE public.__mig035_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig035_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0350';
  uid_member uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0351';
  uid_outsider uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0352';
  org_a uuid;
  org_b uuid;
  comp_a uuid;
  season_a uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  player_active uuid;
  player_served uuid;
  player_waived uuid;
  player_clean uuid;
  stp_active uuid;
  stp_served uuid;
  stp_waived uuid;
  stp_clean uuid;
  match_id uuid;
  v_ok boolean;
  v_err text;
  v_count int;
  v_suspended boolean;
  v_remaining int;
  v_type text;
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
  ALTER TABLE public.discipline_suspensions DISABLE TRIGGER USER;

  DELETE FROM public.discipline_suspensions
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE created_by IN (uid_owner, uid_outsider)
  );
  DELETE FROM public.organizations WHERE created_by IN (uid_owner, uid_outsider);
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_member, uid_outsider);

  ALTER TABLE public.discipline_suspensions ENABLE TRIGGER USER;
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
     'owner-mig035@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member, 'authenticated', 'authenticated',
     'member-mig035@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_outsider, 'authenticated', 'authenticated',
     'outsider-mig035@test.local', crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now());

  INSERT INTO public.profiles (id, full_name) VALUES
    (uid_owner, 'Owner 035'),
    (uid_member, 'Member 035'),
    (uid_outsider, 'Outsider 035');

  PERFORM public.__mig035_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Eligibility 035');

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_member, 'organization_member');

  INSERT INTO public.competitions (organization_id, name, slug, format_type)
  VALUES (org_a, 'Liga 035', 'liga-035', 'round_robin')
  RETURNING id INTO comp_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, comp_a, 'Apertura 035', 'apertura-035', 'private')
  RETURNING id INTO season_a;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Local FC') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Visit FC') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_h) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_a) RETURNING id INTO st_a;

  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Suspendido Activo') RETURNING id INTO player_active;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Suspendido Cumplida') RETURNING id INTO player_served;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Suspendido Eximida') RETURNING id INTO player_waived;
  INSERT INTO public.players (organization_id, full_name) VALUES (org_a, 'Sin Suspension') RETURNING id INTO player_clean;

  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_h, player_active, 'active') RETURNING id INTO stp_active;
  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_h, player_served, 'active') RETURNING id INTO stp_served;
  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_h, player_waived, 'active') RETURNING id INTO stp_waived;
  INSERT INTO public.season_team_players (organization_id, season_id, season_team_id, player_id, registration_status)
  VALUES (org_a, season_a, st_a, player_clean, 'active') RETURNING id INTO stp_clean;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_a, st_h, st_a, 'scheduled') RETURNING id INTO match_id;

  INSERT INTO public.discipline_suspensions (
    organization_id, season_team_player_id, suspension_type,
    matches_remaining, status, created_at
  ) VALUES
    (org_a, stp_active, 'accumulation', 3, 'active', now() - interval '2 days'),
    (org_a, stp_active, 'direct_red', 1, 'active', now() - interval '1 day'),
    (org_a, stp_served, 'direct_red', 0, 'served', now() - interval '3 days'),
    (org_a, stp_waived, 'administrative', 0, 'waived', now() - interval '4 days');

  PERFORM public.__mig035_as(uid_member);

  -- 01 active suspension aggregated
  SELECT is_suspended, matches_remaining, suspension_type
  INTO v_suspended, v_remaining, v_type
  FROM public.get_match_roster_eligibility(match_id)
  WHERE season_team_player_id = stp_active;

  INSERT INTO public.__mig035_test_results VALUES (
    '01_active_suspension',
    v_suspended = true AND v_remaining = 4 AND v_type = 'direct_red',
    format('suspended=%s remaining=%s type=%s', v_suspended, v_remaining, v_type)
  );

  -- 02 served suspension not active
  SELECT is_suspended, matches_remaining
  INTO v_suspended, v_remaining
  FROM public.get_match_roster_eligibility(match_id)
  WHERE season_team_player_id = stp_served;

  INSERT INTO public.__mig035_test_results VALUES (
    '02_served_not_suspended',
    v_suspended = false AND v_remaining = 0,
    format('suspended=%s remaining=%s', v_suspended, v_remaining)
  );

  -- 03 waived suspension not active
  SELECT is_suspended, matches_remaining
  INTO v_suspended, v_remaining
  FROM public.get_match_roster_eligibility(match_id)
  WHERE season_team_player_id = stp_waived;

  INSERT INTO public.__mig035_test_results VALUES (
    '03_waived_not_suspended',
    v_suspended = false AND v_remaining = 0,
    format('suspended=%s remaining=%s', v_suspended, v_remaining)
  );

  -- 04 player without suspensions
  SELECT is_suspended, matches_remaining
  INTO v_suspended, v_remaining
  FROM public.get_match_roster_eligibility(match_id)
  WHERE season_team_player_id = stp_clean;

  INSERT INTO public.__mig035_test_results VALUES (
    '04_no_suspensions',
    v_suspended = false AND v_remaining = 0,
    format('suspended=%s remaining=%s', v_suspended, v_remaining)
  );

  -- 05 org member can read both teams
  SELECT count(*)::int INTO v_count
  FROM public.get_match_roster_eligibility(match_id);

  INSERT INTO public.__mig035_test_results VALUES (
    '05_member_reads_full_roster',
    v_count = 4,
    format('rows=%s', v_count)
  );

  -- 06 outsider from another org cannot read
  PERFORM public.__mig035_as(uid_outsider);
  org_b := public.create_organization_with_owner('Org Other 035');

  BEGIN
    PERFORM public.get_match_roster_eligibility(match_id);
    v_ok := false;
    v_err := 'outsider read allowed';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;

  INSERT INTO public.__mig035_test_results VALUES (
    '06_outsider_denied',
    v_ok,
    v_err
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig035_test_results
ORDER BY test_name;

SELECT count(*) FILTER (WHERE NOT passed) AS failures, count(*) AS total
FROM public.__mig035_test_results;
