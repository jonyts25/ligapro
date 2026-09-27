-- Migration 039: field modality / parent-child split tests
--
-- PREREQUISITE: apply the MIGRATION first (not this file):
--   supabase/migrations/20260928200000_field_modality_split.sql
--
-- Run tests:
--   npx supabase db query --linked -f supabase/tests/039_field_modality_split.sql

DROP TABLE IF EXISTS public.__mig039_test_results;
CREATE TABLE public.__mig039_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig039_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig039_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0390';
  org_id uuid;
  parent_id uuid;
  child_a uuid;
  child_b uuid;
  other_org uuid;
  other_field uuid;
  reservation_parent uuid;
  reservation_child uuid;
  v_count integer;
  v_err text;
BEGIN
  DELETE FROM public.organizations WHERE name = 'Org Mig039 Field Split';
  DELETE FROM auth.users WHERE id = uid_owner;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
    'owner@ligapro-mig039.local', '$2a$06$testhashligapromigration039aa', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (uid_owner, 'owner@ligapro-mig039.local', 'Owner 039')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig039_as(uid_owner);
  org_id := public.create_organization_with_owner('Org Mig039 Field Split');

  INSERT INTO public.fields (organization_id, name, is_active, modality)
  VALUES (org_id, 'Cancha Principal', true, 'futbol_11')
  RETURNING id INTO parent_id;

  SELECT COUNT(*) INTO v_count
  FROM public.split_field_into_children(
    parent_id,
    ARRAY['Mitad Norte', 'Mitad Sur']::text[]
  );

  INSERT INTO public.__mig039_test_results VALUES (
    '01_split_creates_two_children',
    v_count = 2,
    'children=' || v_count
  );

  SELECT id INTO child_a
  FROM public.fields
  WHERE parent_field_id = parent_id
  ORDER BY name
  LIMIT 1;

  SELECT id INTO child_b
  FROM public.fields
  WHERE parent_field_id = parent_id
    AND id <> child_a
  LIMIT 1;

  ALTER TABLE public.field_reservations DISABLE TRIGGER USER;

  INSERT INTO public.field_reservations (
    organization_id, field_id, reservation_type, starts_at, ends_at, status
  ) VALUES (
    org_id, parent_id, 'manual_block',
    timestamptz '2026-10-01 18:00:00+00',
    timestamptz '2026-10-01 19:00:00+00',
    'confirmed'
  ) RETURNING id INTO reservation_parent;

  BEGIN
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, status
    ) VALUES (
      org_id, child_a, 'manual_block',
      timestamptz '2026-10-01 18:30:00+00',
      timestamptz '2026-10-01 19:30:00+00',
      'confirmed'
    );
    INSERT INTO public.__mig039_test_results VALUES (
      '02_child_blocked_by_parent', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '02_child_blocked_by_parent',
      v_err ILIKE '%cancha completa%',
      v_err
    );
  END;

  DELETE FROM public.field_reservations WHERE id = reservation_parent;

  INSERT INTO public.field_reservations (
    organization_id, field_id, reservation_type, starts_at, ends_at, status
  ) VALUES (
    org_id, child_a, 'manual_block',
    timestamptz '2026-10-02 18:00:00+00',
    timestamptz '2026-10-02 19:00:00+00',
    'confirmed'
  ) RETURNING id INTO reservation_child;

  BEGIN
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, status
    ) VALUES (
      org_id, parent_id, 'manual_block',
      timestamptz '2026-10-02 18:30:00+00',
      timestamptz '2026-10-02 19:30:00+00',
      'confirmed'
    );
    INSERT INTO public.__mig039_test_results VALUES (
      '03_parent_blocked_by_child', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '03_parent_blocked_by_child',
      v_err ILIKE '%mitad%',
      v_err
    );
  END;

  BEGIN
    INSERT INTO public.field_reservations (
      organization_id, field_id, reservation_type, starts_at, ends_at, status
    ) VALUES (
      org_id, child_b, 'manual_block',
      timestamptz '2026-10-02 18:15:00+00',
      timestamptz '2026-10-02 19:15:00+00',
      'confirmed'
    );
    INSERT INTO public.__mig039_test_results VALUES (
      '04_sibling_children_can_overlap',
      true,
      'child_b booked while child_a occupied'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '04_sibling_children_can_overlap', false, v_err
    );
  END;

  ALTER TABLE public.field_reservations ENABLE TRIGGER USER;

  BEGIN
    PERFORM public.split_field_into_children(
      parent_id,
      ARRAY['X', 'Y']::text[]
    );
    INSERT INTO public.__mig039_test_results VALUES (
      '05_split_rejects_existing_children', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '05_split_rejects_existing_children',
      v_err ILIKE '%already divided%',
      v_err
    );
  END;

  BEGIN
    PERFORM public.split_field_into_children(
      child_a,
      ARRAY['Nested A', 'Nested B']::text[]
    );
    INSERT INTO public.__mig039_test_results VALUES (
      '06_split_rejects_child_field', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '06_split_rejects_child_field',
      v_err ILIKE '%already a child%',
      v_err
    );
  END;

  BEGIN
    UPDATE public.fields
    SET parent_field_id = child_b
    WHERE id = child_a;
    INSERT INTO public.__mig039_test_results VALUES (
      '07_child_cannot_become_parent', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '07_child_cannot_become_parent',
      v_err ILIKE '%children cannot be assigned a parent%'
        OR v_err ILIKE '%with children cannot be assigned a parent%',
      v_err
    );
  END;

  PERFORM public.__mig039_as(uid_owner);
  other_org := public.create_organization_with_owner('Org Mig039 Other');

  INSERT INTO public.fields (organization_id, name, is_active)
  VALUES (other_org, 'Otra cancha', true)
  RETURNING id INTO other_field;

  BEGIN
    UPDATE public.fields
    SET parent_field_id = other_field
    WHERE id = parent_id;
    INSERT INTO public.__mig039_test_results VALUES (
      '08_parent_must_same_org', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig039_test_results VALUES (
      '08_parent_must_same_org',
      v_err ILIKE '%same organization%',
      v_err
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig039_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM public.__mig039_test_results;
