-- Migration 037: tournament type presets tests
--
-- PREREQUISITE: apply the MIGRATION first (not this file):
--   supabase/migrations/20260928000000_tournament_type_presets.sql
--
-- Run tests:
--   npx supabase db query --linked -f supabase/tests/037_tournament_type_presets.sql

DROP TABLE IF EXISTS public.__mig037_test_results;
CREATE TABLE public.__mig037_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig037_test_results DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  uid_staff uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0370';
  uid_outsider uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0370';
  v_count integer;
  v_err text;
  v_modality text;
  v_duration integer;
  v_min_roster integer;
  v_max_roster integer;
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_staff, 'authenticated', 'authenticated',
     'staff@ligapro-mig037.local', '$2a$06$testhashligapromigration037aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_outsider, 'authenticated', 'authenticated',
     'outsider@ligapro-mig037.local', '$2a$06$testhashligapromigration037aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.platform_staff (profile_id) VALUES (uid_staff);

  -- 1. Outsider can read presets via RPC
  PERFORM set_config('request.jwt.claim.sub', uid_outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_outsider::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT COUNT(*) INTO v_count FROM public.get_tournament_type_presets();
  INSERT INTO public.__mig037_test_results VALUES (
    '01_outsider_can_read_rpc',
    v_count = 3,
    'count=' || v_count
  );

  -- 2. Outsider can read presets via direct SELECT (catalog reference)
  SELECT COUNT(*) INTO v_count FROM public.tournament_type_presets;
  INSERT INTO public.__mig037_test_results VALUES (
    '02_outsider_can_read_table',
    v_count = 3,
    'count=' || v_count
  );

  -- 3. Outsider cannot write via RPC
  BEGIN
    PERFORM public.set_tournament_type_preset(
      'futbol_7',
      'Hack',
      7,
      2,
      50,
      3,
      1,
      0,
      true,
      0,
      5,
      1,
      10,
      16
    );
    INSERT INTO public.__mig037_test_results VALUES (
      '03_outsider_set_rejected', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig037_test_results VALUES (
      '03_outsider_set_rejected',
      v_err ILIKE '%platform staff%',
      v_err
    );
  END;

  -- 4. Seed values for futbol_11
  SELECT modality, match_duration_minutes, min_roster_size, max_roster_size
  INTO v_modality, v_duration, v_min_roster, v_max_roster
  FROM public.tournament_type_presets
  WHERE modality = 'futbol_11';

  INSERT INTO public.__mig037_test_results VALUES (
    '04_seed_futbol_11',
    v_duration = 90 AND v_min_roster = 14 AND v_max_roster = 25,
    format('duration=%s min=%s max=%s', v_duration, v_min_roster, v_max_roster)
  );

  -- 5. Seed values for futbol_7
  SELECT match_duration_minutes, min_roster_size, max_roster_size
  INTO v_duration, v_min_roster, v_max_roster
  FROM public.tournament_type_presets
  WHERE modality = 'futbol_7';

  INSERT INTO public.__mig037_test_results VALUES (
    '05_seed_futbol_7',
    v_duration = 50 AND v_min_roster = 10 AND v_max_roster = 16,
    format('duration=%s min=%s max=%s', v_duration, v_min_roster, v_max_roster)
  );

  -- 6. Seed values for futbol_5_futsal
  SELECT match_duration_minutes, min_roster_size, max_roster_size
  INTO v_duration, v_min_roster, v_max_roster
  FROM public.tournament_type_presets
  WHERE modality = 'futbol_5_futsal';

  INSERT INTO public.__mig037_test_results VALUES (
    '06_seed_futbol_5_futsal',
    v_duration = 40 AND v_min_roster = 8 AND v_max_roster = 12,
    format('duration=%s min=%s max=%s', v_duration, v_min_roster, v_max_roster)
  );

  -- 7. Staff can upsert via RPC
  PERFORM set_config('request.jwt.claim.sub', uid_staff::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_staff::text, 'role', 'authenticated')::text,
    true
  );

  PERFORM public.set_tournament_type_preset(
    'futbol_7',
    'Fútbol 7 editado',
    7,
    2,
    55,
    3,
    1,
    0,
    true,
    0,
    5,
    1,
    10,
    16
  );

  SELECT match_duration_minutes, label
  INTO v_duration, v_modality
  FROM public.get_tournament_type_presets()
  WHERE modality = 'futbol_7';

  INSERT INTO public.__mig037_test_results VALUES (
    '07_staff_set_and_get',
    v_duration = 55 AND v_modality = 'Fútbol 7 editado',
    format('duration=%s label=%s', v_duration, v_modality)
  );
END;
$$;

SELECT
  test_name,
  passed,
  details
FROM public.__mig037_test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total
FROM public.__mig037_test_results;
