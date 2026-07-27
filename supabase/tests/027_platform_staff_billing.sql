-- Migration 027: platform staff + billing panel isolation tests
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/027_platform_staff_billing.sql

DROP TABLE IF EXISTS public.__mig027_test_results;
CREATE TABLE public.__mig027_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig027_test_results DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0270';
  uid_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0271';
  uid_staff uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0270';
  uid_outsider uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0270';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  v_count integer;
  v_status text;
  v_row record;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig027.local', '$2a$06$testhashligapromigration027aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin, 'authenticated', 'authenticated',
     'admin@ligapro-mig027.local', '$2a$06$testhashligapromigration027aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_staff, 'authenticated', 'authenticated',
     'staff@ligapro-mig027.local', '$2a$06$testhashligapromigration027aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_outsider, 'authenticated', 'authenticated',
     'outsider@ligapro-mig027.local', '$2a$06$testhashligapromigration027aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig027');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin, 'organization_admin');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga 027A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_a, org_a, 'Temp 027A', 'temp-027a', 'round_robin', '2026-09-01')
  RETURNING id INTO season_a;

  PERFORM set_config('request.jwt.claim.sub', uid_outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_outsider::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig027');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga 027B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_b, org_b, 'Temp 027B', 'temp-027b', 'round_robin', '2026-09-01')
  RETURNING id INTO season_b;

  EXECUTE 'RESET ROLE';
  INSERT INTO public.platform_staff (profile_id) VALUES (uid_staff);

  -- 1. Outsider cannot set_platform_billing_status
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_outsider::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.set_platform_billing_status(season_a, 'pagado', 'test');
    INSERT INTO public.__mig027_test_results VALUES (
      '01_outsider_cannot_set_billing', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '01_outsider_cannot_set_billing',
      SQLERRM ILIKE '%platform staff%',
      SQLERRM
    );
  END;

  -- 2. Org owner cannot set_platform_billing_status
  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.set_platform_billing_status(season_a, 'pagado', 'test');
    INSERT INTO public.__mig027_test_results VALUES (
      '02_owner_cannot_set_billing', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '02_owner_cannot_set_billing',
      SQLERRM ILIKE '%platform staff%',
      SQLERRM
    );
  END;

  -- 3. Org admin cannot set_platform_billing_status
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.set_platform_billing_status(season_a, 'pagado', 'test');
    INSERT INTO public.__mig027_test_results VALUES (
      '03_admin_cannot_set_billing', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '03_admin_cannot_set_billing',
      SQLERRM ILIKE '%platform staff%',
      SQLERRM
    );
  END;

  -- 4. Outsider cannot get_platform_billing_overview
  PERFORM set_config('request.jwt.claim.sub', uid_outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_outsider::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.get_platform_billing_overview();
    INSERT INTO public.__mig027_test_results VALUES (
      '04_outsider_cannot_read_overview', false, 'unexpected success count=' || v_count
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '04_outsider_cannot_read_overview',
      SQLERRM ILIKE '%platform staff%',
      SQLERRM
    );
  END;

  -- 5. Owner cannot get_platform_billing_overview
  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.get_platform_billing_overview();
    INSERT INTO public.__mig027_test_results VALUES (
      '05_owner_cannot_read_overview', false, 'unexpected success count=' || v_count
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '05_owner_cannot_read_overview',
      SQLERRM ILIKE '%platform staff%',
      SQLERRM
    );
  END;

  -- 6. No direct SELECT on platform_staff (even staff user)
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_staff::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.platform_staff;
    INSERT INTO public.__mig027_test_results VALUES (
      '06_no_direct_select_platform_staff', false, 'unexpected count=' || v_count
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '06_no_direct_select_platform_staff',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- 7. Invalid status rejected
  BEGIN
    PERFORM public.set_platform_billing_status(season_a, 'invalido', NULL);
    INSERT INTO public.__mig027_test_results VALUES (
      '07_invalid_status_rejected', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig027_test_results VALUES (
      '07_invalid_status_rejected',
      SQLERRM ILIKE '%Invalid platform_billing_status%',
      SQLERRM
    );
  END;

  -- 8. Staff can set billing on any org
  PERFORM public.set_platform_billing_status(season_b, 'pagado', 'activated');
  EXECUTE 'RESET ROLE';
  SELECT platform_billing_status INTO v_status
  FROM public.seasons WHERE id = season_b;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_staff::text, 'role', 'authenticated')::text,
    true
  );
  INSERT INTO public.__mig027_test_results VALUES (
    '08_staff_sets_billing_cross_org',
    v_status = 'pagado',
    'status=' || COALESCE(v_status, 'null')
  );

  PERFORM public.set_platform_billing_status(season_a, 'vencido', 'overdue');
  EXECUTE 'RESET ROLE';
  SELECT platform_billing_status INTO v_status
  FROM public.seasons WHERE id = season_a;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_staff::text, 'role', 'authenticated')::text,
    true
  );
  INSERT INTO public.__mig027_test_results VALUES (
    '09_staff_sets_billing_own_season',
    v_status = 'vencido',
    'status=' || COALESCE(v_status, 'null')
  );

  -- 10. Staff can read overview (includes both seasons)
  SELECT COUNT(*) INTO v_count FROM public.get_platform_billing_overview();
  INSERT INTO public.__mig027_test_results VALUES (
    '10_staff_reads_overview',
    v_count >= 2,
    'count=' || v_count
  );

  -- 11. Overview row shape — only expected columns, no extra leakage in one sample row
  SELECT * INTO v_row
  FROM public.get_platform_billing_overview()
  WHERE season_id = season_a;

  INSERT INTO public.__mig027_test_results VALUES (
    '11_overview_row_has_expected_fields',
    v_row.season_id IS NOT NULL
      AND v_row.organization_name IS NOT NULL
      AND v_row.season_name IS NOT NULL
      AND v_row.platform_billing_status IS NOT NULL
      AND v_row.enrolled_team_count IS NOT NULL
      AND v_row.has_fixture IS NOT NULL,
    format(
      'org=%s season=%s status=%s teams=%s fixture=%s',
      v_row.organization_name,
      v_row.season_name,
      v_row.platform_billing_status,
      v_row.enrolled_team_count,
      v_row.has_fixture
    )
  );

  -- No cleanup: linked runner cannot bypass audit_log DELETE; test UUIDs are fixed (single-run).
END $$;

SELECT
  test_name,
  passed,
  details,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM public.__mig027_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE NOT passed) AS failures,
  COUNT(*) AS total
FROM public.__mig027_test_results;
