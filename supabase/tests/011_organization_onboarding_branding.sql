-- Tests for Migration 011 (organization onboarding and branding)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/011_organization_onboarding_branding.sql

DROP TABLE IF EXISTS public.__mig011_test_results;
CREATE TABLE public.__mig011_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig011_test_results DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.__mig011_test_results TO postgres, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.__mig011_force_member_fail()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'forced membership failure'
    USING ERRCODE = 'P0001';
END;
$$;

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa011';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa012';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa013';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb011';
  uid_fresh uuid := 'cccccccc-cccc-cccc-cccc-ccccccccc011';
  uid_noprof uuid := 'dddddddd-dddd-dddd-dddd-ddddddddd011';
  org_a uuid;
  org_b uuid;
  org_tmp uuid;
  v_count int;
  v_color text;
  v_logo text;
  v_ok boolean;
  v_err text;
  v_name text;
  v_bucket_public boolean;
  v_bucket_limit bigint;
  v_mimes text[];
  v_policy_update int;
  v_audit_org int;
  v_audit_member int;
  v_path text;
  v_bad_path text;
BEGIN
  -- Storage SQL DELETE is blocked by storage.protect_delete (not table-owner).
  -- Cleanup of objects is best-effort via unique paths; no direct DELETE.

  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_fresh)
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_fresh);

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_fresh);

  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig011.local', '$2a$06$testhashligapromigration011aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig011.local', '$2a$06$testhashligapromigration011aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig011.local', '$2a$06$testhashligapromigration011aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig011.local', '$2a$06$testhashligapromigration011aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_fresh, 'authenticated', 'authenticated',
     'fresh@ligapro-mig011.local', '$2a$06$testhashligapromigration011aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- 1/2: anon / PUBLIC execute denied
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.create_organization_with_owner('Anon Org');
    EXECUTE 'RESET ROLE';
    v_ok := false;
    v_err := 'anon executed';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES (
    '01_anon_cannot_execute_create',
    v_ok,
    v_err
  );

  SELECT count(*) INTO v_count
  FROM information_schema.role_routine_grants
  WHERE routine_schema = 'public'
    AND routine_name = 'create_organization_with_owner'
    AND grantee = 'PUBLIC';
  INSERT INTO public.__mig011_test_results VALUES (
    '02_public_no_execute',
    v_count = 0,
    format('public_grants=%s', v_count)
  );

  -- 3/4/5/6/12/13/16/17: authenticated without memberships creates org+owner
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org Alpha Mig011', '#14b8a6');

  SELECT count(*) INTO v_count
  FROM public.organization_members
  WHERE organization_id = org_a AND profile_id = uid_owner_a AND role = 'organization_owner';

  INSERT INTO public.__mig011_test_results VALUES (
    '03_authenticated_creates_organization',
    org_a IS NOT NULL,
    format('org=%s', org_a)
  );
  INSERT INTO public.__mig011_test_results VALUES (
    '04_exactly_one_owner_membership',
    v_count = 1,
    format('owner_count=%s', v_count)
  );
  INSERT INTO public.__mig011_test_results VALUES (
    '05_membership_same_tenant',
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = org_a AND m.profile_id = uid_owner_a
    ),
    'ok'
  );
  INSERT INTO public.__mig011_test_results VALUES (
    '06_actor_from_auth_uid',
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_a AND o.created_by = uid_owner_a
    ),
    'ok'
  );

  SELECT brand_color INTO v_color FROM public.organizations WHERE id = org_a;
  INSERT INTO public.__mig011_test_results VALUES (
    '12_color_normalized_uppercase',
    v_color = '#14B8A6',
    format('color=%s', v_color)
  );

  SELECT count(*) INTO v_audit_org
  FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'organizations' AND action = 'insert';
  SELECT count(*) INTO v_audit_member
  FROM public.audit_log
  WHERE organization_id = org_a AND entity_type = 'organization_members' AND action = 'insert';

  INSERT INTO public.__mig011_test_results VALUES (
    '16_audit_log_organization_insert',
    v_audit_org >= 1,
    format('count=%s', v_audit_org)
  );
  INSERT INTO public.__mig011_test_results VALUES (
    '17_audit_log_member_insert',
    v_audit_member >= 1,
    format('count=%s', v_audit_member)
  );

  -- 13: NULL color
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org Beta Mig011', NULL);
  SELECT brand_color INTO v_color FROM public.organizations WHERE id = org_b;
  INSERT INTO public.__mig011_test_results VALUES (
    '13_null_color_allowed',
    org_b IS NOT NULL AND v_color IS NULL,
    format('org=%s color=%s', org_b, v_color)
  );

  -- 7: profile missing
  PERFORM set_config('request.jwt.claim.sub', uid_noprof::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_noprof::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.create_organization_with_owner('No Profile Org');
    v_ok := false;
    v_err := 'expected failure';
  EXCEPTION WHEN OTHERS THEN
    v_ok := SQLERRM ILIKE '%Profile not found%';
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('07_missing_profile_fails', v_ok, v_err);

  -- 8/9/10/11 name and color validation
  PERFORM set_config('request.jwt.claim.sub', uid_fresh::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_fresh::text, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.create_organization_with_owner('  ');
    v_ok := false; v_err := 'empty accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('08_empty_name_fails', v_ok, v_err);

  BEGIN
    PERFORM public.create_organization_with_owner('ab');
    v_ok := false; v_err := 'short accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('09_short_name_fails', v_ok, v_err);

  BEGIN
    PERFORM public.create_organization_with_owner(repeat('x', 101));
    v_ok := false; v_err := 'long accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('10_long_name_fails', v_ok, v_err);

  BEGIN
    PERFORM public.create_organization_with_owner('Fresh Org Color', 'red');
    v_ok := false; v_err := 'invalid color accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('11_invalid_color_fails', v_ok, v_err);

  -- 14: user with membership cannot create second org
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.create_organization_with_owner('Second Org');
    v_ok := false; v_err := 'second org allowed';
  EXCEPTION WHEN OTHERS THEN
    v_ok := SQLERRM ILIKE '%already belongs%';
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('14_member_cannot_create_second', v_ok, v_err);

  -- 15: membership failure rolls back organization
  CREATE TRIGGER __mig011_fail_member_trg
    BEFORE INSERT ON public.organization_members
    FOR EACH ROW
    WHEN (NEW.profile_id = 'cccccccc-cccc-cccc-cccc-ccccccccc011'::uuid)
    EXECUTE FUNCTION public.__mig011_force_member_fail();

  PERFORM set_config('request.jwt.claim.sub', uid_fresh::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_fresh::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.create_organization_with_owner('Rollback Org');
    v_ok := false; v_err := 'no rollback';
  EXCEPTION WHEN OTHERS THEN
    SELECT count(*) INTO v_count
    FROM public.organizations
    WHERE created_by = uid_fresh AND name = 'Rollback Org';
    v_ok := v_count = 0;
    v_err := format('err=%s leftover=%s', SQLERRM, v_count);
  END;
  DROP TRIGGER IF EXISTS __mig011_fail_member_trg ON public.organization_members;
  INSERT INTO public.__mig011_test_results VALUES ('15_membership_fail_rolls_back_org', v_ok, v_err);

  -- Prepare admin/member on org_a
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');

  -- 18 owner updates branding
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.update_organization_branding(org_a, 'Org Alpha Renamed', '#abcdef');
  SELECT name, brand_color INTO v_name, v_color FROM public.organizations WHERE id = org_a;
  INSERT INTO public.__mig011_test_results VALUES (
    '18_owner_updates_branding',
    v_name = 'Org Alpha Renamed' AND v_color = '#ABCDEF',
    format('name=%s color=%s', v_name, v_color)
  );

  -- 19 admin updates
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.update_organization_branding(org_a, 'Org Alpha Admin', '#112233');
  SELECT name INTO v_name FROM public.organizations WHERE id = org_a;
  INSERT INTO public.__mig011_test_results VALUES (
    '19_admin_updates_branding',
    v_name = 'Org Alpha Admin',
    format('name=%s', v_name)
  );

  -- 20 member cannot update
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.update_organization_branding(org_a, 'Hacked', '#000000');
    v_ok := false; v_err := 'member updated';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('20_member_cannot_update_branding', v_ok, v_err);

  -- 21 other org owner cannot update
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.update_organization_branding(org_a, 'Cross Tenant', '#000000');
    v_ok := false; v_err := 'cross update allowed';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('21_other_org_cannot_update', v_ok, v_err);

  -- 22 valid logo_path
  v_path := org_a::text || '/' || gen_random_uuid()::text || '.webp';
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.set_organization_logo(org_a, v_path);
  SELECT logo_path INTO v_logo FROM public.organizations WHERE id = org_a;
  INSERT INTO public.__mig011_test_results VALUES (
    '22_owner_sets_valid_logo_path',
    v_logo = v_path,
    format('logo=%s', v_logo)
  );

  -- 23 other org path
  v_bad_path := org_b::text || '/' || gen_random_uuid()::text || '.png';
  BEGIN
    PERFORM public.set_organization_logo(org_a, v_bad_path);
    v_ok := false; v_err := 'foreign path accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('23_foreign_org_logo_path_fails', v_ok, v_err);

  -- 24 path with ..
  BEGIN
    PERFORM public.set_organization_logo(org_a, org_a::text || '/../' || gen_random_uuid()::text || '.png');
    v_ok := false; v_err := 'dotdot accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('24_dotdot_logo_path_fails', v_ok, v_err);

  -- 25 svg extension
  BEGIN
    PERFORM public.set_organization_logo(org_a, org_a::text || '/' || gen_random_uuid()::text || '.svg');
    v_ok := false; v_err := 'svg accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('25_svg_logo_path_fails', v_ok, v_err);

  -- 26 clear logo
  PERFORM public.set_organization_logo(org_a, NULL);
  SELECT logo_path INTO v_logo FROM public.organizations WHERE id = org_a;
  INSERT INTO public.__mig011_test_results VALUES (
    '26_owner_clears_logo',
    v_logo IS NULL,
    format('logo=%s', v_logo)
  );

  -- 27 member cannot set/clear logo
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.set_organization_logo(org_a, org_a::text || '/' || gen_random_uuid()::text || '.png');
    v_ok := false; v_err := 'member set logo';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('27_member_cannot_set_logo', v_ok, v_err);

  -- 28/29/30 bucket config
  SELECT public, file_size_limit, allowed_mime_types
  INTO v_bucket_public, v_bucket_limit, v_mimes
  FROM storage.buckets
  WHERE id = 'organization-logos';

  INSERT INTO public.__mig011_test_results VALUES (
    '28_bucket_exists_public',
    v_bucket_public IS TRUE,
    format('public=%s', v_bucket_public)
  );
  INSERT INTO public.__mig011_test_results VALUES (
    '29_bucket_size_2mb',
    v_bucket_limit = 2097152,
    format('limit=%s', v_bucket_limit)
  );
  INSERT INTO public.__mig011_test_results VALUES (
    '30_bucket_mime_types',
    v_mimes @> ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
      AND NOT (v_mimes @> ARRAY['image/svg+xml']::text[]),
    format('mimes=%s', v_mimes)
  );

  -- 31 owner insert storage object metadata
  v_path := org_a::text || '/' || gen_random_uuid()::text || '.png';
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('organization-logos', v_path, uid_owner_a, '{}'::jsonb);
    EXECUTE 'RESET ROLE';
    v_ok := true; v_err := v_path;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := false; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('31_owner_can_insert_object', v_ok, v_err);

  -- 32 admin insert
  v_path := org_a::text || '/' || gen_random_uuid()::text || '.jpg';
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('organization-logos', v_path, uid_admin_a, '{}'::jsonb);
    EXECUTE 'RESET ROLE';
    v_ok := true; v_err := v_path;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := false; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('32_admin_can_insert_object', v_ok, v_err);

  -- 33 member cannot insert
  v_path := org_a::text || '/' || gen_random_uuid()::text || '.webp';
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('organization-logos', v_path, uid_member_a, '{}'::jsonb);
    EXECUTE 'RESET ROLE';
    v_ok := false; v_err := 'member inserted';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('33_member_cannot_insert_object', v_ok, v_err);

  -- 34 other org cannot insert into org_a folder
  v_path := org_a::text || '/' || gen_random_uuid()::text || '.png';
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('organization-logos', v_path, uid_owner_b, '{}'::jsonb);
    EXECUTE 'RESET ROLE';
    v_ok := false; v_err := 'cross insert allowed';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('34_other_org_cannot_insert', v_ok, v_err);

  -- 35 anon cannot insert
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES (
      'organization-logos',
      org_a::text || '/' || gen_random_uuid()::text || '.png',
      NULL,
      '{}'::jsonb
    );
    EXECUTE 'RESET ROLE';
    v_ok := false; v_err := 'anon inserted';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := true; v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('35_anon_cannot_insert', v_ok, v_err);

  -- 36/37: cannot execute Storage DELETE via SQL (protect_delete).
  -- Verify DELETE policy exists and is scoped to owner/admin of folder org.
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'organization_logos_delete_owner_admin'
    AND cmd = 'DELETE'
    AND qual ILIKE '%has_role_in_org%'
    AND qual ILIKE '%organization_owner%'
    AND qual ILIKE '%organization_admin%';

  INSERT INTO public.__mig011_test_results VALUES (
    '36_owner_delete_policy_present',
    v_count = 1,
    format('policies=%s', v_count)
  );

  INSERT INTO public.__mig011_test_results VALUES (
    '37_delete_policy_scoped_to_org_roles',
    v_count = 1
      AND EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND policyname = 'organization_logos_delete_owner_admin'
          AND qual ILIKE '%foldername%'
      ),
    'scoped-by-folder-and-role'
  );

  -- 38 anon cannot list metadata
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id = 'organization-logos';
    EXECUTE 'RESET ROLE';
    v_ok := v_count = 0;
    v_err := format('count=%s', v_count);
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig011_test_results VALUES ('38_anon_cannot_list_metadata', v_ok, v_err);

  -- 39 no UPDATE policy
  SELECT count(*) INTO v_policy_update
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND cmd = 'UPDATE'
    AND policyname ILIKE '%organization_logos%';
  INSERT INTO public.__mig011_test_results VALUES (
    '39_no_update_policy',
    v_policy_update = 0,
    format('update_policies=%s', v_policy_update)
  );

  -- 40 branding audit still works
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM public.update_organization_branding(org_a, 'Org Alpha Audited', '#445566');
  SELECT count(*) INTO v_audit_org
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'organizations'
    AND action = 'update';
  INSERT INTO public.__mig011_test_results VALUES (
    '40_branding_update_audited',
    v_audit_org >= 1,
    format('updates=%s', v_audit_org)
  );

  -- cleanup (organizations only; storage objects cleaned via Storage API in app)
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b, uid_fresh);
END $$;

DROP FUNCTION IF EXISTS public.__mig011_force_member_fail();

SELECT test_name, passed, details
FROM public.__mig011_test_results
ORDER BY test_name;
