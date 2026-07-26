-- Migration 020: discipline RPCs, vice-captain, captain payment marks
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/020_discipline_vice_captain_payment_marks.sql

DROP TABLE IF EXISTS public.__mig020_test_results;
CREATE TABLE public.__mig020_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0200';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0201';
  uid_captain_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0201';
  uid_vice_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0202';
  uid_captain_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0203';
  uid_member_a uuid := 'dddddddd-dddd-dddd-dddd-dddddddd0201';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0200';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  team_a uuid;
  team_b uuid;
  team_b2 uuid;
  st_a uuid;
  st_b uuid;
  st_b2 uuid;
  stp_cap_a uuid;
  stp_vice_a uuid;
  stp_player_a uuid;
  stp_player_b uuid;
  stp_cap_b uuid;
  stp_b2 uuid;
  match_ab uuid;
  susp_id uuid;
  req_id uuid;
  v_count integer;
  v_status text;
  v_remaining integer;
  v_token uuid;
  v_mark_id uuid;
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
  ALTER TABLE public.captain_invitations DISABLE TRIGGER USER;
  ALTER TABLE public.match_reschedule_requests DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_player_payment_marks DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE slug IN ('org-a-mig020', 'org-b-mig020')
       OR created_by IN (uid_owner_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE slug IN ('org-a-mig020', 'org-b-mig020')
     OR created_by IN (uid_owner_a, uid_owner_b);
  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_admin_a, uid_captain_a, uid_vice_a,
    uid_captain_b, uid_member_a, uid_owner_b
  );

  ALTER TABLE public.season_team_player_payment_marks ENABLE TRIGGER USER;
  ALTER TABLE public.match_reschedule_requests ENABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations ENABLE TRIGGER USER;
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
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_a, 'authenticated', 'authenticated',
     'captain-a@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_vice_a, 'authenticated', 'authenticated',
     'vice-a@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_b, 'authenticated', 'authenticated',
     'captain-b@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig020.local', '$2a$06$testhashligapromigration020aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig020');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin_a, 'organization_admin');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga 020') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a, org_a, 'Temp 020', 'temp-020', 'round_robin')
  RETURNING id INTO season_a;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_a;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Alpha') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Beta') RETURNING id INTO team_b;

  st_a := public.enroll_team_in_season(season_a, team_a);
  st_b := public.enroll_team_in_season(season_a, team_b);

  stp_cap_a := public.create_captain_player_with_invitation(
    st_a, 'Captain Alpha', 'captain-a@ligapro-mig020.local', 10
  );
  stp_player_a := public.create_player_and_add_to_roster(st_a, 'Player A2', 11);
  stp_cap_b := public.create_captain_player_with_invitation(
    st_b, 'Captain Beta', 'captain-b@ligapro-mig020.local', 9
  );
  stp_player_b := public.create_player_and_add_to_roster(st_b, 'Player B2', 8);

  stp_vice_a := public.create_player_and_add_to_roster(st_a, 'Vice Alpha', 7);
  PERFORM public.set_season_team_vice_captain(
    st_a,
    (SELECT player_id FROM public.season_team_players WHERE id = stp_vice_a)
  );
  PERFORM public.invite_captain_to_roster(stp_vice_a, 'vice-a@ligapro-mig020.local');

  PERFORM public.create_season_round_robin_fixture(
    season_a,
    'single',
    jsonb_build_array(
      jsonb_build_object(
        'away_season_team_id', st_b,
        'home_season_team_id', st_a,
        'leg_number', 1,
        'round_number', 1,
        'sequence_in_round', 1
      )
    )
  );
  SELECT id INTO match_ab FROM public.matches WHERE season_id = season_a LIMIT 1;

  susp_id := public.create_administrative_suspension(
    stp_player_a,
    'administrative',
    2,
    'test admin suspension'
  );
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

  PERFORM set_config('request.jwt.claim.sub', uid_vice_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_vice_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT token INTO v_token FROM public.captain_invitations
  WHERE season_team_player_id = stp_vice_a AND status = 'pending' LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);

  -- Org B for cross-team payment mark test
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig020');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Temp B', 'temp-b-020', 'round_robin')
  RETURNING id INTO season_b;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_b;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Gamma') RETURNING id INTO team_b2;
  st_b2 := public.enroll_team_in_season(season_b, team_b2);
  stp_b2 := public.create_player_and_add_to_roster(st_b2, 'Player G', 1);
  EXECUTE 'RESET ROLE';

  -- 1 admin RPCs require reason
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.waive_discipline_suspension(susp_id, '   ');
    INSERT INTO public.__mig020_test_results VALUES (
      '1_waive_requires_reason', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig020_test_results VALUES (
      '1_waive_requires_reason', true, SQLERRM
    );
  END;

  PERFORM public.waive_discipline_suspension(susp_id, 'waived for test');
  SELECT status INTO v_status FROM public.discipline_suspensions WHERE id = susp_id;
  INSERT INTO public.__mig020_test_results VALUES (
    '1b_admin_can_waive_with_reason', v_status = 'waived', format('status=%s', v_status)
  );

  susp_id := public.create_administrative_suspension(
    stp_player_b, 'expulsion', 3, 'expelled'
  );
  PERFORM public.adjust_discipline_suspension_length(susp_id, 5, 'extended');
  SELECT matches_remaining INTO v_remaining FROM public.discipline_suspensions WHERE id = susp_id;
  INSERT INTO public.__mig020_test_results VALUES (
    '1c_admin_can_adjust_with_reason', v_remaining = 5, format('remaining=%s', v_remaining)
  );

  -- 2 no direct UPDATE/DELETE on discipline_suspensions
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.discipline_suspensions SET matches_remaining = 99 WHERE id = susp_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '2_no_direct_update_discipline', false, 'unexpected update success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '2_no_direct_update_discipline', true, SQLERRM
    );
  END;

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.discipline_suspensions WHERE id = susp_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '2b_no_direct_delete_discipline', false, 'unexpected delete success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '2b_no_direct_delete_discipline', true, SQLERRM
    );
  END;

  -- 3 administrative/expulsion cannot have source event
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.discipline_suspensions (
      organization_id, season_team_player_id, source_match_event_id,
      suspension_type, matches_remaining, status
    ) VALUES (
      org_a, stp_player_b, gen_random_uuid(), 'expulsion', 1, 'active'
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '3_expulsion_requires_null_source', false, 'unexpected insert'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '3_expulsion_requires_null_source', true, SQLERRM
    );
  END;

  -- 4 captain and vice exclusive
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.season_team_players
    SET is_captain = true, is_vice_captain = true
    WHERE id = stp_vice_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '4_captain_vice_mutually_exclusive', false, 'unexpected update'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '4_captain_vice_mutually_exclusive', true, SQLERRM
    );
  END;

  -- 5 one vice-captain per team
  BEGIN
    PERFORM public.set_season_team_vice_captain(
      st_a,
      (SELECT player_id FROM public.season_team_players WHERE id = stp_player_a)
    );
    PERFORM public.set_season_team_vice_captain(
      st_a,
      (SELECT player_id FROM public.season_team_players WHERE id = stp_vice_a)
    );
    SELECT count(*) INTO v_count FROM public.season_team_players
    WHERE season_team_id = st_a AND is_vice_captain = true;
    INSERT INTO public.__mig020_test_results VALUES (
      '5_one_vice_captain_per_team', v_count = 1, format('count=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig020_test_results VALUES (
      '5_one_vice_captain_per_team', false, SQLERRM
    );
  END;

  -- 6 vice-captain can propose reschedule
  PERFORM set_config('request.jwt.claim.sub', uid_vice_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_vice_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    req_id := public.propose_match_reschedule(
      match_ab,
      timestamptz '2026-09-10 18:00:00+00',
      NULL
    );
    INSERT INTO public.__mig020_test_results VALUES (
      '6_vice_can_propose_reschedule', req_id IS NOT NULL, format('req=%s', req_id)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig020_test_results VALUES (
      '6_vice_can_propose_reschedule', false, SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  IF req_id IS NOT NULL THEN
    PERFORM public.respond_match_reschedule(req_id, true);
  END IF;

  -- 7 payment marks cross-team isolation
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.set_player_payment_mark(stp_b2, true, 'nope');
    INSERT INTO public.__mig020_test_results VALUES (
      '7_captain_cannot_mark_other_team', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig020_test_results VALUES (
      '7_captain_cannot_mark_other_team', true, SQLERRM
    );
  END;

  v_mark_id := public.set_player_payment_mark(stp_player_a, true, 'paid informal');
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_team_player_payment_marks
  WHERE season_team_player_id = stp_player_a AND marked_paid = true;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig020_test_results VALUES (
    '7b_captain_can_mark_own_team', v_count = 1, format('count=%s mark=%s', v_count, v_mark_id)
  );

  -- 8 admin read-only on payment marks
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_team_player_payment_marks
  WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig020_test_results VALUES (
    '8_admin_can_read_payment_marks', v_count >= 1, format('count=%s', v_count)
  );

  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_team_player_payment_marks (
      organization_id, season_team_player_id, marked_paid, marked_by_profile_id
    ) VALUES (org_a, stp_player_a, false, uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '8b_admin_cannot_write_payment_marks', false, 'unexpected insert'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig020_test_results VALUES (
      '8b_admin_cannot_write_payment_marks', true, SQLERRM
    );
  END;

  -- 9 member without linked profile has no new privileges
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.set_player_payment_mark(stp_player_a, true, 'hack');
    INSERT INTO public.__mig020_test_results VALUES (
      '9_unlinked_profile_no_payment_mark', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig020_test_results VALUES (
      '9_unlinked_profile_no_payment_mark', true, SQLERRM
    );
  END;

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_team_player_payment_marks
  WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig020_test_results VALUES (
    '9b_unlinked_profile_cannot_read_payment_marks', v_count = 0, format('count=%s', v_count)
  );

  -- cleanup
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
  ALTER TABLE public.captain_invitations DISABLE TRIGGER USER;
  ALTER TABLE public.match_reschedule_requests DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_player_payment_marks DISABLE TRIGGER USER;

  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_admin_a, uid_captain_a, uid_vice_a,
    uid_captain_b, uid_member_a, uid_owner_b
  );

  ALTER TABLE public.season_team_player_payment_marks ENABLE TRIGGER USER;
  ALTER TABLE public.match_reschedule_requests ENABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations ENABLE TRIGGER USER;
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
END $$;

SELECT test_name, passed, details
FROM public.__mig020_test_results
ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  count(*) AS total
FROM public.__mig020_test_results;

DROP TABLE IF EXISTS public.__mig020_test_results;
