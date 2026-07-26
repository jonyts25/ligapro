-- Migration 021: field blocks, registration fee, captain roster, billing lock, captain read RLS
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/021_field_blocks_roster_billing.sql

DROP TABLE IF EXISTS public.__mig021_test_results;
CREATE TEMP TABLE __mig021_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0210';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0211';
  uid_captain_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0211';
  uid_captain_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0212';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0210';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  season_c uuid;
  venue_a uuid;
  field_a uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
  team_d uuid;
  st_a uuid;
  st_b uuid;
  st_c uuid;
  stp_cap_a uuid;
  stp_cap_b uuid;
  stp_vice_a uuid;
  stp_player_a uuid;
  match_ab uuid;
  v_token uuid;
  v_count integer;
  v_phone text;
  v_charge_count integer;
  v_stp_new uuid;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig021.local', '$2a$06$testhashligapromigration021aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig021.local', '$2a$06$testhashligapromigration021aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_a, 'authenticated', 'authenticated',
     'captain-a@ligapro-mig021.local', '$2a$06$testhashligapromigration021aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_b, 'authenticated', 'authenticated',
     'captain-b@ligapro-mig021.local', '$2a$06$testhashligapromigration021aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig021.local', '$2a$06$testhashligapromigration021aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig021');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin_a, 'organization_admin');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga 021') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_a, org_a, 'Temp 021', 'temp-021', 'round_robin', '2026-08-01')
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

  UPDATE public.season_rules
  SET registration_fee = 500.00, max_roster_size = 3
  WHERE season_id = season_a;

  INSERT INTO public.venues (organization_id, name) VALUES (org_a, 'Venue 021')
  RETURNING id INTO venue_a;
  INSERT INTO public.fields (organization_id, venue_id, name) VALUES (org_a, venue_a, 'Field 021')
  RETURNING id INTO field_a;
  PERFORM public.replace_field_availability(
    field_a,
    jsonb_build_array(
      jsonb_build_object('day_of_week', 4, 'starts_at', '18:00', 'ends_at', '22:00')
    )
  );

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Alpha') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Beta') RETURNING id INTO team_b;

  st_a := public.enroll_team_in_season(season_a, team_a);
  st_b := public.enroll_team_in_season(season_a, team_b);

  stp_cap_a := public.create_captain_player_with_invitation(
    st_a, 'Captain Alpha', 'captain-a@ligapro-mig021.local', 10
  );
  stp_cap_b := public.create_captain_player_with_invitation(
    st_b, 'Captain Beta', 'captain-b@ligapro-mig021.local', 9
  );
  stp_vice_a := public.create_player_and_add_to_roster(st_a, 'Bench Vice', 8);

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
  EXECUTE 'RESET ROLE';

  -- Accept captain invitations
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

  -- Org B for cross-org isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig021');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_b, org_b, 'Temp B', 'temp-b-021', 'round_robin', '2026-08-01')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Gamma') RETURNING id INTO team_c;
  st_c := public.enroll_team_in_season(season_b, team_c);
  EXECUTE 'RESET ROLE';

  -- Second season in org A for cross-season field blocks
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga C') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_b, org_a, 'Temp C', 'temp-c-021', 'round_robin', '2026-08-01')
  RETURNING id INTO season_c;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_c;
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );

  -- 1 registration fee on enroll
  SELECT COUNT(*) INTO v_charge_count
  FROM public.team_charges tc
  WHERE tc.season_team_id IN (st_a, st_b)
    AND tc.charge_type = 'registration'
    AND tc.voided_at IS NULL;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '1_enroll_creates_registration_charge',
    v_charge_count = 2,
    format('charges=%s', v_charge_count)
  );

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  UPDATE public.season_rules SET registration_fee = NULL WHERE season_id = season_c;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Delta') RETURNING id INTO team_d;
  PERFORM public.enroll_team_in_season(season_c, team_d);
  SELECT COUNT(*) INTO v_charge_count
  FROM public.team_charges tc
  JOIN public.season_teams st ON st.id = tc.season_team_id
  WHERE st.season_id = season_c;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '1b_null_fee_no_charge',
    v_charge_count = 0,
    format('charges=%s', v_charge_count)
  );

  -- 2 captain read RLS
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT COUNT(*) INTO v_count FROM public.season_teams WHERE id = st_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '2_captain_reads_own_season_team',
    v_count = 1,
    format('count=%s', v_count)
  );
  SELECT COUNT(*) INTO v_count FROM public.season_team_players WHERE season_team_id = st_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '2b_captain_reads_own_roster',
    v_count >= 2,
    format('count=%s', v_count)
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT COUNT(*) INTO v_count FROM public.season_teams WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '2c_captain_cannot_read_other_org_teams',
    v_count = 0,
    format('count=%s', v_count)
  );

  -- 3 profiles.phone self edit
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.profiles SET phone = '+525512345678' WHERE id = uid_captain_a;
  SELECT phone INTO v_phone FROM public.profiles WHERE id = uid_captain_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '3_profile_phone_self_update',
    v_phone = '+525512345678',
    format('phone=%s', v_phone)
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id = uid_captain_b AND phone IS NOT NULL;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '3b_cannot_see_other_profile_phone',
    v_count = 0,
    format('count=%s', v_count)
  );

  -- 4 season field blocks cross-season
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.set_season_field_blocks(
    season_a,
    jsonb_build_array(
      jsonb_build_object(
        'field_id', field_a,
        'day_of_week', 4,
        'starts_at', '18:00',
        'ends_at', '20:00'
      ),
      jsonb_build_object(
        'field_id', field_a,
        'day_of_week', 0,
        'starts_at', '10:00',
        'ends_at', '12:00'
      )
    )
  );
  SELECT COUNT(*) INTO v_count FROM public.season_field_blocks WHERE season_id = season_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '4_same_season_multiple_blocks',
    v_count = 2,
    format('count=%s', v_count)
  );

  BEGIN
    PERFORM public.set_season_field_blocks(
      season_c,
      jsonb_build_array(
        jsonb_build_object(
          'field_id', field_a,
          'day_of_week', 4,
          'starts_at', '18:30',
          'ends_at', '19:30'
        )
      )
    );
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '4b_cross_season_overlap_rejected', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '4b_cross_season_overlap_rejected',
      SQLERRM ILIKE '%another season%',
      SQLERRM
    );
  END;

  PERFORM public.set_season_field_blocks(
    season_c,
    jsonb_build_array(
      jsonb_build_object(
        'field_id', field_a,
        'day_of_week', 4,
        'starts_at', '20:00',
        'ends_at', '22:00'
      )
    )
  );

  -- 5 schedule_match foreign block vs same season
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.schedule_match(
      match_ab,
      field_a,
      timestamptz '2026-08-06 20:30:00-06'
    );
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '5_schedule_rejects_foreign_block', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '5_schedule_rejects_foreign_block',
      SQLERRM ILIKE '%another tournament season%',
      SQLERRM
    );
  END;

  PERFORM public.unschedule_match(match_ab);
  PERFORM public.schedule_match(
    match_ab,
    field_a,
    timestamptz '2026-08-06 18:00:00-06'
  );
  SELECT COUNT(*) INTO v_count FROM public.field_reservations fr
  JOIN public.matches m ON m.field_reservation_id = fr.id
  WHERE m.id = match_ab;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '5b_schedule_allows_same_season_block',
    v_count = 1,
    format('count=%s', v_count)
  );

  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT COUNT(*) INTO v_count FROM public.field_reservations fr
  JOIN public.matches m ON m.field_reservation_id = fr.id
  WHERE m.id = match_ab;
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '5c_captain_reads_match_reservation',
    v_count = 1,
    format('count=%s', v_count)
  );

  -- 6 captain roster add
  v_stp_new := public.create_player_and_add_to_roster(st_a, 'Captain Add', 12);
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '6_captain_adds_to_own_team',
    v_stp_new IS NOT NULL,
    format('stp=%s', v_stp_new)
  );

  BEGIN
    PERFORM public.create_player_and_add_to_roster(st_b, 'Sneak Player', 1);
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '6b_captain_cannot_add_other_team', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '6b_captain_cannot_add_other_team', true, SQLERRM
    );
  END;

  -- 7 captain cannot deactivate
  BEGIN
    PERFORM public.deactivate_season_team_player(stp_vice_a);
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '7_captain_cannot_deactivate', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '7_captain_cannot_deactivate', true, SQLERRM
    );
  END;

  -- 8 max roster size (max=3, already 3 active on st_a after add)
  BEGIN
    PERFORM public.create_player_and_add_to_roster(st_a, 'Over Cap', 13);
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '8_captain_hits_max_roster', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '8_captain_hits_max_roster',
      SQLERRM ILIKE '%maximum size%',
      SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  v_stp_new := public.create_player_and_add_to_roster(st_a, 'Admin Over Cap', 14);
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '8b_admin_bypasses_max_roster',
    v_stp_new IS NOT NULL,
    format('stp=%s', v_stp_new)
  );

  -- 9 roster lock
  PERFORM public.set_roster_lock(st_a, true);
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.create_player_and_add_to_roster(st_a, 'Locked Out', 15);
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '9_captain_blocked_when_roster_locked', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '9_captain_blocked_when_roster_locked',
      SQLERRM ILIKE '%locked%',
      SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  v_stp_new := public.create_player_and_add_to_roster(st_a, 'Admin While Locked', 16);
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '9b_admin_bypasses_roster_lock',
    v_stp_new IS NOT NULL,
    format('stp=%s', v_stp_new)
  );

  -- 10 vice-captain single designation
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.set_season_team_vice_captain(
    st_a,
    (SELECT player_id FROM public.season_team_players WHERE id = stp_vice_a)
  );
  BEGIN
    PERFORM public.set_season_team_vice_captain(
      st_a,
      (SELECT player_id FROM public.season_team_players WHERE id = v_stp_new LIMIT 1)
    );
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '10_captain_cannot_replace_vice', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '10_captain_cannot_replace_vice',
      SQLERRM ILIKE '%already filled%',
      SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.set_season_team_vice_captain(
    st_a,
    (SELECT player_id FROM public.season_team_players WHERE id = v_stp_new LIMIT 1)
  );
  SELECT COUNT(*) INTO v_count FROM public.season_team_players
  WHERE season_team_id = st_a AND is_vice_captain = true AND registration_status = 'active';
  EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
    '10b_admin_can_replace_vice',
    v_count = 1,
    format('vice_count=%s', v_count)
  );

  -- 11 platform billing gate
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga billing') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a, org_a, 'Unpaid', 'unpaid-021', 'round_robin')
  RETURNING id INTO season_b;

  BEGIN
    PERFORM public.create_season_round_robin_fixture(
      season_b,
      'single',
      '[]'::jsonb
    );
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '11_fixture_rejects_unpaid_billing', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
  INSERT INTO __mig021_test_results VALUES (
      '11_fixture_rejects_unpaid_billing',
      SQLERRM ILIKE '%facturación activa%',
      SQLERRM
    );
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_b;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    UPDATE public.seasons SET platform_billing_status = 'vencido' WHERE id = season_b;
    EXECUTE 'RESET ROLE';
    INSERT INTO __mig021_test_results VALUES (
      '12_auth_cannot_update_billing_status', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO __mig021_test_results VALUES (
      '12_auth_cannot_update_billing_status',
      SQLERRM ILIKE '%cannot be changed%' OR SQLERRM ILIKE '%permission denied%',
      SQLERRM
    );
  END;

  -- cleanup (replica role bypasses audit triggers on linked DB runner)
  SET LOCAL session_replication_role = replica;
  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organization_members
  WHERE profile_id IN (uid_owner_a, uid_admin_a, uid_captain_a, uid_captain_b, uid_owner_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM public.profiles
  WHERE id IN (uid_owner_a, uid_admin_a, uid_captain_a, uid_captain_b, uid_owner_b);
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_captain_a, uid_captain_b, uid_owner_b);
  SET LOCAL session_replication_role = DEFAULT;
END $$;

SELECT
  test_name,
  passed,
  details,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM __mig021_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE NOT passed) AS failures,
  COUNT(*) AS total
FROM __mig021_test_results;

DROP TABLE IF EXISTS __mig021_test_results;
