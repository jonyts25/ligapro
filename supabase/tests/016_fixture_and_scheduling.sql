-- Migration 016: fixture round-robin + schedule/unschedule match RPCs
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/016_fixture_and_scheduling.sql

-- ---------------------------------------------------------------------------
-- Helpers: valid 4-team fixtures (circle method)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__mig016_single_fixture_4(
  p_st1 uuid,
  p_st2 uuid,
  p_st3 uuid,
  p_st4 uuid
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object(
      'away_season_team_id', p_st4,
      'home_season_team_id', p_st1,
      'leg_number', 1,
      'round_number', 1,
      'sequence_in_round', 1
    ),
    jsonb_build_object(
      'away_season_team_id', p_st3,
      'home_season_team_id', p_st2,
      'leg_number', 1,
      'round_number', 1,
      'sequence_in_round', 2
    ),
    jsonb_build_object(
      'away_season_team_id', p_st3,
      'home_season_team_id', p_st4,
      'leg_number', 1,
      'round_number', 2,
      'sequence_in_round', 1
    ),
    jsonb_build_object(
      'away_season_team_id', p_st2,
      'home_season_team_id', p_st1,
      'leg_number', 1,
      'round_number', 2,
      'sequence_in_round', 2
    ),
    jsonb_build_object(
      'away_season_team_id', p_st1,
      'home_season_team_id', p_st3,
      'leg_number', 1,
      'round_number', 3,
      'sequence_in_round', 1
    ),
    jsonb_build_object(
      'away_season_team_id', p_st2,
      'home_season_team_id', p_st4,
      'leg_number', 1,
      'round_number', 3,
      'sequence_in_round', 2
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.__mig016_double_fixture_4(
  p_st1 uuid,
  p_st2 uuid,
  p_st3 uuid,
  p_st4 uuid
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    -- leg 1
    jsonb_build_object('away_season_team_id', p_st4, 'home_season_team_id', p_st1, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st3, 'home_season_team_id', p_st2, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', p_st3, 'home_season_team_id', p_st4, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st2, 'home_season_team_id', p_st1, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', p_st1, 'home_season_team_id', p_st3, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st2, 'home_season_team_id', p_st4, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 2),
    -- leg 2 (inverted home/away)
    jsonb_build_object('away_season_team_id', p_st1, 'home_season_team_id', p_st4, 'leg_number', 2, 'round_number', 4, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st2, 'home_season_team_id', p_st3, 'leg_number', 2, 'round_number', 4, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', p_st4, 'home_season_team_id', p_st3, 'leg_number', 2, 'round_number', 5, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st1, 'home_season_team_id', p_st2, 'leg_number', 2, 'round_number', 5, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', p_st3, 'home_season_team_id', p_st1, 'leg_number', 2, 'round_number', 6, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st4, 'home_season_team_id', p_st2, 'leg_number', 2, 'round_number', 6, 'sequence_in_round', 2)
  );
$$;

DROP TABLE IF EXISTS public.__mig016_test_results;
CREATE TABLE public.__mig016_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0160';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0161';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0162';
  uid_tadmin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0163';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0160';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_a2 uuid;
  competition_b uuid;
  season_x uuid;
  season_y uuid;
  season_z uuid;
  season_val uuid;
  season_few uuid;
  season_b uuid;
  team1 uuid;
  team2 uuid;
  team3 uuid;
  team4 uuid;
  team5 uuid;
  team_b1 uuid;
  team_b2 uuid;
  st1 uuid;
  st2 uuid;
  st3 uuid;
  st4 uuid;
  st5 uuid;
  st_y1 uuid;
  st_y2 uuid;
  st_y3 uuid;
  st_y4 uuid;
  st_z1 uuid;
  st_z2 uuid;
  st_z3 uuid;
  st_z4 uuid;
  st_v1 uuid;
  st_v2 uuid;
  st_v3 uuid;
  st_v4 uuid;
  st_few uuid;
  st_b1 uuid;
  st_b2 uuid;
  venue_a uuid;
  venue_b uuid;
  field_a uuid;
  field_inactive uuid;
  field_b uuid;
  match_m1 uuid;
  match_m2 uuid;
  match_m3 uuid;
  match_finished uuid;
  res_m1 uuid;
  res_block uuid;
  v_fixture jsonb;
  v_fixture_dup jsonb;
  v_count int;
  v_ok boolean;
  v_args text;
  v_err text;
  v_sqlstate text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_res_status text;
  v_match_status text;
  v_link uuid;
  v_audit int;
  v_pairs int;
  mon_10am timestamptz := timestamptz '2026-07-13 16:00:00+00';
  mon_1030am timestamptz := timestamptz '2026-07-13 16:30:00+00';
  mon_12pm timestamptz := timestamptz '2026-07-13 18:00:00+00';
  sun_10am timestamptz := timestamptz '2026-07-12 16:00:00+00';
  mon_6am timestamptz := timestamptz '2026-07-13 12:00:00+00';
  mon_9pm timestamptz := timestamptz '2026-07-14 03:00:00+00';
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER USER;
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b)
     OR slug LIKE 'org-%-mig016%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b);

  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
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
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig016.local', '$2a$06$testhashligapromigration016aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig016.local', '$2a$06$testhashligapromigration016aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig016.local', '$2a$06$testhashligapromigration016aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tadmin_a, 'authenticated', 'authenticated',
     'tadmin-a@ligapro-mig016.local', '$2a$06$testhashligapromigration016aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig016.local', '$2a$06$testhashligapromigration016aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig016');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tadmin_a, 'organization_member');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga A') RETURNING id INTO competition_a;
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Copa A') RETURNING id INTO competition_a2;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a, org_a, 'Apertura X', 'apertura-x-016', 'round_robin')
    RETURNING id INTO season_x;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a, org_a, 'Clausura Y', 'clausura-y-016', 'round_robin')
    RETURNING id INTO season_y;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a2, org_a, 'Doble Z', 'doble-z-016', 'round_robin')
    RETURNING id INTO season_z;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a, org_a, 'Validacion V', 'validacion-v-016', 'round_robin')
    RETURNING id INTO season_val;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES
    (competition_a, org_a, 'Pocos P', 'pocos-p-016', 'round_robin')
    RETURNING id INTO season_few;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Team 1') RETURNING id INTO team1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Team 2') RETURNING id INTO team2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Team 3') RETURNING id INTO team3;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Team 4') RETURNING id INTO team4;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Team 5') RETURNING id INTO team5;
  INSERT INTO public.venues (organization_id, name, address)
  VALUES (org_a, 'Venue A', 'Addr A') RETURNING id INTO venue_a;
  INSERT INTO public.fields (venue_id, organization_id, name, surface_type)
  VALUES (venue_a, org_a, 'Field A1', 'pasto') RETURNING id INTO field_a;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field Inactive') RETURNING id INTO field_inactive;
  EXECUTE 'RESET ROLE';

  -- Org B (foreign field / foreign season_team)
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig016');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Temp B', 'temp-b-016', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Team B1') RETURNING id INTO team_b1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Team B2') RETURNING id INTO team_b2;
  INSERT INTO public.venues (organization_id, name) VALUES (org_b, 'Venue B') RETURNING id INTO venue_b;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_b, org_b, 'Field B') RETURNING id INTO field_b;
  EXECUTE 'RESET ROLE';

  -- Season rules: duration 90, rest 0 (defaults; verify)
  UPDATE public.season_rules
  SET match_duration_minutes = 90, minimum_rest_minutes = 0
  WHERE season_id IN (season_x, season_y, season_z, season_val, season_few, season_b);

  -- Field availability: Monday 08:00-22:00 (dow=1)
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.replace_field_availability(
    field_a,
    '[{"day_of_week":1,"starts_at":"08:00","ends_at":"22:00"}]'::jsonb
  );
  UPDATE public.fields SET is_active = false WHERE id = field_inactive;
  EXECUTE 'RESET ROLE';

  -- Enroll season teams
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  st1 := public.enroll_team_in_season(season_x, team1, NULL, NULL, 'registered');
  st2 := public.enroll_team_in_season(season_x, team2, NULL, NULL, 'confirmed');
  st3 := public.enroll_team_in_season(season_x, team3, NULL, NULL, 'registered');
  st4 := public.enroll_team_in_season(season_x, team4, NULL, NULL, 'confirmed');
  st5 := public.enroll_team_in_season(season_x, team5, NULL, NULL, 'withdrawn');
  st_y1 := public.enroll_team_in_season(season_y, team1, NULL, NULL, 'registered');
  st_y2 := public.enroll_team_in_season(season_y, team2, NULL, NULL, 'registered');
  st_y3 := public.enroll_team_in_season(season_y, team3, NULL, NULL, 'registered');
  st_y4 := public.enroll_team_in_season(season_y, team4, NULL, NULL, 'registered');
  st_z1 := public.enroll_team_in_season(season_z, team1, NULL, NULL, 'registered');
  st_z2 := public.enroll_team_in_season(season_z, team2, NULL, NULL, 'registered');
  st_z3 := public.enroll_team_in_season(season_z, team3, NULL, NULL, 'registered');
  st_z4 := public.enroll_team_in_season(season_z, team4, NULL, NULL, 'registered');
  st_v1 := public.enroll_team_in_season(season_val, team1, NULL, NULL, 'registered');
  st_v2 := public.enroll_team_in_season(season_val, team2, NULL, NULL, 'registered');
  st_v3 := public.enroll_team_in_season(season_val, team3, NULL, NULL, 'registered');
  st_v4 := public.enroll_team_in_season(season_val, team4, NULL, NULL, 'registered');
  st_few := public.enroll_team_in_season(season_few, team1, NULL, NULL, 'registered');
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
  VALUES (org_a, season_x, uid_tadmin_a, 'tournament_admin');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  st_b1 := public.enroll_team_in_season(season_b, team_b1, NULL, NULL, 'registered');
  st_b2 := public.enroll_team_in_season(season_b, team_b2, NULL, NULL, 'registered');
  EXECUTE 'RESET ROLE';

  v_fixture := public.__mig016_single_fixture_4(st_v1, st_v2, st_v3, st_v4);

  -- RPC signature hardening (no org_id in args)
  SELECT pg_get_function_identity_arguments(
    'public.create_season_round_robin_fixture(uuid,text,jsonb)'::regprocedure
  ) INTO v_args;
  INSERT INTO public.__mig016_test_results VALUES (
    '40_fixture_rpc_no_organization_id',
    v_args NOT ILIKE '%organization_id%',
    format('args=%s', v_args)
  );
  SELECT pg_get_function_identity_arguments(
    'public.schedule_match(uuid,uuid,timestamptz)'::regprocedure
  ) INTO v_args;
  INSERT INTO public.__mig016_test_results VALUES (
    '41_schedule_rpc_no_organization_id',
    v_args NOT ILIKE '%organization_id%',
    format('args=%s', v_args)
  );
  SELECT pg_get_function_identity_arguments(
    'public.unschedule_match(uuid)'::regprocedure
  ) INTO v_args;
  INSERT INTO public.__mig016_test_results VALUES (
    '42_unschedule_rpc_no_organization_id',
    v_args NOT ILIKE '%organization_id%',
    format('args=%s', v_args)
  );

  -- PUBLIC cannot execute RPCs
  SELECT NOT has_function_privilege(
    'public', 'public.create_season_round_robin_fixture(uuid,text,jsonb)', 'EXECUTE'
  ) INTO v_ok;
  INSERT INTO public.__mig016_test_results VALUES (
    '06_public_no_execute_fixture_rpc', v_ok, format('ok=%s', v_ok)
  );
  SELECT NOT has_function_privilege(
    'public', 'public.schedule_match(uuid,uuid,timestamptz)', 'EXECUTE'
  ) INTO v_ok;
  INSERT INTO public.__mig016_test_results VALUES (
    '06b_public_no_execute_schedule_rpc', v_ok, format('ok=%s', v_ok)
  );
  SELECT NOT has_function_privilege(
    'public', 'public.unschedule_match(uuid)', 'EXECUTE'
  ) INTO v_ok;
  INSERT INTO public.__mig016_test_results VALUES (
    '06c_public_no_execute_unschedule_rpc', v_ok, format('ok=%s', v_ok)
  );

  -- 07 fewer than two eligible teams
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_few, 'single', public.__mig016_single_fixture_4(st_few, st_few, st_few, st_few)
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '07_fewer_than_two_teams_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '07_fewer_than_two_teams_fails',
      SQLERRM ILIKE '%At least two eligible teams%',
      SQLERRM
    );
  END;

  -- 08 foreign season team
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_val,
      'single',
      jsonb_set(
        v_fixture,
        '{0,home_season_team_id}',
        to_jsonb(st_b1::text)
      )
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '08_foreign_season_team_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '08_foreign_season_team_fails',
      SQLERRM ILIKE '%not eligible%' OR SQLERRM ILIKE '%Season team%',
      SQLERRM
    );
  END;

  -- 09 withdrawn team in payload
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_val,
      'single',
      jsonb_set(
        v_fixture,
        '{0,away_season_team_id}',
        to_jsonb(st5::text)
      )
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '09_withdrawn_team_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '09_withdrawn_team_fails',
      SQLERRM ILIKE '%not eligible%' OR SQLERRM ILIKE '%Season team%',
      SQLERRM
    );
  END;

  -- 10 home equals away
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_val,
      'single',
      jsonb_set(
        v_fixture,
        '{0,away_season_team_id}',
        to_jsonb(st_v1::text)
      )
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '10_home_equals_away_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '10_home_equals_away_fails',
      SQLERRM ILIKE '%distinct%',
      SQLERRM
    );
  END;

  -- 11 duplicate pair (repeated 1-2 and 3-4, missing other pairs)
  v_fixture_dup := jsonb_build_array(
    jsonb_build_object('away_season_team_id', st_v2, 'home_season_team_id', st_v1, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', st_v4, 'home_season_team_id', st_v3, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', st_v3, 'home_season_team_id', st_v1, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', st_v4, 'home_season_team_id', st_v2, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', st_v1, 'home_season_team_id', st_v2, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', st_v3, 'home_season_team_id', st_v4, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 2)
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(season_val, 'single', v_fixture_dup);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '11_duplicate_pair_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '11_duplicate_pair_fails',
      SQLERRM ILIKE '%pair%' OR SQLERRM ILIKE '%exactly once%',
      SQLERRM
    );
  END;

  -- 12 team twice in same round
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_val,
      'single',
      jsonb_build_array(
        jsonb_build_object('away_season_team_id', st_v2, 'home_season_team_id', st_v1, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 1),
        jsonb_build_object('away_season_team_id', st_v3, 'home_season_team_id', st_v1, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 2),
        jsonb_build_object('away_season_team_id', st_v3, 'home_season_team_id', st_v4, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 1),
        jsonb_build_object('away_season_team_id', st_v2, 'home_season_team_id', st_v4, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 2),
        jsonb_build_object('away_season_team_id', st_v1, 'home_season_team_id', st_v3, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 1),
        jsonb_build_object('away_season_team_id', st_v2, 'home_season_team_id', st_v4, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 2)
      )
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '12_team_twice_same_round_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '12_team_twice_same_round_fails',
      SQLERRM ILIKE '%twice in the same round%',
      SQLERRM
    );
  END;

  -- 01 owner creates fixture on season_x
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count
    FROM public.create_season_round_robin_fixture(
      season_x,
      'single',
      public.__mig016_single_fixture_4(st1, st2, st3, st4)
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '01_owner_fixture_pass',
      v_count = 6,
      format('matches=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '01_owner_fixture_pass', false, SQLERRM
    );
  END;

  -- 13 single mode each pair exactly once
  SELECT count(*) INTO v_pairs
  FROM (
    SELECT
      LEAST(home_season_team_id::text, away_season_team_id::text)
        || ':' ||
      GREATEST(home_season_team_id::text, away_season_team_id::text) AS pair_key
    FROM public.matches
    WHERE season_id = season_x
    GROUP BY 1
    HAVING count(*) = 1
  ) p;
  INSERT INTO public.__mig016_test_results VALUES (
    '13_single_pairs_ok',
    v_pairs = 6,
    format('unique_pairs=%s', v_pairs)
  );

  -- 43 audit_log for match inserts from fixture
  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'matches'
    AND action = 'insert'
    AND entity_id IN (SELECT id FROM public.matches WHERE season_id = season_x);
  INSERT INTO public.__mig016_test_results VALUES (
    '43_fixture_match_insert_audit',
    v_audit = 6,
    format('audit_rows=%s', v_audit)
  );

  -- 14 already has matches blocks regeneration
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_x,
      'single',
      public.__mig016_single_fixture_4(st1, st2, st3, st4)
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '14_already_has_matches_blocks', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '14_already_has_matches_blocks',
      SQLERRM ILIKE '%already has matches%',
      SQLERRM
    );
  END;

  -- 02 admin creates fixture on season_y
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count
    FROM public.create_season_round_robin_fixture(
      season_y,
      'single',
      public.__mig016_single_fixture_4(st_y1, st_y2, st_y3, st_y4)
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '02_admin_fixture_pass',
      v_count = 6,
      format('matches=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '02_admin_fixture_pass', false, SQLERRM
    );
  END;

  -- 15 double mode inverted on season_z
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count
    FROM public.create_season_round_robin_fixture(
      season_z,
      'double',
      public.__mig016_double_fixture_4(st_z1, st_z2, st_z3, st_z4)
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '15_double_inverted_pass',
      v_count = 12,
      format('matches=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '15_double_inverted_pass', false, SQLERRM
    );
  END;

  -- 03 member cannot create fixture
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_val, 'single', v_fixture
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '03_member_fixture_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '03_member_fixture_fails',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 04 tournament_admin cannot create fixture
  PERFORM set_config('request.jwt.claim.sub', uid_tadmin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tadmin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_round_robin_fixture(
      season_val, 'single', v_fixture
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '04_tadmin_fixture_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '04_tadmin_fixture_fails',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 05 anon cannot create fixture
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.create_season_round_robin_fixture(
      season_val, 'single', v_fixture
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '05_anon_fixture_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '05_anon_fixture_fails', true, SQLERRM
    );
  END;

  -- Pick matches from season_x for scheduling tests
  SELECT id INTO match_m1
  FROM public.matches
  WHERE season_id = season_x AND round_number = 1 AND sequence_in_round = 1;
  SELECT id INTO match_m2
  FROM public.matches
  WHERE season_id = season_x AND round_number = 1 AND sequence_in_round = 2;
  SELECT id INTO match_m3
  FROM public.matches
  WHERE season_id = season_x AND round_number = 2 AND sequence_in_round = 1;

  -- 16 owner schedules match inside availability
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m1, field_a, mon_10am);
    SELECT field_reservation_id INTO v_link FROM public.matches WHERE id = match_m1;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '16_schedule_owner_inside_avail',
      v_link IS NOT NULL,
      format('reservation_id=%s', v_link)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '16_schedule_owner_inside_avail', false, SQLERRM
    );
  END;

  -- 24 ends_at = starts_at + 90 minutes
  SELECT fr.starts_at, fr.ends_at INTO v_starts, v_ends
  FROM public.field_reservations fr
  JOIN public.matches m ON m.field_reservation_id = fr.id
  WHERE m.id = match_m1;
  INSERT INTO public.__mig016_test_results VALUES (
    '24_ends_at_start_plus_90min',
    v_ends = v_starts + interval '90 minutes',
    format('starts=%s ends=%s', v_starts, v_ends)
  );

  -- 17 member cannot schedule
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_a, mon_12pm);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '17_member_schedule_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '17_member_schedule_fails',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 18 foreign field
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_b, mon_12pm);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '18_foreign_field_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '18_foreign_field_fails',
      SQLERRM ILIKE '%does not belong%',
      SQLERRM
    );
  END;

  -- 19 inactive field
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_inactive, mon_12pm);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '19_inactive_field_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '19_inactive_field_fails',
      SQLERRM ILIKE '%inactive%',
      SQLERRM
    );
  END;

  -- 20 inactive venue
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.venues SET is_active = false WHERE id = venue_a;
  EXECUTE 'RESET ROLE';
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_a, mon_12pm);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '20_inactive_venue_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '20_inactive_venue_fails',
      SQLERRM ILIKE '%Venue is inactive%',
      SQLERRM
    );
  END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.venues SET is_active = true WHERE id = venue_a;
  EXECUTE 'RESET ROLE';

  -- 21 no availability on weekday (Sunday)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_a, sun_10am);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '21_no_avail_weekday_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '21_no_avail_weekday_fails',
      SQLERRM ILIKE '%no availability rules for this weekday%',
      SQLERRM
    );
  END;

  -- 22 outside availability (too early Monday)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_a, mon_6am);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '22_outside_avail_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '22_outside_avail_fails',
      SQLERRM ILIKE '%outside field availability%',
      SQLERRM
    );
  END;

  -- 22b outside availability (ends after 22:00)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_a, mon_9pm);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '22b_outside_avail_late_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '22b_outside_avail_late_fails',
      SQLERRM ILIKE '%outside field availability%',
      SQLERRM
    );
  END;

  -- 23 schedule second match inside availability (for overlap test)
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m2, field_a, mon_12pm);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '23_schedule_second_inside_avail', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '23_schedule_second_inside_avail', false, SQLERRM
    );
  END;

  -- 25 overlap fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(match_m3, field_a, mon_1030am);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '25_overlap_fails', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '25_overlap_fails',
      SQLERRM ILIKE '%no_overlapping_reservations%'
        OR SQLERRM ILIKE '%overlap%'
        OR SQLERRM ILIKE '%exclude%',
      SQLERRM
    );
  END;

  -- 26 reschedule ok (match_m1 from 10:00 to 14:00 local = 20:00 UTC)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT field_reservation_id INTO res_m1 FROM public.matches WHERE id = match_m1;
    PERFORM public.schedule_match(
      match_m1,
      field_a,
      timestamptz '2026-07-13 20:00:00+00'
    );
    SELECT fr.starts_at, fr.id INTO v_starts, v_link
    FROM public.field_reservations fr
    WHERE fr.id = res_m1;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '26_reschedule_ok',
      v_link = res_m1
        AND v_starts = timestamptz '2026-07-13 20:00:00+00',
      format('same_res=%s starts=%s', v_link = res_m1, v_starts)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '26_reschedule_ok', false, SQLERRM
    );
  END;

  -- 31 finished match cannot be unscheduled (before blocking reservation)
  SELECT id INTO match_finished
  FROM public.matches
  WHERE season_id = season_x AND round_number = 2 AND sequence_in_round = 2;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.schedule_match(
    match_finished,
    field_a,
    timestamptz '2026-07-13 21:30:00+00'
  );
  UPDATE public.matches SET status = 'finished' WHERE id = match_finished;
  EXECUTE 'RESET ROLE';
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.unschedule_match(match_finished);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '31_finished_cannot_unschedule', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '31_finished_cannot_unschedule',
      SQLERRM ILIKE '%started or finished%',
      SQLERRM
    );
  END;

  -- 27 failed reschedule preserves original slot (blocking reservation)
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.field_reservations (
    organization_id, field_id, reservation_type, starts_at, ends_at, title, status
  ) VALUES (
    org_a, field_a, 'manual_block',
    timestamptz '2026-07-13 23:00:00+00',
    timestamptz '2026-07-14 00:30:00+00',
    'Block reschedule',
    'confirmed'
  ) RETURNING id INTO res_block;
  EXECUTE 'RESET ROLE';

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.schedule_match(
      match_m1,
      field_a,
      timestamptz '2026-07-13 23:00:00+00'
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '27_failed_reschedule_preserves', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT fr.starts_at INTO v_starts
    FROM public.field_reservations fr
    WHERE fr.id = res_m1;
    INSERT INTO public.__mig016_test_results VALUES (
      '27_failed_reschedule_preserves',
      SQLERRM ILIKE '%overlap%' OR SQLERRM ILIKE '%no_overlapping%'
        OR SQLERRM ILIKE '%outside%',
      format('err=%s preserved_starts=%s', SQLERRM, v_starts)
    );
  END;

  SELECT fr.starts_at INTO v_starts
  FROM public.field_reservations fr WHERE fr.id = res_m1;
  INSERT INTO public.__mig016_test_results VALUES (
    '27b_reservation_still_at_prior_slot',
    v_starts = timestamptz '2026-07-13 20:00:00+00',
    format('starts=%s', v_starts)
  );

  -- 28 one confirmed reservation per match (unique index)
  SELECT count(*) INTO v_count
  FROM public.field_reservations
  WHERE match_id = match_m2
    AND status = 'confirmed'
    AND reservation_type = 'match';
  INSERT INTO public.__mig016_test_results VALUES (
    '28_one_confirmed_reservation_per_match',
    v_count = 1,
    format('confirmed_match_res=%s', v_count)
  );
  BEGIN
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, match_id,
      starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a, 'match', match_m2,
      timestamptz '2026-07-14 01:30:00+00',
      timestamptz '2026-07-14 03:00:00+00',
      'Dup',
      'confirmed'
    );
    INSERT INTO public.__mig016_test_results VALUES (
      '28b_duplicate_confirmed_reservation_blocked', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    INSERT INTO public.__mig016_test_results VALUES (
      '28b_duplicate_confirmed_reservation_blocked',
      v_sqlstate = '23505' OR SQLERRM ILIKE '%one_confirmed_per_match%',
      SQLERRM
    );
  END;

  -- 29 unschedule cancels reservation and clears link
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT field_reservation_id INTO res_m1 FROM public.matches WHERE id = match_m2;
    PERFORM public.unschedule_match(match_m2);
    SELECT field_reservation_id, status INTO v_link, v_match_status
    FROM public.matches WHERE id = match_m2;
    SELECT status INTO v_res_status
    FROM public.field_reservations WHERE id = res_m1;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '29_unschedule_cancels_and_clears_link',
      v_link IS NULL AND v_res_status = 'cancelled',
      format('link=%s res_status=%s', v_link, v_res_status)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig016_test_results VALUES (
      '29_unschedule_cancels_and_clears_link', false, SQLERRM
    );
  END;

  -- 30 match row remains after unschedule
  SELECT count(*) INTO v_count FROM public.matches WHERE id = match_m2;
  INSERT INTO public.__mig016_test_results VALUES (
    '30_match_row_remains',
    v_count = 1,
    format('rows=%s', v_count)
  );

  -- Cleanup
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER USER;
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;

  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b);

  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
  ALTER TABLE public.season_rules ENABLE TRIGGER USER;
  ALTER TABLE public.seasons ENABLE TRIGGER USER;
  ALTER TABLE public.competitions ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;
END $$;

SELECT test_name, passed, details
FROM public.__mig016_test_results
ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  count(*) AS total
FROM public.__mig016_test_results;

DROP TABLE IF EXISTS public.__mig016_test_results;
DROP FUNCTION IF EXISTS public.__mig016_single_fixture_4(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.__mig016_double_fixture_4(uuid, uuid, uuid, uuid);
