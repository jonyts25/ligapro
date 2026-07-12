-- Isolation / RLS tests for Migration 001 (identity & tenancy)
-- Mechanism: single SQL script against ligapro-dev via
--   npx supabase db query --linked -f supabase/tests/001_identity_tenancy_isolation.sql
-- Uses SET ROLE authenticated + JWT claim set_config (not pgTAP).
-- Not wrapped in SECURITY DEFINER (Postgres forbids SET ROLE there).

DROP TABLE IF EXISTS public.__mig001_test_results;
CREATE TABLE public.__mig001_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  org_a uuid;
  org_b uuid;
  member_row_id uuid;
  admin_row_id uuid;
  v_count int;
  v_org_remaining int;
  v_members_remaining int;
  v_org public.organizations;
BEGIN
  -- Orgs reference profiles via created_by (no cascade); delete orgs first.
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig001', 'org-b-mig001');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-test.local', '$2a$06$testhashligapromigration001aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-test.local', '$2a$06$testhashligapromigration001aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-test.local', '$2a$06$testhashligapromigration001aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-test.local', '$2a$06$testhashligapromigration001aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A + Test 5
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  v_org := public.create_organization_with_owner('Org A Test', 'org-a-mig001');
  org_a := v_org.id;

  SELECT count(*) INTO v_count
  FROM public.organization_members
  WHERE organization_id = org_a AND role = 'organization_owner';

  INSERT INTO public.__mig001_test_results VALUES (
    '5_create_org_has_owner',
    v_count = 1,
    format('owner_count=%s org=%s', v_count, org_a)
  );

  -- Org B
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  v_org := public.create_organization_with_owner('Org B Test', 'org-b-mig001');
  org_b := v_org.id;

  -- Owner A adds admin + member under RLS
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin_a, 'organization_admin')
  RETURNING id INTO admin_row_id;
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_member_a, 'organization_member')
  RETURNING id INTO member_row_id;
  EXECUTE 'RESET ROLE';

  INSERT INTO public.__mig001_test_results VALUES (
    '4_owner_can_add_members',
    admin_row_id IS NOT NULL AND member_row_id IS NOT NULL,
    format('admin_row=%s member_row=%s', admin_row_id, member_row_id)
  );

  -- Test 1a/1b isolation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.organizations WHERE id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig001_test_results VALUES (
    '1a_user_a_cannot_read_org_b',
    v_count = 0,
    format('org_b_visible_rows=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count
  FROM public.organization_members
  WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig001_test_results VALUES (
    '1b_user_a_cannot_read_org_b_members',
    v_count = 0,
    format('org_b_member_rows=%s', v_count)
  );

  -- Test 2a admin self-promote
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.organization_members
    SET role = 'organization_owner'
    WHERE id = admin_row_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '2a_admin_cannot_self_promote_to_owner',
      v_count = 0,
      format('updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '2a_admin_cannot_self_promote_to_owner',
      true,
      format('blocked with error: %s', SQLERRM)
    );
  END;

  -- Test 2b admin promote other
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.organization_members
    SET role = 'organization_owner'
    WHERE id = member_row_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '2b_admin_cannot_promote_other_to_owner',
      v_count = 0,
      format('updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '2b_admin_cannot_promote_other_to_owner',
      true,
      format('blocked with error: %s', SQLERRM)
    );
  END;

  -- Test 3 member cannot update org
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.organizations SET name = 'Hacked by member' WHERE id = org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '3_member_cannot_update_org',
      v_count = 0,
      format('updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '3_member_cannot_update_org',
      true,
      format('blocked with error: %s', SQLERRM)
    );
  END;

  -- Test 4b owner remove member
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.organization_members WHERE id = member_row_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '4b_owner_can_remove_member',
      v_count = 1,
      format('deleted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '4b_owner_can_remove_member',
      false,
      SQLERRM
    );
  END;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_member_a, 'organization_member')
  RETURNING id INTO member_row_id;

  -- Test 6a delete last owner
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.organization_members
    WHERE organization_id = org_a AND profile_id = uid_owner_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '6a_cannot_delete_last_owner',
      false,
      format('unexpected success deleted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '6a_cannot_delete_last_owner',
      SQLERRM ILIKE '%last organization_owner%',
      SQLERRM
    );
  END;

  -- Test 6b demote last owner
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.organization_members
    SET role = 'organization_admin'
    WHERE organization_id = org_a AND profile_id = uid_owner_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '6b_cannot_demote_last_owner',
      false,
      format('unexpected success updated_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '6b_cannot_demote_last_owner',
      SQLERRM ILIKE '%last organization_owner%',
      SQLERRM
    );
  END;

  -- Test 7a: organization_member cannot DELETE organization (RLS → 0 rows)
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.organizations WHERE id = org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '7a_member_cannot_delete_org',
      v_count = 0,
      format('deleted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '7a_member_cannot_delete_org',
      false,
      format('unexpected exception (expected RLS 0-row delete): %s', SQLERRM)
    );
  END;

  -- Test 7b: organization_owner deletes org; members cascade away
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.organizations WHERE id = org_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';

    SELECT count(*) INTO v_org_remaining
    FROM public.organizations
    WHERE id = org_a;

    SELECT count(*) INTO v_members_remaining
    FROM public.organization_members
    WHERE organization_id = org_a;

    INSERT INTO public.__mig001_test_results VALUES (
      '7b_owner_can_delete_org_with_cascade',
      v_count = 1 AND v_org_remaining = 0 AND v_members_remaining = 0,
      format(
        'deleted_rows=%s org_remaining=%s members_remaining=%s',
        v_count,
        v_org_remaining,
        v_members_remaining
      )
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig001_test_results VALUES (
      '7b_owner_can_delete_org_with_cascade',
      false,
      SQLERRM
    );
  END;

  -- Orgs reference profiles via created_by (no cascade); delete orgs first.
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig001', 'org-b-mig001');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);
END $$;

SELECT test_name, passed, details
FROM public.__mig001_test_results
ORDER BY test_name;

DROP FUNCTION IF EXISTS public.__mig001_run_isolation_tests();
-- Keep __mig001_test_results for the report query; drop on next test run start.
