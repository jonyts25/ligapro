-- Isolation tests for Migration 003 (competitions / seasons / season_rules)
-- Separate file so 001/002 suites stay stable.
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/003_competitions_seasons_isolation.sql

DROP TABLE IF EXISTS public.__mig003_test_results;
CREATE TABLE public.__mig003_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  season_rules_a uuid;
  season_a2 uuid;
  v_count int;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig003', 'org-b-mig003');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig003.local', '$2a$06$testhashligapromigration003aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig003.local', '$2a$06$testhashligapromigration003aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig003.local', '$2a$06$testhashligapromigration003aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig003.local', '$2a$06$testhashligapromigration003aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig003', 'org-a-mig003')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B + seed competition/season/rules for isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig003', 'org-b-mig003')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B')
  RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    competition_b, org_b, 'Season B', 'apertura-2026', 'round_robin', 'draft'
  )
  RETURNING id INTO season_b;
  EXECUTE 'RESET ROLE';

  -- Test 1: user A cannot read org B competitions/seasons/rules
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.competitions WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig003_test_results VALUES (
    '1a_user_a_cannot_read_org_b_competitions',
    v_count = 0,
    format('competitions_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.seasons WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig003_test_results VALUES (
    '1b_user_a_cannot_read_org_b_seasons',
    v_count = 0,
    format('seasons_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.season_rules WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig003_test_results VALUES (
    '1c_user_a_cannot_read_org_b_season_rules',
    v_count = 0,
    format('season_rules_visible=%s', v_count)
  );

  -- Test 2: member cannot create competition
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.competitions (organization_id, name)
    VALUES (org_a, 'Member Comp');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '2_member_cannot_create_competition',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '2_member_cannot_create_competition',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 3: admin creates competition + season; season_rules auto-created; UPDATE works
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.competitions (organization_id, name)
    VALUES (org_a, 'Liga Dominical')
    RETURNING id INTO competition_a;

    INSERT INTO public.seasons (
      competition_id, organization_id, name, slug, format_type, visibility
    ) VALUES (
      competition_a, org_a, 'Apertura 2026', 'apertura-2026', 'round_robin', 'draft'
    )
    RETURNING id INTO season_a;

    SELECT id INTO season_rules_a
    FROM public.season_rules
    WHERE season_id = season_a;

    UPDATE public.season_rules
    SET points_win = 3, yellow_card_limit = 4
    WHERE id = season_rules_a;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';

    INSERT INTO public.__mig003_test_results VALUES (
      '3_admin_creates_competition_season_and_rules',
      competition_a IS NOT NULL
        AND season_a IS NOT NULL
        AND season_rules_a IS NOT NULL
        AND v_count = 1,
      format(
        'competition=%s season=%s rules=%s updated_rows=%s',
        competition_a, season_a, season_rules_a, v_count
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '3_admin_creates_competition_season_and_rules',
      false,
      SQLERRM
    );
  END;

  -- Test 4: season org must match competition org
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.seasons (
      competition_id, organization_id, name, slug, format_type
    ) VALUES (
      competition_a, org_b, 'Bad Season', 'bad-season', 'round_robin'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '4_season_org_must_match_competition_org',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '4_season_org_must_match_competition_org',
      SQLERRM ILIKE '%must match competitions.organization_id%',
      SQLERRM
    );
  END;

  -- Test 5: season_rules org must match season org
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- Delete auto rules first so we can attempt a mismatched insert? No —
    -- insert a second row with wrong org should fail uniqueness OR consistency.
    -- Use a fresh season without touching unique: delete rules then insert wrong org.
    DELETE FROM public.season_rules WHERE season_id = season_a;
    INSERT INTO public.season_rules (season_id, organization_id)
    VALUES (season_a, org_b);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '5_season_rules_org_must_match_season_org',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '5_season_rules_org_must_match_season_org',
      SQLERRM ILIKE '%must match seasons.organization_id%',
      SQLERRM
    );
    -- Restore default rules for later tests if deleted
    IF NOT EXISTS (SELECT 1 FROM public.season_rules WHERE season_id = season_a) THEN
      INSERT INTO public.season_rules (season_id, organization_id)
      VALUES (season_a, org_a)
      RETURNING id INTO season_rules_a;
    END IF;
  END;

  -- Test 6: invalid format_type
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.seasons (
      competition_id, organization_id, name, slug, format_type
    ) VALUES (
      competition_a, org_a, 'Bad Format', 'bad-format', 'swiss'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '6_invalid_format_type_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '6_invalid_format_type_rejected',
      SQLERRM ILIKE '%seasons_format_type_check%' OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 7: invalid visibility
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.seasons (
      competition_id, organization_id, name, slug, format_type, visibility
    ) VALUES (
      competition_a, org_a, 'Bad Vis', 'bad-vis', 'round_robin', 'secret'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '7_invalid_visibility_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '7_invalid_visibility_rejected',
      SQLERRM ILIKE '%seasons_visibility_check%' OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 8: points_loss > points_draw
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.season_rules
    SET points_loss = 5, points_draw = 1, points_win = 3
    WHERE season_id = season_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '8_points_order_check_enforced',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '8_points_order_check_enforced',
      SQLERRM ILIKE '%season_rules_points_order_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 9: two season_rules for same season → UNIQUE fail
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.season_rules (season_id, organization_id)
    VALUES (season_a, org_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '9_unique_season_rules_per_season',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '9_unique_season_rules_per_season',
      SQLERRM ILIKE '%season_rules_season_id_unique%'
        OR SQLERRM ILIKE '%unique%'
        OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Test 10a: same slug in same org → fail
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.seasons (
      competition_id, organization_id, name, slug, format_type
    ) VALUES (
      competition_a, org_a, 'Dup Slug', 'apertura-2026', 'knockout'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '10a_same_slug_same_org_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig003_test_results VALUES (
      '10a_same_slug_same_org_rejected',
      SQLERRM ILIKE '%seasons_organization_id_slug_unique%'
        OR SQLERRM ILIKE '%unique%'
        OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- Test 10b: same slug in different orgs → OK
  BEGIN
    -- already have season_b with slug apertura-2026 in org_b from seed
    -- create another season in org_a with a different slug first... 
    -- seed already has apertura-2026 in BOTH if admin created season_a with that slug
    -- and org_b also has apertura-2026 — that already proves composite unique works!
    -- Explicitly verify both exist:
    SELECT count(*) INTO v_count
    FROM public.seasons
    WHERE slug = 'apertura-2026'
      AND organization_id IN (org_a, org_b);

    INSERT INTO public.__mig003_test_results VALUES (
      '10b_same_slug_different_orgs_allowed',
      v_count = 2,
      format('seasons_with_slug_across_orgs=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig003_test_results VALUES (
      '10b_same_slug_different_orgs_allowed',
      false,
      SQLERRM
    );
  END;

  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig003', 'org-b-mig003');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);
END $$;

SELECT test_name, passed, details
FROM public.__mig003_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig003_test_results;
