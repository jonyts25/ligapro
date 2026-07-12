-- Isolation tests for Migration 006a (matches, officials, field_reservations.match_id)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/006a_matches_officials_isolation.sql

DROP TABLE IF EXISTS public.__mig006a_test_results;
CREATE TABLE public.__mig006a_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa41';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa42';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa43';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb41';
  uid_ref uuid := 'cccccccc-cccc-cccc-cccc-cccccccccc41';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_a2 uuid;
  competition_b uuid;
  season_a uuid;
  season_a2 uuid;
  season_b uuid;
  team_home uuid;
  team_away uuid;
  team_other uuid;
  team_b uuid;
  st_home uuid;
  st_away uuid;
  st_other uuid;
  st_b uuid;
  match_a uuid;
  match_b uuid;
  venue_a uuid;
  field_a uuid;
  res_id uuid;
  v_count int;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_ref)
     OR slug IN ('org-a-mig006a', 'org-b-mig006a');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_ref);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig006a.local', '$2a$06$testhashligapromigration006aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig006a.local', '$2a$06$testhashligapromigration006aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig006a.local', '$2a$06$testhashligapromigration006aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig006a.local', '$2a$06$testhashligapromigration006aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
     'ref@ligapro-mig006a.local', '$2a$06$testhashligapromigration006aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig006a', 'org-a-mig006a')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B + seed match
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig006a', 'org-b-mig006a')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Season B', 'season-b', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Team B1') RETURNING id INTO team_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Team B2') RETURNING id INTO team_other;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b, org_b) RETURNING id INTO st_b;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_other, org_b) RETURNING id INTO st_other;
  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id, status
  ) VALUES (season_b, org_b, st_b, st_other, 'scheduled')
  RETURNING id INTO match_b;
  INSERT INTO public.match_officials (
    match_id, organization_id, profile_id, role
  ) VALUES (match_b, org_b, uid_owner_b, 'referee');
  EXECUTE 'RESET ROLE';

  -- Reset reused vars for org A setup
  team_other := NULL;
  st_other := NULL;

  -- Test 1 isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.matches WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig006a_test_results VALUES (
    '1a_user_a_cannot_read_org_b_matches', v_count = 0, format('matches_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.match_officials WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig006a_test_results VALUES (
    '1b_user_a_cannot_read_org_b_match_officials',
    v_count = 0,
    format('officials_visible=%s', v_count)
  );

  -- Test 2 member cannot create match
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id
    ) VALUES (season_b, org_a, st_b, st_other);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '2_member_cannot_create_match', false, format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '2_member_cannot_create_match',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%'
        OR SQLERRM ILIKE '%must match%' OR SQLERRM ILIKE '%belongs to season%',
      SQLERRM
    );
  END;

  -- Admin setup for org A
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a, org_a, 'Season A', 'season-a', 'round_robin')
  RETURNING id INTO season_a;
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A2') RETURNING id INTO competition_a2;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a2, org_a, 'Season A2', 'season-a2', 'round_robin')
  RETURNING id INTO season_a2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Home') RETURNING id INTO team_home;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Away') RETURNING id INTO team_away;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'OtherSeason') RETURNING id INTO team_other;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_home, org_a) RETURNING id INTO st_home;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_away, org_a) RETURNING id INTO st_away;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a2, team_other, org_a) RETURNING id INTO st_other;
  INSERT INTO public.venues (organization_id, name) VALUES (org_a, 'Venue A') RETURNING id INTO venue_a;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field A1') RETURNING id INTO field_a;
  EXECUTE 'RESET ROLE';

  -- Test 3 admin creates match
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id,
      status, round_label
    ) VALUES (
      season_a, org_a, st_home, st_away, 'scheduled', 'Jornada 1'
    ) RETURNING id INTO match_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '3_admin_creates_match',
      match_a IS NOT NULL,
      format('match_id=%s', match_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '3_admin_creates_match', false, SQLERRM
    );
  END;

  -- Test 4 org mismatch vs season
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id
    ) VALUES (season_a, org_b, st_home, st_away);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '4_match_org_must_match_season',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '4_match_org_must_match_season',
      SQLERRM ILIKE '%must match seasons.organization_id%',
      SQLERRM
    );
  END;

  -- Test 5 home = away
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id
    ) VALUES (season_a, org_a, st_home, st_home);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '5_home_away_must_be_distinct',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '5_home_away_must_be_distinct',
      SQLERRM ILIKE '%matches_home_away_distinct_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 6a home from other season
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id
    ) VALUES (season_a, org_a, st_other, st_away);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '6a_home_team_must_belong_to_match_season',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '6a_home_team_must_belong_to_match_season',
      SQLERRM ILIKE '%home_season_team_id%belongs to season%',
      SQLERRM
    );
  END;

  -- Test 6b away from other season
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id
    ) VALUES (season_a, org_a, st_home, st_other);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '6b_away_team_must_belong_to_match_season',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '6b_away_team_must_belong_to_match_season',
      SQLERRM ILIKE '%away_season_team_id%belongs to season%',
      SQLERRM
    );
  END;

  -- Test 7 partial score
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.matches SET home_score = 1, away_score = NULL WHERE id = match_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '7_partial_score_rejected',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '7_partial_score_rejected',
      SQLERRM ILIKE '%matches_scores_both_or_neither_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 8 invalid status
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.matches SET status = 'postponed' WHERE id = match_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '8_invalid_status_rejected',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '8_invalid_status_rejected',
      SQLERRM ILIKE '%matches_status_check%' OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 9 match without field_reservation_id
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.matches (
      season_id, organization_id, home_season_team_id, away_season_team_id,
      field_reservation_id, round_label
    ) VALUES (
      season_a, org_a, st_home, st_away, NULL, 'Jornada 2'
    ) RETURNING id INTO match_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '9_match_without_reservation_allowed',
      match_a IS NOT NULL,
      format('match_id=%s field_reservation_id=NULL', match_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '9_match_without_reservation_allowed', false, SQLERRM
    );
  END;

  -- Test 10a: match reservation without match_id fails (005 pending closed)
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, match_id, starts_at, ends_at, title
    ) VALUES (
      org_a, field_a, 'match', NULL,
      timestamptz '2026-09-01 18:00:00+00',
      timestamptz '2026-09-01 20:00:00+00',
      'Orphan match reservation'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '10a_match_reservation_requires_match_id',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '10a_match_reservation_requires_match_id',
      SQLERRM ILIKE '%field_reservations_match_type_requires_match_id_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 10b: match reservation with valid match_id OK
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, match_id, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a, 'match', match_a,
      timestamptz '2026-09-01 18:00:00+00',
      timestamptz '2026-09-01 20:00:00+00',
      'Linked match reservation',
      'confirmed'
    ) RETURNING id INTO res_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '10b_match_reservation_with_match_id_allowed',
      res_id IS NOT NULL,
      format('reservation_id=%s match_id=%s', res_id, match_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '10b_match_reservation_with_match_id_allowed', false, SQLERRM
    );
  END;

  -- Test 11a duplicate profile+role
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_officials (match_id, organization_id, profile_id, role)
    VALUES (match_a, org_a, uid_ref, 'referee');
    INSERT INTO public.match_officials (match_id, organization_id, profile_id, role)
    VALUES (match_a, org_a, uid_ref, 'referee');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '11a_duplicate_official_same_role_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '11a_duplicate_official_same_role_rejected',
      SQLERRM ILIKE '%match_officials_match_profile_role_unique%'
        OR SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Test 11b same profile different roles OK
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- ensure referee exists (may have been inserted before duplicate failed)
    INSERT INTO public.match_officials (match_id, organization_id, profile_id, role)
    VALUES (match_a, org_a, uid_ref, 'referee')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.match_officials (match_id, organization_id, profile_id, role)
    VALUES (match_a, org_a, uid_ref, 'delegate');
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO v_count
    FROM public.match_officials
    WHERE match_id = match_a AND profile_id = uid_ref;
    INSERT INTO public.__mig006a_test_results VALUES (
      '11b_same_profile_different_roles_allowed',
      v_count = 2,
      format('official_rows_for_profile=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '11b_same_profile_different_roles_allowed', false, SQLERRM
    );
  END;

  -- Test 12 officials org mismatch
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.match_officials (match_id, organization_id, profile_id, role)
    VALUES (match_a, org_b, uid_admin_a, 'assistant');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '12_officials_org_must_match_match',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig006a_test_results VALUES (
      '12_officials_org_must_match_match',
      SQLERRM ILIKE '%must match matches.organization_id%',
      SQLERRM
    );
  END;

  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_ref)
     OR slug IN ('org-a-mig006a', 'org-b-mig006a');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_ref);
END $$;

SELECT test_name, passed, details
FROM public.__mig006a_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig006a_test_results;
