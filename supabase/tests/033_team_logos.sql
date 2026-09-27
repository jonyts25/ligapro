-- Tests for team logos migration (teams.logo_path, set_team_logo, team-logos bucket)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/033_team_logos.sql

DROP TABLE IF EXISTS public.__mig033_test_results;
CREATE TABLE public.__mig033_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig033_test_results DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.__mig033_test_results TO postgres, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.__mig033_as(p_uid uuid)
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
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0330';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0331';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0330';
  org_a uuid;
  org_b uuid;
  team_a uuid;
  team_b uuid;
  v_path text;
  v_bad_path text;
  v_logo text;
  v_ok boolean;
  v_err text;
  v_bucket_public boolean;
  v_bucket_limit bigint;
  v_mimes text[];
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;

  DELETE FROM public.teams
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_owner_b);
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_owner_b);

  ALTER TABLE public.teams ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig033.local', '$2a$06$testhashligapromigration033aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig033.local', '$2a$06$testhashligapromigration033aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig033.local', '$2a$06$testhashligapromigration033aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM public.__mig033_as(uid_owner_a);
  org_a := public.create_organization_with_owner('Org Team Logos A');
  team_a := gen_random_uuid();
  INSERT INTO public.teams (id, organization_id, name)
  VALUES (team_a, org_a, 'Halcones FC');

  PERFORM public.__mig033_as(uid_owner_b);
  org_b := public.create_organization_with_owner('Org Team Logos B');
  team_b := gen_random_uuid();
  INSERT INTO public.teams (id, organization_id, name)
  VALUES (team_b, org_b, 'Leones SC');

  -- admin of org A can set valid logo
  v_path := org_a::text || '/' || team_a::text || '/' || gen_random_uuid()::text || '.webp';
  PERFORM public.__mig033_as(uid_admin_a);
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin_a, 'organization_admin')
  ON CONFLICT DO NOTHING;

  PERFORM public.set_team_logo(team_a, v_path);
  SELECT logo_path INTO v_logo FROM public.teams WHERE id = team_a;
  INSERT INTO public.__mig033_test_results VALUES (
    '01_admin_sets_valid_logo_path',
    v_logo = v_path,
    format('logo=%s', v_logo)
  );

  -- admin can clear logo
  PERFORM public.set_team_logo(team_a, NULL);
  SELECT logo_path INTO v_logo FROM public.teams WHERE id = team_a;
  INSERT INTO public.__mig033_test_results VALUES (
    '02_admin_clears_logo',
    v_logo IS NULL,
    format('logo=%s', v_logo)
  );

  -- other org admin cannot set logo on team A
  PERFORM public.__mig033_as(uid_owner_b);
  v_bad_path := org_a::text || '/' || team_a::text || '/' || gen_random_uuid()::text || '.png';
  BEGIN
    PERFORM public.set_team_logo(team_a, v_bad_path);
    v_ok := false;
    v_err := 'cross org set allowed';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig033_test_results VALUES (
    '03_other_org_admin_cannot_set_logo',
    v_ok,
    v_err
  );

  -- wrong org segment in path
  PERFORM public.__mig033_as(uid_owner_a);
  v_bad_path := org_b::text || '/' || team_a::text || '/' || gen_random_uuid()::text || '.png';
  BEGIN
    PERFORM public.set_team_logo(team_a, v_bad_path);
    v_ok := false;
    v_err := 'foreign org path accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig033_test_results VALUES (
    '04_foreign_org_logo_path_fails',
    v_ok,
    v_err
  );

  -- wrong team segment in path
  v_bad_path := org_a::text || '/' || team_b::text || '/' || gen_random_uuid()::text || '.png';
  BEGIN
    PERFORM public.set_team_logo(team_a, v_bad_path);
    v_ok := false;
    v_err := 'foreign team path accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig033_test_results VALUES (
    '05_foreign_team_logo_path_fails',
    v_ok,
    v_err
  );

  -- dotdot path
  BEGIN
    PERFORM public.set_team_logo(
      team_a,
      org_a::text || '/' || team_a::text || '/../' || gen_random_uuid()::text || '.png'
    );
    v_ok := false;
    v_err := 'dotdot accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig033_test_results VALUES (
    '06_dotdot_logo_path_fails',
    v_ok,
    v_err
  );

  -- svg extension
  BEGIN
    PERFORM public.set_team_logo(
      team_a,
      org_a::text || '/' || team_a::text || '/' || gen_random_uuid()::text || '.svg'
    );
    v_ok := false;
    v_err := 'svg accepted';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
    v_err := SQLERRM;
  END;
  INSERT INTO public.__mig033_test_results VALUES (
    '07_svg_logo_path_fails',
    v_ok,
    v_err
  );

  -- bucket config
  SELECT public, file_size_limit, allowed_mime_types
  INTO v_bucket_public, v_bucket_limit, v_mimes
  FROM storage.buckets
  WHERE id = 'team-logos';

  INSERT INTO public.__mig033_test_results VALUES (
    '08_bucket_exists_public',
    v_bucket_public IS TRUE,
    format('public=%s', v_bucket_public)
  );
  INSERT INTO public.__mig033_test_results VALUES (
    '09_bucket_size_2mb',
    v_bucket_limit = 2097152,
    format('limit=%s', v_bucket_limit)
  );
  INSERT INTO public.__mig033_test_results VALUES (
    '10_bucket_mime_types',
    v_mimes @> ARRAY['image/png', 'image/jpeg', 'image/webp']::text[],
    format('mimes=%s', v_mimes)
  );
END;
$$;

SELECT
  test_name,
  passed,
  details
FROM public.__mig033_test_results
ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE NOT passed) AS failures,
  count(*) AS total
FROM public.__mig033_test_results;
