-- Migration 029: platform internal finance isolation tests
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/029_platform_internal_finance.sql

DROP TABLE IF EXISTS public.__mig029_test_results;
CREATE TABLE public.__mig029_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig029_test_results DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0290';
  uid_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0291';
  uid_staff uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0290';
  uid_outsider uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0290';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  income_a uuid;
  income_b uuid;
  expense_id uuid;
  v_summary jsonb;
  v_total_income numeric;
  v_err text;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig029.local', '$2a$06$testhashligapromigration029aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin, 'authenticated', 'authenticated',
     'admin@ligapro-mig029.local', '$2a$06$testhashligapromigration029aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_staff, 'authenticated', 'authenticated',
     'staff@ligapro-mig029.local', '$2a$06$testhashligapromigration029aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_outsider, 'authenticated', 'authenticated',
     'outsider@ligapro-mig029.local', '$2a$06$testhashligapromigration029aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig029');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga 029A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_a, org_a, 'Temp 029A', 'temp-029a', 'round_robin', '2026-09-01')
  RETURNING id INTO season_a;

  PERFORM set_config('request.jwt.claim.sub', uid_outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_outsider::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig029');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Liga 029B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type, starts_on
  ) VALUES (competition_b, org_b, 'Temp 029B', 'temp-029b', 'round_robin', '2026-09-01')
  RETURNING id INTO season_b;

  INSERT INTO public.platform_staff (profile_id) VALUES (uid_staff);

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 1. Owner cannot record income
  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  BEGIN
    PERFORM public.record_platform_income(season_a, 500, 'test');
    INSERT INTO public.__mig029_test_results VALUES (
      '01_owner_record_income_rejected', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig029_test_results VALUES (
      '01_owner_record_income_rejected',
      v_err ILIKE '%platform staff%',
      v_err
    );
  END;

  -- 2. Admin cannot read summary
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  BEGIN
    PERFORM public.get_platform_finance_summary(2026, 7);
    INSERT INTO public.__mig029_test_results VALUES (
      '02_admin_summary_rejected', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig029_test_results VALUES (
      '02_admin_summary_rejected',
      v_err ILIKE '%platform staff%',
      v_err
    );
  END;

  -- 3. Staff records income per season + loose income
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  income_a := public.record_platform_income(season_a, 1000, 'Pago temp A');
  income_b := public.record_platform_income(season_b, 2500, 'Pago temp B');
  PERFORM public.record_platform_income(NULL, 300, 'Ingreso suelto');

  INSERT INTO public.__mig029_test_results VALUES (
    '03_staff_records_income',
    income_a IS NOT NULL AND income_b IS NOT NULL,
    format('income_a=%s income_b=%s', income_a, income_b)
  );

  -- 4. Summary totals sum all non-voided entries in month (seasons stay separate in rows)
  v_summary := public.get_platform_finance_summary(
    EXTRACT(YEAR FROM now())::integer,
    EXTRACT(MONTH FROM now())::integer
  );
  v_total_income := (v_summary ->> 'total_income')::numeric;

  INSERT INTO public.__mig029_test_results VALUES (
    '04_summary_totals_non_voided',
    v_total_income = 3800,
    format('total_income=%s expected=3800', v_total_income)
  );

  -- 5. Void without reason fails
  BEGIN
    PERFORM public.void_platform_income_entry(income_a, '   ');
    INSERT INTO public.__mig029_test_results VALUES (
      '05_void_income_without_reason_fails', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig029_test_results VALUES (
      '05_void_income_without_reason_fails',
      v_err ILIKE '%reason is required%',
      v_err
    );
  END;

  -- 6. Void marks row; summary excludes voided amount
  PERFORM public.void_platform_income_entry(income_a, 'Registro duplicado');
  v_summary := public.get_platform_finance_summary(
    EXTRACT(YEAR FROM now())::integer,
    EXTRACT(MONTH FROM now())::integer
  );
  v_total_income := (v_summary ->> 'total_income')::numeric;

  INSERT INTO public.__mig029_test_results VALUES (
    '06_void_excluded_from_summary',
    v_total_income = 2800,
    format('total_income=%s expected=2800', v_total_income)
  );

  -- 7. Expense record + void
  expense_id := public.record_platform_expense('hosting', 150, 'Railway');
  PERFORM public.void_platform_expense_entry(expense_id, 'Cargo duplicado');
  v_summary := public.get_platform_finance_summary(
    EXTRACT(YEAR FROM now())::integer,
    EXTRACT(MONTH FROM now())::integer
  );

  INSERT INTO public.__mig029_test_results VALUES (
    '07_expense_void_excluded',
    (v_summary ->> 'total_expenses')::numeric = 0,
    format('total_expenses=%s', v_summary ->> 'total_expenses')
  );

  -- 8. No direct SELECT on ledger tables
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  BEGIN
    PERFORM (SELECT COUNT(*) FROM public.platform_income_entries);
    INSERT INTO public.__mig029_test_results VALUES (
      '08_no_direct_select_income', false, 'unexpected access'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO public.__mig029_test_results VALUES (
      '08_no_direct_select_income', true, 'permission denied'
    );
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig029_test_results VALUES (
      '08_no_direct_select_income',
      v_err ILIKE '%permission denied%',
      v_err
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig029_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM public.__mig029_test_results;
