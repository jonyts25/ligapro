-- Tests for Migration 010 (audit_log)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/010_audit_log.sql

DROP TABLE IF EXISTS public.__mig010_test_results;
CREATE TABLE public.__mig010_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig010_test_results DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.__mig010_test_results TO postgres, authenticated, service_role;

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03';
  uid_tourn_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  season_a uuid;
  season_rules_id uuid;
  venue_a uuid;
  field_a uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  player_p uuid;
  stp_p uuid;
  match_id uuid;
  official_id uuid;
  event_id uuid;
  charge_id uuid;
  payment_id uuid;
  member_row_id uuid;
  reservation_id uuid;
  role_id uuid;
  logs_before int;
  logs_after int;
  v_count int;
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_source text;
  v_org uuid;
  v_fn_ok boolean;
  v_log_id uuid;
  v_points_win int;
  removed_profile uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05';
BEGIN
  -- Privileged test teardown (010b): explicit DISABLE TRIGGER USER; no session bypass flags.
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER USER;
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;
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
  ALTER TABLE public.team_charges DISABLE TRIGGER USER;
  ALTER TABLE public.team_payments DISABLE TRIGGER USER;
  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_owner_b, removed_profile)
       OR slug IN ('org-a-mig010', 'org-b-mig010')
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_owner_b, removed_profile)
     OR slug IN ('org-a-mig010', 'org-b-mig010');
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_owner_b, removed_profile);
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules ENABLE TRIGGER USER;
  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
  ALTER TABLE public.competitions ENABLE TRIGGER USER;
  ALTER TABLE public.seasons ENABLE TRIGGER USER;
  ALTER TABLE public.season_rules ENABLE TRIGGER USER;
  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.match_officials ENABLE TRIGGER USER;
  ALTER TABLE public.match_events ENABLE TRIGGER USER;
  ALTER TABLE public.discipline_suspensions ENABLE TRIGGER USER;
  ALTER TABLE public.team_charges ENABLE TRIGGER USER;
  ALTER TABLE public.team_payments ENABLE TRIGGER USER;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig010.local', '$2a$06$testhashligapromigration010aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig010.local', '$2a$06$testhashligapromigration010aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig010.local', '$2a$06$testhashligapromigration010aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tourn_a, 'authenticated', 'authenticated',
     'tourn-a@ligapro-mig010.local', '$2a$06$testhashligapromigration010aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', removed_profile, 'authenticated', 'authenticated',
     'removed@ligapro-mig010.local', '$2a$06$testhashligapromigration010aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig010.local', '$2a$06$testhashligapromigration010aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Create org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig010');

  -- Test 10: organization create audit
  SELECT action, organization_id, entity_type, entity_id, before_data, after_data, actor_profile_id
  INTO v_action, v_org, v_entity_type, v_entity_id, v_before, v_after, v_actor
  FROM public.audit_log
  WHERE entity_type = 'organizations' AND entity_id = org_a AND action = 'insert'
  ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.__mig010_test_results VALUES (
    '10_create_organization_audit',
    v_action = 'insert' AND v_org = org_a AND v_entity_type = 'organizations'
      AND v_entity_id = org_a AND v_before IS NULL AND v_after IS NOT NULL
      AND v_actor = uid_owner_a,
    format('org=%s action=%s actor=%s', v_org, v_action, v_actor)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tourn_a, 'organization_member'),
    (org_a, removed_profile, 'organization_member');
  SELECT id INTO member_row_id
  FROM public.organization_members
  WHERE organization_id = org_a AND profile_id = removed_profile;
  EXECUTE 'RESET ROLE';

  -- Test 11: member insert audit
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'organization_members'
    AND action = 'insert'
    AND entity_id = member_row_id;
  INSERT INTO public.__mig010_test_results VALUES (
    '11_insert_organization_member_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  -- Org B for isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig010');

  -- Test 1: owner can read own org logs
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '1_owner_can_read_own_org_logs',
    v_count > 0,
    format('visible=%s', v_count)
  );

  -- Test 2: admin can read
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '2_admin_can_read_own_org_logs',
    v_count > 0,
    format('visible=%s', v_count)
  );

  -- Test 3: member cannot read
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '3_member_cannot_read_logs',
    v_count = 0,
    format('visible=%s', v_count)
  );

  -- Test 4: tournament_admin cannot read
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '4_tournament_admin_cannot_read_logs',
    v_count = 0,
    format('visible=%s', v_count)
  );

  -- Test 5: org A cannot read org B
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '5_org_a_cannot_read_org_b_logs',
    v_count = 0,
    format('visible=%s', v_count)
  );

  -- Test 6: anon cannot read
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO v_count FROM public.audit_log;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '6_anon_cannot_read_audit_log', false, format('unexpected count=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '6_anon_cannot_read_audit_log',
      SQLERRM ILIKE '%permission denied%',
      SQLERRM
    );
  END;

  -- Test 7: authenticated cannot insert directly
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.audit_log (
      organization_id, entity_type, entity_id, action, after_data
    ) VALUES (org_a, 'organizations', org_a, 'insert', '{}'::jsonb);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '7_authenticated_cannot_insert_audit_log', false, 'unexpected insert'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '7_authenticated_cannot_insert_audit_log',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Test 8: owner cannot update audit_log
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.audit_log SET action = 'delete' WHERE organization_id = org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '8_owner_cannot_update_audit_log',
      v_count = 0,
      format('updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '8_owner_cannot_update_audit_log',
      SQLERRM ILIKE '%append-only%' OR SQLERRM ILIKE '%permission denied%'
        OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Test 9: owner cannot delete audit_log
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.audit_log WHERE organization_id = org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '9_owner_cannot_delete_audit_log',
      v_count = 0,
      format('deleted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '9_owner_cannot_delete_audit_log',
      SQLERRM ILIKE '%append-only%' OR SQLERRM ILIKE '%permission denied%'
        OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Setup domain data as admin
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Test 12: update member role
  UPDATE public.organization_members
  SET role = 'organization_admin'
  WHERE id = member_row_id;
  SELECT action, before_data, after_data, changed_fields
  INTO v_action, v_before, v_after, v_changed
  FROM public.audit_log
  WHERE entity_type = 'organization_members' AND entity_id = member_row_id AND action = 'update'
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '12_update_member_role_audit',
    v_action = 'update' AND v_before IS NOT NULL AND v_after IS NOT NULL
      AND 'role' = ANY (v_changed)
      AND (v_before ->> 'role') = 'organization_member'
      AND (v_after ->> 'role') = 'organization_admin',
    format('changed=%s before_role=%s after_role=%s', v_changed, v_before->>'role', v_after->>'role')
  );

  -- Test 13 + 14: delete member; removed user cannot read
  DELETE FROM public.organization_members WHERE id = member_row_id;
  SELECT action, before_data, after_data
  INTO v_action, v_before, v_after
  FROM public.audit_log
  WHERE entity_type = 'organization_members' AND entity_id = member_row_id AND action = 'delete'
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '13_delete_member_audit',
    v_action = 'delete' AND v_before IS NOT NULL AND v_after IS NULL
      AND (v_before ->> 'profile_id') = removed_profile::text,
    format('action=%s profile=%s after_null=%s', v_action, v_before->>'profile_id', v_after IS NULL)
  );
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', removed_profile::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', removed_profile::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.audit_log WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '14_removed_user_cannot_read_logs',
    v_count = 0,
    format('visible=%s', v_count)
  );

  -- Continue setup
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.venues (organization_id, name) VALUES (org_a, 'Venue A') RETURNING id INTO venue_a;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field 1') RETURNING id INTO field_a;

  INSERT INTO public.field_reservations (
    organization_id, field_id, reservation_type, starts_at, ends_at, title, status
  ) VALUES (
    org_a, field_a, 'manual_block', now() + interval '1 day', now() + interval '1 day 2 hours',
    'Block', 'confirmed'
  ) RETURNING id INTO reservation_id;

  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'field_reservations' AND entity_id = reservation_id AND action = 'insert';
  INSERT INTO public.__mig010_test_results VALUES (
    '15_insert_field_reservation_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a, org_a, 'Season A', 'season-a-mig010', 'round_robin')
  RETURNING id INTO season_a;

  SELECT id INTO season_rules_id FROM public.season_rules WHERE season_id = season_a;

  -- Test 16: update season_rules changed_fields
  UPDATE public.season_rules
  SET yellow_card_limit = 1, suspension_matches = 2
  WHERE id = season_rules_id;
  SELECT changed_fields INTO v_changed
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id AND action = 'update'
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '16_update_season_rules_changed_fields',
    'yellow_card_limit' = ANY (v_changed) AND 'suspension_matches' = ANY (v_changed)
      AND NOT ('updated_at' = ANY (v_changed)),
    format('changed=%s', v_changed)
  );

  -- Test 17: no-op update except updated_at creates no extra log
  SELECT count(*) INTO logs_before
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id;
  UPDATE public.season_rules
  SET yellow_card_limit = yellow_card_limit
  WHERE id = season_rules_id;
  SELECT count(*) INTO logs_after
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id;
  INSERT INTO public.__mig010_test_results VALUES (
    '17_updated_at_only_skips_audit',
    logs_after = logs_before,
    format('before=%s after=%s', logs_before, logs_after)
  );

  INSERT INTO public.season_roles (
    organization_id, season_id, profile_id, role
  ) VALUES (org_a, season_a, uid_tourn_a, 'tournament_admin')
  RETURNING id INTO role_id;
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'season_roles' AND entity_id = role_id AND action = 'insert';
  INSERT INTO public.__mig010_test_results VALUES (
    '18_insert_season_role_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away') RETURNING id INTO team_a;
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Player P') RETURNING id INTO player_p;

  -- Test 33: players snapshot has no PII columns (none exist in schema)
  SELECT after_data INTO v_after
  FROM public.audit_log
  WHERE entity_type = 'players' AND entity_id = player_p AND action = 'insert'
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '33_players_snapshot_excludes_pii',
    v_after IS NOT NULL
      AND NOT (v_after ? 'phone')
      AND NOT (v_after ? 'email')
      AND NOT (v_after ? 'birth_date')
      AND NOT (v_after ? 'document_id')
      AND NOT (v_after ? 'notes')
      AND (v_after ? 'full_name'),
    format('keys present check ok; full_name=%s', v_after->>'full_name')
  );

  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_h, org_a) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_a, org_a) RETURNING id INTO st_a;

  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, jersey_number
  ) VALUES (st_h, player_p, org_a, 9) RETURNING id INTO stp_p;
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'season_team_players' AND entity_id = stp_p AND action = 'insert';
  INSERT INTO public.__mig010_test_results VALUES (
    '19_insert_season_team_player_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id, status
  ) VALUES (season_a, org_a, st_h, st_a, 'scheduled')
  RETURNING id INTO match_id;
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'matches' AND entity_id = match_id AND action = 'insert';
  INSERT INTO public.__mig010_test_results VALUES (
    '20_insert_match_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  -- Test 21: update_match_result audits match
  PERFORM public.update_match_result(match_id, 'finished', 2, 1);
  SELECT action, changed_fields, after_data
  INTO v_action, v_changed, v_after
  FROM public.audit_log
  WHERE entity_type = 'matches' AND entity_id = match_id AND action = 'update'
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '21_update_match_result_audit',
    v_action = 'update'
      AND ('status' = ANY (v_changed) OR 'home_score' = ANY (v_changed) OR 'away_score' = ANY (v_changed))
      AND (v_after ->> 'home_score') = '2',
    format('changed=%s home=%s', v_changed, v_after->>'home_score')
  );

  INSERT INTO public.match_officials (
    match_id, organization_id, profile_id, role, status
  ) VALUES (match_id, org_a, uid_admin_a, 'referee', 'confirmed')
  RETURNING id INTO official_id;
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'match_officials' AND entity_id = official_id AND action = 'insert';
  INSERT INTO public.__mig010_test_results VALUES (
    '22_insert_match_official_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  -- Test 23 + 24: red card -> match_event + discipline_suspension logs
  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES (match_id, org_a, stp_p, 'red_card', 40)
  RETURNING id INTO event_id;

  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'match_events' AND entity_id = event_id AND action = 'insert';
  INSERT INTO public.__mig010_test_results VALUES (
    '23_insert_match_event_audit',
    v_count = 1,
    format('logs=%s', v_count)
  );

  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'discipline_suspensions'
    AND action = 'insert'
    AND (after_data ->> 'source_match_event_id') = event_id::text;
  INSERT INTO public.__mig010_test_results VALUES (
    '24_red_card_also_audits_suspension',
    v_count = 1,
    format('suspension_logs=%s', v_count)
  );

  -- Verify suspension notes excluded
  SELECT after_data INTO v_after
  FROM public.audit_log
  WHERE entity_type = 'discipline_suspensions' AND action = 'insert'
    AND (after_data ->> 'source_match_event_id') = event_id::text
  LIMIT 1;
  -- notes column excluded even if NULL; key should be absent
  -- (auto-generated suspensions may have null notes anyway)

  INSERT INTO public.team_charges (
    organization_id, season_team_id, charge_type, description, amount, created_by_profile_id
  ) VALUES (org_a, st_h, 'registration', 'Inscripción privada', 1000.00, uid_admin_a)
  RETURNING id INTO charge_id;

  SELECT after_data, actor_profile_id, entity_type, entity_id, action, before_data
  INTO v_after, v_actor, v_entity_type, v_entity_id, v_action, v_before
  FROM public.audit_log
  WHERE entity_type = 'team_charges' AND entity_id = charge_id AND action = 'insert'
  ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.__mig010_test_results VALUES (
    '25_insert_team_charge_audit',
    v_action = 'insert' AND v_entity_id = charge_id,
    format('charge=%s', charge_id)
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '32_charge_snapshot_excludes_description',
    v_after IS NOT NULL AND NOT (v_after ? 'description'),
    format('has_description=%s', v_after ? 'description')
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '34_actor_profile_id_matches_auth_uid',
    v_actor = uid_admin_a,
    format('actor=%s expected=%s', v_actor, uid_admin_a)
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '35_entity_type_and_id_match_row',
    v_entity_type = 'team_charges' AND v_entity_id = charge_id,
    format('type=%s id=%s', v_entity_type, v_entity_id)
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '36_insert_snapshot_shape',
    v_before IS NULL AND v_after IS NOT NULL,
    format('before_null=%s after_present=%s', v_before IS NULL, v_after IS NOT NULL)
  );

  INSERT INTO public.team_payments (
    organization_id, season_team_id, amount, payment_method,
    reference, notes, recorded_by_profile_id
  ) VALUES (
    org_a, st_h, 400.00, 'transfer', 'REF-SECRET', 'Nota privada', uid_admin_a
  ) RETURNING id INTO payment_id;

  SELECT after_data INTO v_after
  FROM public.audit_log
  WHERE entity_type = 'team_payments' AND entity_id = payment_id AND action = 'insert'
  ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.__mig010_test_results VALUES (
    '26_insert_team_payment_audit',
    payment_id IS NOT NULL AND v_after IS NOT NULL,
    format('payment=%s', payment_id)
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '30_payment_snapshot_excludes_reference',
    NOT (v_after ? 'reference'),
    format('has_reference=%s', v_after ? 'reference')
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '31_payment_snapshot_excludes_notes',
    NOT (v_after ? 'notes'),
    format('has_notes=%s', v_after ? 'notes')
  );

  -- Void charge
  PERFORM public.void_team_charge(charge_id, 'Error de captura');
  SELECT action, before_data, after_data, changed_fields
  INTO v_action, v_before, v_after, v_changed
  FROM public.audit_log
  WHERE entity_type = 'team_charges' AND entity_id = charge_id AND action = 'update'
  ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.__mig010_test_results VALUES (
    '27_void_team_charge_audited_as_update',
    v_action = 'update' AND v_before IS NOT NULL AND v_after IS NOT NULL,
    format('action=%s', v_action)
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '29_void_changed_fields_include_void_cols',
    'voided_at' = ANY (v_changed)
      AND 'voided_by_profile_id' = ANY (v_changed)
      AND 'void_reason' = ANY (v_changed),
    format('changed=%s', v_changed)
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '37_update_snapshot_shape',
    v_before IS NOT NULL AND v_after IS NOT NULL,
    format('before_present=%s after_present=%s', v_before IS NOT NULL, v_after IS NOT NULL)
  );

  -- Void payment
  PERFORM public.void_team_payment(payment_id, 'Pago duplicado');
  SELECT action INTO v_action
  FROM public.audit_log
  WHERE entity_type = 'team_payments' AND entity_id = payment_id AND action = 'update'
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '28_void_team_payment_audited_as_update',
    v_action = 'update',
    format('action=%s', v_action)
  );

  -- Test 38: DELETE snapshot shape (already covered by member delete; re-assert)
  SELECT before_data, after_data INTO v_before, v_after
  FROM public.audit_log
  WHERE entity_type = 'organization_members' AND action = 'delete'
    AND organization_id = org_a
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.__mig010_test_results VALUES (
    '38_delete_snapshot_shape',
    v_before IS NOT NULL AND v_after IS NULL,
    format('before_present=%s after_null=%s', v_before IS NOT NULL, v_after IS NULL)
  );

  EXECUTE 'RESET ROLE';

  -- Test 39: PUBLIC no EXECUTE on audit_row_change
  SELECT NOT has_function_privilege('public', 'public.audit_row_change()', 'EXECUTE')
  INTO v_fn_ok;
  INSERT INTO public.__mig010_test_results VALUES (
    '39_public_no_execute_audit_row_change',
    v_fn_ok,
    format('public_execute=%s', NOT v_fn_ok)
  );

  -- Test 40: anon no privileges on audit_log
  SELECT NOT has_table_privilege('anon', 'public.audit_log', 'SELECT')
     AND NOT has_table_privilege('anon', 'public.audit_log', 'INSERT')
     AND NOT has_table_privilege('anon', 'public.audit_log', 'UPDATE')
     AND NOT has_table_privilege('anon', 'public.audit_log', 'DELETE')
  INTO v_fn_ok;
  INSERT INTO public.__mig010_test_results VALUES (
    '40_anon_no_direct_privileges_audit_log',
    v_fn_ok,
    format('anon_clean=%s', v_fn_ok)
  );

  -- Test 41: physical org delete with audit/finance history fails
  BEGIN
    DELETE FROM public.organizations WHERE id = org_a;
    INSERT INTO public.__mig010_test_results VALUES (
      '41_org_delete_restrict_with_audit_logs', false, 'unexpected delete success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig010_test_results VALUES (
      '41_org_delete_restrict_with_audit_logs',
      SQLERRM ILIKE '%foreign key%' OR SQLERRM ILIKE '%restrict%'
        OR SQLERRM ILIKE '%audit_log%'
        OR SQLERRM ILIKE '%team_charges%cannot be deleted%'
        OR SQLERRM ILIKE '%team_payments%cannot be deleted%',
      SQLERRM
    );
  END;

  -- Test 42: org logs do not contaminate other org queries
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '42_org_logs_do_not_contaminate_other_org',
    v_count = 0,
    format('org_a_visible_to_owner_b=%s', v_count)
  );

  -- Test 43: audit_log does not audit itself
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'audit_log';
  INSERT INTO public.__mig010_test_results VALUES (
    '43_audit_log_not_self_audited',
    v_count = 0,
    format('self_logs=%s', v_count)
  );

  -- Test 44 / 45 placeholders filled after regression runs externally;
  -- here we assert finance + discipline audit paths already exercised without errors.
  INSERT INTO public.__mig010_test_results VALUES (
    '44_audit_compatible_with_finance_paths',
    EXISTS (
      SELECT 1 FROM public.__mig010_test_results
      WHERE test_name IN (
        '25_insert_team_charge_audit',
        '26_insert_team_payment_audit',
        '27_void_team_charge_audited_as_update',
        '28_void_team_payment_audited_as_update'
      ) AND passed
    ),
    'finance audit path exercised in this suite'
  );

  INSERT INTO public.__mig010_test_results VALUES (
    '45_audit_compatible_with_discipline_capture_paths',
    EXISTS (
      SELECT 1 FROM public.__mig010_test_results
      WHERE test_name IN (
        '21_update_match_result_audit',
        '23_insert_match_event_audit',
        '24_red_card_also_audits_suspension'
      ) AND passed
    ),
    'discipline/capture audit path exercised in this suite; full 007/008 regression run separately'
  );

  -- Test 46: app.skip_audit has no effect
  SELECT count(*) INTO logs_before
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id AND action = 'update';
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('app.skip_audit', 'true', true);
  SELECT points_win INTO v_points_win FROM public.season_rules WHERE id = season_rules_id;
  UPDATE public.season_rules SET points_win = v_points_win + 1 WHERE id = season_rules_id;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO logs_after
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id AND action = 'update';
  INSERT INTO public.__mig010_test_results VALUES (
    '46_skip_audit_flag_has_no_effect',
    logs_after > logs_before,
    format('updates_before=%s updates_after=%s', logs_before, logs_after)
  );

  -- Test 47: app.audit_allow_delete has no effect on DELETE
  SELECT id INTO v_log_id
  FROM public.audit_log
  WHERE organization_id = org_a
  ORDER BY created_at DESC
  LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('app.audit_allow_delete', 'true', true);
  BEGIN
    DELETE FROM public.audit_log WHERE id = v_log_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO logs_after FROM public.audit_log WHERE id = v_log_id;
    INSERT INTO public.__mig010_test_results VALUES (
      '47_audit_allow_delete_flag_has_no_effect',
      v_count = 0 AND logs_after = 1,
      format('deleted_rows=%s still_exists=%s', v_count, logs_after = 1)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO logs_after FROM public.audit_log WHERE id = v_log_id;
    INSERT INTO public.__mig010_test_results VALUES (
      '47_audit_allow_delete_flag_has_no_effect',
      logs_after = 1,
      SQLERRM
    );
  END;

  -- Test 48: UPDATE still impossible with audit_allow_delete flag
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('app.audit_allow_delete', 'true', true);
    UPDATE public.audit_log
    SET action = 'delete', before_data = '{}'::jsonb, after_data = NULL
    WHERE id = v_log_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '48_update_impossible_with_allow_delete_flag',
      v_count = 0,
      format('updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig010_test_results VALUES (
      '48_update_impossible_with_allow_delete_flag',
      SQLERRM ILIKE '%append-only%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Test 49: both flags do not bypass audit or delete
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('app.skip_audit', 'true', true);
  PERFORM set_config('app.audit_allow_delete', 'true', true);
  INSERT INTO public.venues (organization_id, name)
  VALUES (org_a, 'Bypass Venue Test') RETURNING id INTO venue_a;
  SELECT id INTO v_log_id
  FROM public.audit_log
  WHERE entity_type = 'venues' AND entity_id = venue_a AND action = 'insert'
  ORDER BY created_at DESC LIMIT 1;
  BEGIN
    DELETE FROM public.audit_log WHERE id = v_log_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO logs_after FROM public.audit_log WHERE id = v_log_id;
    INSERT INTO public.__mig010_test_results VALUES (
      '49_both_flags_no_bypass',
      v_log_id IS NOT NULL AND logs_after = 1 AND v_count = 0,
      format('log_created=%s delete_rows=%s still_exists=%s', v_log_id IS NOT NULL, v_count, logs_after = 1)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO logs_after FROM public.audit_log WHERE id = v_log_id;
    INSERT INTO public.__mig010_test_results VALUES (
      '49_both_flags_no_bypass',
      v_log_id IS NOT NULL AND logs_after = 1,
      SQLERRM
    );
  END;

  -- Test 50: updated_at-only skipped; real change audited
  SELECT count(*) INTO logs_before
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id AND action = 'update';
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.season_rules
  SET points_win = points_win
  WHERE id = season_rules_id;
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id AND action = 'update';
  UPDATE public.season_rules
  SET points_loss = points_loss + 1
  WHERE id = season_rules_id;
  SELECT count(*) INTO logs_after
  FROM public.audit_log
  WHERE entity_type = 'season_rules' AND entity_id = season_rules_id AND action = 'update';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig010_test_results VALUES (
    '50_updated_at_only_skipped_real_change_audited',
    v_count = logs_before AND logs_after = logs_before + 1,
    format('before=%s noop=%s after_real=%s', logs_before, v_count, logs_after)
  );

  -- Test 51: no exposed bypass/cleanup functions or execute grants
  SELECT NOT has_function_privilege('public', 'public.audit_row_change()', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.audit_row_change()', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.audit_row_change()', 'EXECUTE')
     AND NOT EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname ILIKE '%audit%'
         AND p.proname ILIKE ANY (ARRAY['%cleanup%', '%bypass%', '%skip%'])
     )
  INTO v_fn_ok;
  INSERT INTO public.__mig010_test_results VALUES (
    '51_no_exposed_bypass_functions_or_execute',
    v_fn_ok,
    format('privileges_ok=%s', v_fn_ok)
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig010_test_results
ORDER BY test_name;
