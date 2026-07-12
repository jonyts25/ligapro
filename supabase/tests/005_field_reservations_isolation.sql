-- Isolation / overlap tests for Migration 005 (field_reservations)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/005_field_reservations_isolation.sql

DROP TABLE IF EXISTS public.__mig005_test_results;
CREATE TABLE public.__mig005_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa31';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa32';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa33';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb31';
  org_a uuid;
  org_b uuid;
  venue_a uuid;
  venue_b uuid;
  field_a1 uuid;
  field_a2 uuid;
  field_b1 uuid;
  res_id uuid;
  res_id2 uuid;
  v_count int;
  t0 timestamptz := timestamptz '2026-08-01 17:00:00+00';
BEGIN
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig005', 'org-b-mig005');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig005.local', '$2a$06$testhashligapromigration005aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig005.local', '$2a$06$testhashligapromigration005aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig005.local', '$2a$06$testhashligapromigration005aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig005.local', '$2a$06$testhashligapromigration005aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig005', 'org-a-mig005')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B + seed reservation
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig005', 'org-b-mig005')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.venues (organization_id, name)
  VALUES (org_b, 'Venue B') RETURNING id INTO venue_b;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_b, org_b, 'Field B1') RETURNING id INTO field_b1;
  INSERT INTO public.field_reservations (
    organization_id, field_id, reservation_type, starts_at, ends_at, title, status
  ) VALUES (
    org_b, field_b1, 'maintenance',
    t0 + interval '1 day', t0 + interval '1 day' + interval '1 hour',
    'Org B block', 'confirmed'
  );
  EXECUTE 'RESET ROLE';

  -- Org A fields (admin)
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.venues (organization_id, name)
  VALUES (org_a, 'Venue A') RETURNING id INTO venue_a;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field A1') RETURNING id INTO field_a1;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field A2') RETURNING id INTO field_a2;
  EXECUTE 'RESET ROLE';

  -- Test 1: A cannot read B
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count
  FROM public.field_reservations
  WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig005_test_results VALUES (
    '1_user_a_cannot_read_org_b_reservations',
    v_count = 0,
    format('reservations_visible=%s', v_count)
  );

  -- Test 2: member cannot create
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title
    ) VALUES (
      org_a, field_a1, 'maintenance',
      t0, t0 + interval '1 hour', 'Member block'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '2_member_cannot_create_reservation',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '2_member_cannot_create_reservation',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 3: admin creates maintenance
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'maintenance',
      timestamptz '2026-08-01 10:00:00+00',
      timestamptz '2026-08-01 11:00:00+00',
      'Mantenimiento de pasto',
      'confirmed'
    ) RETURNING id INTO res_id;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '3_admin_creates_maintenance_reservation',
      res_id IS NOT NULL,
      format('reservation_id=%s', res_id)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '3_admin_creates_maintenance_reservation', false, SQLERRM
    );
  END;

  -- Test 4: org mismatch vs field
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title
    ) VALUES (
      org_b, field_a1, 'closed',
      timestamptz '2026-08-01 12:00:00+00',
      timestamptz '2026-08-01 13:00:00+00',
      'Bad org'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '4_reservation_org_must_match_field',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '4_reservation_org_must_match_field',
      SQLERRM ILIKE '%must match fields.organization_id%',
      SQLERRM
    );
  END;

  -- Test 5: ends_at <= starts_at
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at
    ) VALUES (
      org_a, field_a1, 'manual_block',
      timestamptz '2026-08-01 14:00:00+00',
      timestamptz '2026-08-01 14:00:00+00'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '5_ends_at_must_be_after_starts_at',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '5_ends_at_must_be_after_starts_at',
      SQLERRM ILIKE '%field_reservations_time_range_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 6: invalid reservation_type
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at
    ) VALUES (
      org_a, field_a1, 'tournament',
      timestamptz '2026-08-01 14:00:00+00',
      timestamptz '2026-08-01 15:00:00+00'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '6_invalid_reservation_type_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '6_invalid_reservation_type_rejected',
      SQLERRM ILIKE '%field_reservations_reservation_type_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 7: direct overlap 18:00-19:30 vs 19:00-20:00
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'private_rental',
      timestamptz '2026-08-01 18:00:00+00',
      timestamptz '2026-08-01 19:30:00+00',
      'Renta 18-1930',
      'confirmed'
    );
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'manual_block',
      timestamptz '2026-08-01 19:00:00+00',
      timestamptz '2026-08-01 20:00:00+00',
      'Block 19-20',
      'confirmed'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '7_partial_overlap_same_field_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '7_partial_overlap_same_field_rejected',
      SQLERRM ILIKE '%no_overlapping_reservations%'
        OR SQLERRM ILIKE '%exclude%'
        OR SQLERRM ILIKE '%conflict%',
      SQLERRM
    );
  END;

  -- Test 8: cross-type overlap match vs maintenance
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'match',
      timestamptz '2026-08-02 18:00:00+00',
      timestamptz '2026-08-02 20:00:00+00',
      'Match slot',
      'confirmed'
    );
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'maintenance',
      timestamptz '2026-08-02 19:00:00+00',
      timestamptz '2026-08-02 19:30:00+00',
      'Maintenance during match',
      'confirmed'
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '8_cross_type_overlap_rejected',
      false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '8_cross_type_overlap_rejected',
      SQLERRM ILIKE '%no_overlapping_reservations%'
        OR SQLERRM ILIKE '%exclude%'
        OR SQLERRM ILIKE '%conflict%',
      SQLERRM
    );
  END;

  -- Test 9: consecutive non-overlapping 17:00-18:00 and 18:00-19:00
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'closed',
      timestamptz '2026-08-03 17:00:00+00',
      timestamptz '2026-08-03 18:00:00+00',
      'Slot A',
      'confirmed'
    ) RETURNING id INTO res_id;
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'closed',
      timestamptz '2026-08-03 18:00:00+00',
      timestamptz '2026-08-03 19:00:00+00',
      'Slot B',
      'confirmed'
    ) RETURNING id INTO res_id2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '9_consecutive_slots_allowed',
      res_id IS NOT NULL AND res_id2 IS NOT NULL,
      format('first=%s second=%s', res_id, res_id2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '9_consecutive_slots_allowed', false, SQLERRM
    );
  END;

  -- Test 10: same time, different fields
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'private_rental',
      timestamptz '2026-08-04 18:00:00+00',
      timestamptz '2026-08-04 19:00:00+00',
      'Field A1 evening',
      'confirmed'
    ) RETURNING id INTO res_id;
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a2, 'private_rental',
      timestamptz '2026-08-04 18:00:00+00',
      timestamptz '2026-08-04 19:00:00+00',
      'Field A2 evening',
      'confirmed'
    ) RETURNING id INTO res_id2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '10_same_time_different_fields_allowed',
      res_id IS NOT NULL AND res_id2 IS NOT NULL,
      format('field_a1=%s field_a2=%s', res_id, res_id2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '10_same_time_different_fields_allowed', false, SQLERRM
    );
  END;

  -- Test 11: cancelled does not block
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'manual_block',
      timestamptz '2026-08-05 18:00:00+00',
      timestamptz '2026-08-05 19:00:00+00',
      'Will cancel',
      'confirmed'
    ) RETURNING id INTO res_id;

    UPDATE public.field_reservations
    SET status = 'cancelled'
    WHERE id = res_id;

    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, title, status
    ) VALUES (
      org_a, field_a1, 'match',
      timestamptz '2026-08-05 18:00:00+00',
      timestamptz '2026-08-05 19:00:00+00',
      'Reuse cancelled slot',
      'confirmed'
    ) RETURNING id INTO res_id2;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '11_cancelled_does_not_block_new_confirmed',
      res_id IS NOT NULL AND res_id2 IS NOT NULL AND res_id IS DISTINCT FROM res_id2,
      format('cancelled=%s new_confirmed=%s', res_id, res_id2)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig005_test_results VALUES (
      '11_cancelled_does_not_block_new_confirmed', false, SQLERRM
    );
  END;

  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug IN ('org-a-mig005', 'org-b-mig005');

  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);
END $$;

SELECT test_name, passed, details
FROM public.__mig005_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig005_test_results;
