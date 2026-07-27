-- Migration 028: platform pricing defaults tests
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/028_platform_pricing_defaults.sql

DROP TABLE IF EXISTS public.__mig028_test_results;
CREATE TABLE public.__mig028_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig028_test_results DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  uid_staff uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0280';
  uid_outsider uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0280';
  v_base numeric;
  v_hasta_3 numeric;
  v_count integer;
  v_err text;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_staff, 'authenticated', 'authenticated',
     'staff@ligapro-mig028.local', '$2a$06$testhashligapromigration028aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_outsider, 'authenticated', 'authenticated',
     'outsider@ligapro-mig028.local', '$2a$06$testhashligapromigration028aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.platform_staff (profile_id) VALUES (uid_staff);

  -- 1. Outsider cannot read via RPC
  PERFORM set_config('request.jwt.claim.sub', uid_outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_outsider::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.get_platform_pricing_defaults();
    INSERT INTO public.__mig028_test_results VALUES (
      '01_outsider_get_rejected', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      '01_outsider_get_rejected',
      v_err ILIKE '%platform staff%',
      v_err
    );
  END;

  -- 2. Outsider cannot write via RPC
  BEGIN
    PERFORM public.set_platform_pricing_defaults(200, 1, 1.6, 2.6, 1, 0.9, 0.8);
    INSERT INTO public.__mig028_test_results VALUES (
      '02_outsider_set_rejected', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      '02_outsider_set_rejected',
      v_err ILIKE '%platform staff%',
      v_err
    );
  END;

  -- 3. No direct SELECT on table (even staff)
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_staff::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.platform_pricing_defaults;
    INSERT INTO public.__mig028_test_results VALUES (
      '03_no_direct_select', false, 'unexpected count=' || v_count
    );
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO public.__mig028_test_results VALUES (
      '03_no_direct_select', true, 'permission denied as expected'
    );
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig028_test_results VALUES (
      '03_no_direct_select',
      v_err ILIKE '%permission denied%',
      v_err
    );
  END;

  -- 4. Staff get returns code defaults when table empty
  SELECT base_price_per_team, duration_multiplier_hasta_3
  INTO v_base, v_hasta_3
  FROM public.get_platform_pricing_defaults();

  INSERT INTO public.__mig028_test_results VALUES (
    '04_staff_get_code_defaults',
    v_base = 200 AND v_hasta_3 = 1.0,
    format('base=%s hasta_3=%s', v_base, v_hasta_3)
  );

  -- 5. Staff can set and read back persisted values
  PERFORM public.set_platform_pricing_defaults(250, 1.1, 1.7, 2.8, 1, 0.85, 0.75);

  SELECT base_price_per_team, duration_multiplier_hasta_3
  INTO v_base, v_hasta_3
  FROM public.get_platform_pricing_defaults();

  INSERT INTO public.__mig028_test_results VALUES (
    '05_staff_set_and_get',
    v_base = 250 AND v_hasta_3 = 1.1,
    format('base=%s hasta_3=%s', v_base, v_hasta_3)
  );

  -- 6. updated_by_profile_id recorded
  SELECT COUNT(*)
  INTO v_count
  FROM public.get_platform_pricing_defaults()
  WHERE updated_by_profile_id = uid_staff;

  INSERT INTO public.__mig028_test_results VALUES (
    '06_updated_by_profile',
    v_count = 1,
    'updated_by=' || uid_staff::text
  );
END;
$$;

SELECT
  test_name,
  passed,
  details
FROM public.__mig028_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM public.__mig028_test_results;
