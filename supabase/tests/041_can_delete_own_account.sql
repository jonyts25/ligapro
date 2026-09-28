-- Migration 041 (step 3.1): can_delete_own_account + players.profile_id ON DELETE SET NULL
--
-- PREREQUISITE: apply supabase/migrations/20260930100000_can_delete_own_account.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/041_can_delete_own_account.sql

DROP TABLE IF EXISTS public.__mig041_test_results;
CREATE TABLE public.__mig041_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig041_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig041_as(p_uid uuid)
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
  uid_sole_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0411';
  uid_co_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0412';
  uid_co_owner_b uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0413';
  uid_admin_only uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0414';
  uid_no_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0415';
  uid_player_test uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0416';
  org_sole uuid;
  org_co uuid;
  org_admin uuid;
  org_player uuid;
  team_player uuid;
  player_id uuid;
  v_can_delete boolean;
  v_blocking text[];
  v_player_profile uuid;
  v_player_exists boolean;
BEGIN
  DELETE FROM public.organizations
  WHERE slug IN ('org-sole-mig041', 'org-co-mig041', 'org-admin-mig041', 'org-player-mig041');
  DELETE FROM auth.users
  WHERE id IN (
    uid_sole_owner,
    uid_co_owner_a,
    uid_co_owner_b,
    uid_admin_only,
    uid_no_org,
    uid_player_test
  );

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_sole_owner, 'authenticated', 'authenticated',
     'sole-owner@ligapro-mig041.local', '$2a$06$testhashligapromigration041aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_co_owner_a, 'authenticated', 'authenticated',
     'co-owner-a@ligapro-mig041.local', '$2a$06$testhashligapromigration041aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_co_owner_b, 'authenticated', 'authenticated',
     'co-owner-b@ligapro-mig041.local', '$2a$06$testhashligapromigration041aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_only, 'authenticated', 'authenticated',
     'admin-only@ligapro-mig041.local', '$2a$06$testhashligapromigration041aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_no_org, 'authenticated', 'authenticated',
     'no-org@ligapro-mig041.local', '$2a$06$testhashligapromigration041aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_player_test, 'authenticated', 'authenticated',
     'player-test@ligapro-mig041.local', '$2a$06$testhashligapromigration041aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_sole_owner, 'sole-owner@ligapro-mig041.local', 'Sole Owner'),
    (uid_co_owner_a, 'co-owner-a@ligapro-mig041.local', 'Co Owner A'),
    (uid_co_owner_b, 'co-owner-b@ligapro-mig041.local', 'Co Owner B'),
    (uid_admin_only, 'admin-only@ligapro-mig041.local', 'Admin Only'),
    (uid_no_org, 'no-org@ligapro-mig041.local', 'No Org'),
    (uid_player_test, 'player-test@ligapro-mig041.local', 'Player Test')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig041_as(uid_sole_owner);
  org_sole := public.create_organization_with_owner('Org Sole Mig041');
  UPDATE public.organizations SET slug = 'org-sole-mig041' WHERE id = org_sole;

  PERFORM public.__mig041_as(uid_co_owner_a);
  org_co := public.create_organization_with_owner('Org Co Mig041');
  UPDATE public.organizations SET slug = 'org-co-mig041' WHERE id = org_co;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_co, uid_co_owner_b, 'organization_owner')
  ON CONFLICT DO NOTHING;

  PERFORM public.__mig041_as(uid_admin_only);
  org_admin := public.create_organization_with_owner('Org Admin Mig041');
  UPDATE public.organizations SET slug = 'org-admin-mig041' WHERE id = org_admin;

  UPDATE public.organization_members
  SET role = 'organization_admin'
  WHERE organization_id = org_admin AND profile_id = uid_admin_only;

  PERFORM public.__mig041_as(uid_sole_owner);
  SELECT c.can_delete, c.blocking_organization_names
  INTO v_can_delete, v_blocking
  FROM public.can_delete_own_account() AS c;

  INSERT INTO public.__mig041_test_results VALUES (
    'sole_owner_blocked_with_org_name',
    v_can_delete = false
      AND array_length(v_blocking, 1) = 1
      AND v_blocking[1] = 'Org Sole Mig041',
    format('can_delete=%s blocking=%s', v_can_delete, v_blocking)
  );

  PERFORM public.__mig041_as(uid_co_owner_a);
  SELECT c.can_delete, c.blocking_organization_names
  INTO v_can_delete, v_blocking
  FROM public.can_delete_own_account() AS c;

  INSERT INTO public.__mig041_test_results VALUES (
    'co_owner_can_delete',
    v_can_delete = true AND COALESCE(array_length(v_blocking, 1), 0) = 0,
    format('can_delete=%s blocking=%s', v_can_delete, v_blocking)
  );

  PERFORM public.__mig041_as(uid_admin_only);
  SELECT c.can_delete, c.blocking_organization_names
  INTO v_can_delete, v_blocking
  FROM public.can_delete_own_account() AS c;

  INSERT INTO public.__mig041_test_results VALUES (
    'admin_only_can_delete',
    v_can_delete = true AND COALESCE(array_length(v_blocking, 1), 0) = 0,
    format('can_delete=%s blocking=%s', v_can_delete, v_blocking)
  );

  PERFORM public.__mig041_as(uid_no_org);
  SELECT c.can_delete, c.blocking_organization_names
  INTO v_can_delete, v_blocking
  FROM public.can_delete_own_account() AS c;

  INSERT INTO public.__mig041_test_results VALUES (
    'no_org_can_delete',
    v_can_delete = true AND COALESCE(array_length(v_blocking, 1), 0) = 0,
    format('can_delete=%s blocking=%s', v_can_delete, v_blocking)
  );

  PERFORM public.__mig041_as(uid_player_test);
  org_player := public.create_organization_with_owner('Org Player Mig041');
  UPDATE public.organizations SET slug = 'org-player-mig041' WHERE id = org_player;

  INSERT INTO public.teams (organization_id, name)
  VALUES (org_player, 'Equipo Player Test')
  RETURNING id INTO team_player;

  INSERT INTO public.players (organization_id, profile_id, full_name)
  VALUES (org_player, uid_player_test, 'Jugador Vinculado')
  RETURNING id INTO player_id;

  DELETE FROM public.profiles WHERE id = uid_player_test;

  SELECT profile_id INTO v_player_profile
  FROM public.players
  WHERE id = player_id;

  SELECT EXISTS (
    SELECT 1 FROM public.players WHERE id = player_id
  ) INTO v_player_exists;

  INSERT INTO public.__mig041_test_results VALUES (
    'player_survives_profile_delete_set_null',
    v_player_exists = true AND v_player_profile IS NULL,
    format('player_exists=%s profile_id=%s', v_player_exists, v_player_profile)
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig041_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed
  FROM public.__mig041_test_results
  WHERE NOT passed;

  IF v_failed > 0 THEN
    RAISE EXCEPTION '041_can_delete_own_account: % test(s) failed', v_failed;
  END IF;
END;
$$;
