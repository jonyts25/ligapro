-- Isolation tests for Migration 002 (venues / fields / availability rules)
-- Separate file from 001 so the approved identity suite stays stable and
-- this suite can be re-run independently.
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/002_venues_fields_isolation.sql

DROP TABLE IF EXISTS public.__mig002_test_results;
CREATE TABLE public.__mig002_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';
  org_a uuid;
  org_b uuid;
  venue_a uuid;
  venue_b uuid;
  field_a uuid;
  v_count int;
  v_venue public.venues;
  v_field public.fields;
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig002', 'org-b-mig002');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig002.local', '$2a$06$testhashligapromigration002aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig002.local', '$2a$06$testhashligapromigration002aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig002.local', '$2a$06$testhashligapromigration002aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig002.local', '$2a$06$testhashligapromigration002aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A (owner) + admin + member
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig002', 'org-a-mig002')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B (owner) + venue/field seed for isolation reads
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig002', 'org-b-mig002')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.venues (organization_id, name, address)
  VALUES (org_b, 'Venue B', 'Addr B')
  RETURNING id INTO venue_b;
  INSERT INTO public.fields (venue_id, organization_id, name, surface_type)
  VALUES (venue_b, org_b, 'Field B1', 'sintetico');
  INSERT INTO public.field_availability_rules (
    field_id, organization_id, day_of_week, starts_at, ends_at
  )
  SELECT f.id, org_b, 1, time '08:00', time '10:00'
  FROM public.fields f
  WHERE f.venue_id = venue_b
  LIMIT 1;
  EXECUTE 'RESET ROLE';

  -- Test 1: user A cannot read org B venues/fields/rules
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.venues WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig002_test_results VALUES (
    '1a_user_a_cannot_read_org_b_venues',
    v_count = 0,
    format('venues_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.fields WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig002_test_results VALUES (
    '1b_user_a_cannot_read_org_b_fields',
    v_count = 0,
    format('fields_visible=%s', v_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count
  FROM public.field_availability_rules
  WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig002_test_results VALUES (
    '1c_user_a_cannot_read_org_b_rules',
    v_count = 0,
    format('rules_visible=%s', v_count)
  );

  -- Test 2: member cannot create venue
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.venues (organization_id, name)
    VALUES (org_a, 'Member Venue');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '2_member_cannot_create_venue',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '2_member_cannot_create_venue',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 3: admin can create venue + field
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.venues (organization_id, name, address)
    VALUES (org_a, 'Venue A', 'Addr A')
    RETURNING id INTO venue_a;
    INSERT INTO public.fields (venue_id, organization_id, name, surface_type)
    VALUES (venue_a, org_a, 'Campo 1', 'pasto')
    RETURNING id INTO field_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '3_admin_can_create_venue_and_field',
      venue_a IS NOT NULL AND field_a IS NOT NULL,
      format('venue=%s field=%s', venue_a, field_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '3_admin_can_create_venue_and_field',
      false,
      SQLERRM
    );
  END;

  -- Test 4: field.organization_id must match venue.organization_id
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.fields (venue_id, organization_id, name)
    VALUES (venue_a, org_b, 'Cross-tenant field');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '4_field_org_must_match_venue_org',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '4_field_org_must_match_venue_org',
      SQLERRM ILIKE '%must match venues.organization_id%',
      SQLERRM
    );
  END;

  -- Test 5: ends_at <= starts_at fails CHECK
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_availability_rules (
      field_id, organization_id, day_of_week, starts_at, ends_at
    ) VALUES (field_a, org_a, 2, time '10:00', time '09:00');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '5_rule_ends_at_must_be_after_starts_at',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '5_rule_ends_at_must_be_after_starts_at',
      SQLERRM ILIKE '%field_availability_rules_time_range_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 6: day_of_week outside 0-6 fails CHECK
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_availability_rules (
      field_id, organization_id, day_of_week, starts_at, ends_at
    ) VALUES (field_a, org_a, 7, time '08:00', time '09:00');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '6_rule_day_of_week_must_be_0_to_6',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig002_test_results VALUES (
      '6_rule_day_of_week_must_be_0_to_6',
      SQLERRM ILIKE '%field_availability_rules_day_of_week_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig002', 'org-b-mig002');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);
END $$;

SELECT test_name, passed, details
FROM public.__mig002_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig002_test_results;
