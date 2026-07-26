-- Migration 019: captain invitations, reschedule consensus, calendar dual-state
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/019_reschedule_consensus_captain.sql

CREATE OR REPLACE FUNCTION public.__mig019_fixture_4(
  p_st1 uuid, p_st2 uuid, p_st3 uuid, p_st4 uuid
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('away_season_team_id', p_st4, 'home_season_team_id', p_st1, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st3, 'home_season_team_id', p_st2, 'leg_number', 1, 'round_number', 1, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', p_st3, 'home_season_team_id', p_st4, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st2, 'home_season_team_id', p_st1, 'leg_number', 1, 'round_number', 2, 'sequence_in_round', 2),
    jsonb_build_object('away_season_team_id', p_st1, 'home_season_team_id', p_st3, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 1),
    jsonb_build_object('away_season_team_id', p_st2, 'home_season_team_id', p_st4, 'leg_number', 1, 'round_number', 3, 'sequence_in_round', 2)
  );
$$;

DROP TABLE IF EXISTS public.__mig019_test_results;
CREATE TABLE public.__mig019_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0190';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0191';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0190';
  uid_captain_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0191';
  uid_captain_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0192';
  uid_non_captain uuid := 'dddddddd-dddd-dddd-dddd-dddddddd0191';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
  team_d uuid;
  stp_cap_a uuid;
  stp_cap_b uuid;
  stp_nc uuid;
  st_a uuid;
  st_b uuid;
  st_c uuid;
  st_d uuid;
  st_b1 uuid;
  st_b2 uuid;
  venue_a uuid;
  field_a uuid;
  match_ab uuid;
  match_cd uuid;
  req1 uuid;
  v_count integer;
  v_cal text;
  v_json jsonb;
  v_starts timestamptz;
  v_manual timestamptz;
  v_token uuid;
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
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER USER;
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations DISABLE TRIGGER USER;
  ALTER TABLE public.match_reschedule_requests DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE slug IN ('org-a-mig019', 'org-b-mig019')
       OR created_by IN (uid_owner_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE slug IN ('org-a-mig019', 'org-b-mig019')
     OR created_by IN (uid_owner_a, uid_owner_b);
  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_admin_a, uid_owner_b,
    uid_captain_a, uid_captain_b, uid_non_captain
  );

  ALTER TABLE public.match_reschedule_requests ENABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations ENABLE TRIGGER USER;
  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
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
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig019.local', '$2a$06$testhashligapromigration019aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig019.local', '$2a$06$testhashligapromigration019aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig019.local', '$2a$06$testhashligapromigration019aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_a, 'authenticated', 'authenticated',
     'captain-a@ligapro-mig019.local', '$2a$06$testhashligapromigration019aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_b, 'authenticated', 'authenticated',
     'captain-b@ligapro-mig019.local', '$2a$06$testhashligapromigration019aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_non_captain, 'authenticated', 'authenticated',
     'noncap@ligapro-mig019.local', '$2a$06$testhashligapromigration019aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig019');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin_a, 'organization_admin');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga 019') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (
    competition_a, org_a, 'Temp 019', 'temp-019', 'round_robin', '2026-08-04'::date
  ) RETURNING id INTO season_a;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Alpha') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Beta') RETURNING id INTO team_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Gamma') RETURNING id INTO team_c;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Delta') RETURNING id INTO team_d;

  INSERT INTO public.venues (organization_id, name) VALUES (org_a, 'Venue 019') RETURNING id INTO venue_a;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field 019') RETURNING id INTO field_a;

  st_a := public.enroll_team_in_season(season_a, team_a);
  st_b := public.enroll_team_in_season(season_a, team_b);
  st_c := public.enroll_team_in_season(season_a, team_c);
  st_d := public.enroll_team_in_season(season_a, team_d);

  PERFORM public.replace_field_availability(
    field_a,
    '[{"day_of_week":1,"starts_at":"08:00","ends_at":"22:00"}]'::jsonb
  );

  UPDATE public.season_rules
  SET recurring_slot_field_id = field_a, match_duration_minutes = 90, minimum_rest_minutes = 0
  WHERE season_id = season_a;

  stp_cap_a := public.create_captain_player_with_invitation(
    st_a, 'Captain Alpha', 'captain-a@ligapro-mig019.local', 10
  );
  stp_cap_b := public.create_captain_player_with_invitation(
    st_b, 'Captain Beta', 'captain-b@ligapro-mig019.local', 9
  );
  stp_nc := public.create_player_and_add_to_roster(st_c, 'Non Captain', 7);

  PERFORM public.create_season_round_robin_fixture(
    season_a,
    'single',
    public.__mig019_fixture_4(st_a, st_b, st_c, st_d)
  );

  SELECT id INTO match_ab FROM public.matches
  WHERE season_id = season_a
    AND home_season_team_id = st_a
    AND away_season_team_id = st_b
  LIMIT 1;
  SELECT id INTO match_cd FROM public.matches
  WHERE season_id = season_a
    AND home_season_team_id IN (st_c, st_d)
    AND away_season_team_id IN (st_c, st_d)
    AND home_season_team_id <> away_season_team_id
  LIMIT 1;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT token INTO v_token FROM public.captain_invitations
  WHERE season_team_player_id = stp_cap_a AND status = 'pending' LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  SELECT token INTO v_token FROM public.captain_invitations
  WHERE season_team_player_id = stp_cap_b AND status = 'pending' LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);

  UPDATE public.players
  SET profile_id = uid_non_captain
  WHERE id = (SELECT player_id FROM public.season_team_players WHERE id = stp_nc);

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig019');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Temp B', 'temp-b-019', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B1') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B2') RETURNING id INTO team_b;
  st_b1 := public.enroll_team_in_season(season_b, team_a);
  st_b2 := public.enroll_team_in_season(season_b, team_b);
  PERFORM public.create_season_round_robin_fixture(
    season_b,
    'single',
    jsonb_build_array(
      jsonb_build_object(
        'away_season_team_id', st_b2,
        'home_season_team_id', st_b1,
        'leg_number', 1,
        'round_number', 1,
        'sequence_in_round', 1
      )
    )
  );
  EXECUTE 'RESET ROLE';

  -- 1 captain A cannot propose on match without team A (match_cd)
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.propose_match_reschedule(
      match_cd,
      timestamptz '2026-08-10 18:00:00+00',
      field_a
    );
    INSERT INTO public.__mig019_test_results VALUES (
      '1_captain_cannot_propose_unrelated_match', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig019_test_results VALUES (
      '1_captain_cannot_propose_unrelated_match', true, SQLERRM
    );
  END;

  req1 := public.propose_match_reschedule(
    match_ab,
    timestamptz '2026-08-10 18:00:00+00',
    field_a
  );

  BEGIN
    PERFORM public.respond_match_reschedule(req1, true);
    INSERT INTO public.__mig019_test_results VALUES (
      '2_captain_cannot_approve_own_proposal', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig019_test_results VALUES (
      '2_captain_cannot_approve_own_proposal', true, SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_non_captain::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_non_captain::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.propose_match_reschedule(
      match_cd,
      timestamptz '2026-08-11 18:00:00+00',
      field_a
    );
    INSERT INTO public.__mig019_test_results VALUES (
      '3_non_captain_cannot_propose', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig019_test_results VALUES (
      '3_non_captain_cannot_propose', true, SQLERRM
    );
  END;

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.match_reschedule_requests
  WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig019_test_results VALUES (
    '3b_non_captain_cannot_read_requests',
    v_count = 0,
    format('visible=%s', v_count)
  );

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.respond_match_reschedule(req1, true);

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.resolve_match_reschedule(req1, 'confirm', 'nope');
    INSERT INTO public.__mig019_test_results VALUES (
      '4_foreign_owner_cannot_resolve', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig019_test_results VALUES (
      '4_foreign_owner_cannot_resolve', true, SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.propose_match_reschedule(
      match_ab,
      timestamptz '2026-08-12 18:00:00+00',
      field_a
    );
    INSERT INTO public.__mig019_test_results VALUES (
      '5_no_duplicate_open_requests', false, 'unexpected second open request'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig019_test_results VALUES (
      '5_no_duplicate_open_requests', true, SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.resolve_match_reschedule(req1, 'confirm', 'ok');
  SELECT calendar_status INTO v_cal FROM public.matches WHERE id = match_ab;
  INSERT INTO public.__mig019_test_results VALUES (
    '5b_resolve_confirm_sets_calendar_status',
    v_cal = 'confirmado',
    format('calendar_status=%s', v_cal)
  );

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  v_starts := timestamptz '2026-08-17 18:00:00+00';
  PERFORM public.schedule_match(match_cd, field_a, v_starts);
  v_manual := v_starts;
  BEGIN
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a, 'manual_block',
      v_manual, v_manual + interval '90 minutes', 'Block', 'confirmed'
    );
    PERFORM public.confirm_match_calendar(match_cd);
    INSERT INTO public.__mig019_test_results VALUES (
      '6_confirm_calendar_rejects_conflict', false, 'unexpected confirm on conflict'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig019_test_results VALUES (
      '6_confirm_calendar_rejects_conflict', true, SQLERRM
    );
  END;
  DELETE FROM public.field_reservations
  WHERE organization_id = org_a AND reservation_type = 'manual_block';

  v_starts := timestamptz '2026-08-24 18:00:00+00';
  PERFORM public.schedule_match(match_ab, field_a, v_starts);
  v_json := public.apply_recurring_slot_to_season(season_a, 1, '10:00:00'::time);
  SELECT fr.starts_at INTO v_manual
  FROM public.matches m
  JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  WHERE m.id = match_ab;
  INSERT INTO public.__mig019_test_results VALUES (
    '7_recurring_skips_manual_schedule',
    v_manual = v_starts AND (v_json->>'skipped_already_scheduled')::integer >= 1,
    format('starts=%s result=%s', v_manual, v_json)
  );

  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.matches WHERE id = match_ab;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig019_test_results VALUES (
    '8_captain_can_read_own_match', v_count = 1, format('count=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.matches WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig019_test_results VALUES (
    '8b_captain_cannot_read_foreign_org_match', v_count = 0, format('count=%s', v_count)
  );

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
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER USER;
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations DISABLE TRIGGER USER;
  ALTER TABLE public.match_reschedule_requests DISABLE TRIGGER USER;

  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_admin_a, uid_owner_b,
    uid_captain_a, uid_captain_b, uid_non_captain
  );

  ALTER TABLE public.match_reschedule_requests ENABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations ENABLE TRIGGER USER;
  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
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
END $$;

SELECT test_name, passed, details
FROM public.__mig019_test_results
ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  count(*) AS total
FROM public.__mig019_test_results;

DROP TABLE IF EXISTS public.__mig019_test_results;
DROP FUNCTION IF EXISTS public.__mig019_fixture_4(uuid, uuid, uuid, uuid);
