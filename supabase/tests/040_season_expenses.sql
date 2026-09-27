-- Migration 040: season_expenses tests
--
-- PREREQUISITE: apply supabase/migrations/20260929100000_season_expenses.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/040_season_expenses.sql

DROP TABLE IF EXISTS public.__mig040_test_results;
CREATE TABLE public.__mig040_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig040_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig040_as(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0401';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0402';
  uid_admin_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0402';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  season_a uuid;
  expense_id uuid;
  v_count integer;
  v_err text;
BEGIN
  DELETE FROM public.organizations WHERE slug IN ('org-a-mig040', 'org-b-mig040');
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_admin_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig040.local', '$2a$06$testhashligapromigration040aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig040.local', '$2a$06$testhashligapromigration040aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_b, 'authenticated', 'authenticated',
     'admin-b@ligapro-mig040.local', '$2a$06$testhashligapromigration040aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_owner_a, 'owner-a@ligapro-mig040.local', 'Owner 040'),
    (uid_admin_a, 'admin-a@ligapro-mig040.local', 'Admin 040 A'),
    (uid_admin_b, 'admin-b@ligapro-mig040.local', 'Admin 040 B')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig040_as(uid_owner_a);
  org_a := public.create_organization_with_owner('Org A Mig040');

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin_a, 'organization_admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.competitions (organization_id, name, slug)
  VALUES (org_a, 'Liga 040', 'liga-040')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (
    organization_id, competition_id, name, slug, format_type, visibility
  ) VALUES (
    org_a, competition_a, 'Temporada 040', 'temporada-040', 'league', 'active'
  ) RETURNING id INTO season_a;

  PERFORM public.__mig040_as(uid_admin_b);
  org_b := public.create_organization_with_owner('Org B Mig040');

  -- Admin can insert expense
  PERFORM public.__mig040_as(uid_admin_a);
  INSERT INTO public.season_expenses (
    organization_id, season_id, category, description, amount, recorded_by_profile_id
  ) VALUES (
    org_a, season_a, 'cancha', 'Renta mensual', 1500, uid_admin_a
  ) RETURNING id INTO expense_id;

  SELECT COUNT(*) INTO v_count
  FROM public.season_expenses
  WHERE id = expense_id AND voided_at IS NULL;

  INSERT INTO public.__mig040_test_results VALUES (
    '01_admin_can_insert_expense',
    v_count = 1,
    'count=' || v_count
  );

  -- Admin can void expense
  PERFORM public.void_season_expense(expense_id, 'Duplicado');

  SELECT COUNT(*) INTO v_count
  FROM public.season_expenses
  WHERE id = expense_id AND voided_at IS NOT NULL;

  INSERT INTO public.__mig040_test_results VALUES (
    '02_admin_can_void_expense',
    v_count = 1,
    'voided=' || v_count
  );

  -- Other org admin cannot read org A expenses (RLS)
  PERFORM public.__mig040_as(uid_admin_b);
  SELECT COUNT(*) INTO v_count
  FROM public.season_expenses
  WHERE organization_id = org_a;

  INSERT INTO public.__mig040_test_results VALUES (
    '03_other_org_admin_cannot_read',
    v_count = 0,
    'visible=' || v_count
  );

  -- Other org admin cannot insert into org A
  v_err := NULL;
  BEGIN
    INSERT INTO public.season_expenses (
      organization_id, season_id, category, amount, recorded_by_profile_id
    ) VALUES (
      org_a, season_a, 'otro', 100, uid_admin_b
    );
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  INSERT INTO public.__mig040_test_results VALUES (
    '04_other_org_admin_cannot_insert',
    v_err IS NOT NULL,
    COALESCE(v_err, 'insert succeeded unexpectedly')
  );

  -- void_all_or_none rejects partial void state on INSERT
  v_err := NULL;
  BEGIN
    INSERT INTO public.season_expenses (
      organization_id,
      season_id,
      category,
      amount,
      recorded_by_profile_id,
      voided_at
    ) VALUES (
      org_a, season_a, 'otro', 100, uid_admin_a, now()
    );
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  INSERT INTO public.__mig040_test_results VALUES (
    '05_void_all_or_none_rejects_partial',
    v_err IS NOT NULL,
    COALESCE(v_err, 'partial void insert succeeded')
  );
END $$;

SELECT test_name, passed, details
FROM public.__mig040_test_results
ORDER BY test_name;
