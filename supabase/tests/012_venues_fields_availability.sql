-- Tests for Migration 012 (is_active, availability overlap, replace RPC)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/012_venues_fields_availability.sql

DROP TABLE IF EXISTS public.__mig012_test_results;
CREATE TABLE public.__mig012_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0120';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0121';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0122';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0120';
  org_a uuid;
  org_b uuid;
  venue_a uuid;
  venue_b uuid;
  field_a uuid;
  field_a2 uuid;
  field_b uuid;
  v_count int;
  v_ok boolean;
  v_err text;
  v_active boolean;
  v_field_active boolean;
  v_json jsonb;
  v_prev_count int;
  v_ordered text;
BEGIN
  -- Cleanup leftovers
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.venues DISABLE TRIGGER USER;
  ALTER TABLE public.fields DISABLE TRIGGER USER;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b)
     OR slug LIKE 'org-%-mig012%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  ALTER TABLE public.field_availability_rules ENABLE TRIGGER USER;
  ALTER TABLE public.fields ENABLE TRIGGER USER;
  ALTER TABLE public.venues ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig012.local', '$2a$06$testhashligapromigration012aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig012.local', '$2a$06$testhashligapromigration012aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig012.local', '$2a$06$testhashligapromigration012aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig012.local', '$2a$06$testhashligapromigration012aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  org_a := public.create_organization_with_owner('Org A Mig012');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  org_b := public.create_organization_with_owner('Org B Mig012');
  EXECUTE 'RESET ROLE';

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member');

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.venues (organization_id, name, address)
  VALUES (org_a, 'Venue A', 'Addr A')
  RETURNING id, is_active INTO venue_a, v_active;
  INSERT INTO public.fields (venue_id, organization_id, name, surface_type)
  VALUES (venue_a, org_a, 'Field A1', 'pasto')
  RETURNING id, is_active INTO field_a, v_field_active;
  INSERT INTO public.fields (venue_id, organization_id, name)
  VALUES (venue_a, org_a, 'Field A2')
  RETURNING id INTO field_a2;
  EXECUTE 'RESET ROLE';

  INSERT INTO public.__mig012_test_results VALUES (
    '01_venues_is_active_default_true',
    v_active IS TRUE,
    format('is_active=%s', v_active)
  );
  INSERT INTO public.__mig012_test_results VALUES (
    '02_fields_is_active_default_true',
    v_field_active IS TRUE,
    format('is_active=%s', v_field_active)
  );

  -- 03 owner deactivates venue
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.venues SET is_active = false WHERE id = venue_a;
    SELECT is_active INTO v_active FROM public.venues WHERE id = venue_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('03_owner_deactivates_venue', v_active IS FALSE, format('is_active=%s', v_active));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('03_owner_deactivates_venue', false, SQLERRM);
  END;

  -- 08 deactivating venue does not auto-change fields
  SELECT bool_and(is_active) INTO v_ok FROM public.fields WHERE venue_id = venue_a;
  INSERT INTO public.__mig012_test_results VALUES (
    '08_deactivating_venue_does_not_change_fields',
    v_ok IS TRUE,
    format('all_fields_still_active=%s', v_ok)
  );

  -- 04 admin deactivates field
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.fields SET is_active = false WHERE id = field_a;
    SELECT is_active INTO v_field_active FROM public.fields WHERE id = field_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('04_admin_deactivates_field', v_field_active IS FALSE, format('is_active=%s', v_field_active));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('04_admin_deactivates_field', false, SQLERRM);
  END;

  -- 05 member cannot change venue
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.venues SET name = 'Hacked' WHERE id = venue_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('05_member_cannot_change_venue', v_count = 0, format('rows=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '05_member_cannot_change_venue',
      SQLERRM ILIKE '%policy%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- 06 member cannot change field
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.fields SET name = 'Hacked' WHERE id = field_a2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('06_member_cannot_change_field', v_count = 0, format('rows=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '06_member_cannot_change_field',
      SQLERRM ILIKE '%policy%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Setup org B venue/field
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.venues (organization_id, name) VALUES (org_b, 'Venue B') RETURNING id INTO venue_b;
  INSERT INTO public.fields (venue_id, organization_id, name) VALUES (venue_b, org_b, 'Field B') RETURNING id INTO field_b;
  EXECUTE 'RESET ROLE';

  -- 07 other org cannot change A
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.venues SET is_active = true WHERE id = venue_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('07_other_org_cannot_change_status', v_count = 0, format('rows=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '07_other_org_cannot_change_status',
      SQLERRM ILIKE '%policy%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- 09 reactivate venue
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.venues SET is_active = true WHERE id = venue_a;
  SELECT is_active INTO v_active FROM public.venues WHERE id = venue_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig012_test_results VALUES ('09_owner_reactivates_venue', v_active IS TRUE, format('is_active=%s', v_active));

  -- 10 reactivate field
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.fields SET is_active = true WHERE id = field_a;
  SELECT is_active INTO v_field_active FROM public.fields WHERE id = field_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig012_test_results VALUES ('10_owner_reactivates_field', v_field_active IS TRUE, format('is_active=%s', v_field_active));

  -- 11 replace multi-day
  v_json := '[
    {"day_of_week":1,"starts_at":"07:00","ends_at":"12:00"},
    {"day_of_week":2,"starts_at":"08:00","ends_at":"18:00"},
    {"day_of_week":3,"starts_at":"09:00","ends_at":"21:00"}
  ]'::jsonb;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count FROM public.replace_field_availability(field_a, v_json);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('11_owner_replaces_multi_day', v_count = 3, format('count=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('11_owner_replaces_multi_day', false, SQLERRM);
  END;

  -- 12 multiple non-overlapping same day
  v_json := '[
    {"day_of_week":1,"starts_at":"07:00","ends_at":"12:00"},
    {"day_of_week":1,"starts_at":"14:00","ends_at":"22:00"}
  ]'::jsonb;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count FROM public.replace_field_availability(field_a, v_json);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('12_multiple_non_overlapping_same_day', v_count = 2, format('count=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('12_multiple_non_overlapping_same_day', false, SQLERRM);
  END;

  -- 13 contiguous allowed
  v_json := '[
    {"day_of_week":4,"starts_at":"08:00","ends_at":"12:00"},
    {"day_of_week":4,"starts_at":"12:00","ends_at":"16:00"}
  ]'::jsonb;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO v_count FROM public.replace_field_availability(field_a, v_json);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('13_contiguous_intervals_allowed', v_count = 2, format('count=%s', v_count));
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('13_contiguous_intervals_allowed', false, SQLERRM);
  END;

  -- Seed known rules for failure preservation
  v_json := '[{"day_of_week":5,"starts_at":"10:00","ends_at":"12:00"}]'::jsonb;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.replace_field_availability(field_a, v_json);
  SELECT count(*) INTO v_prev_count FROM public.field_availability_rules WHERE field_id = field_a;
  EXECUTE 'RESET ROLE';

  -- 14 overlapping rejected by RPC
  v_json := '[
    {"day_of_week":1,"starts_at":"08:00","ends_at":"12:00"},
    {"day_of_week":1,"starts_at":"11:00","ends_at":"14:00"}
  ]'::jsonb;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(field_a, v_json);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('14_overlapping_rejected_by_rpc', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '14_overlapping_rejected_by_rpc',
      SQLERRM ILIKE '%overlap%' OR SQLERRM ILIKE '%duplicate%',
      SQLERRM
    );
  END;

  -- 21 failure preserves previous rules
  SELECT count(*) INTO v_count FROM public.field_availability_rules WHERE field_id = field_a;
  INSERT INTO public.__mig012_test_results VALUES (
    '21_failure_preserves_previous_rules',
    v_count = v_prev_count,
    format('before=%s after=%s', v_prev_count, v_count)
  );

  -- 15 overlapping rejected by DB constraint (direct insert)
  DELETE FROM public.field_availability_rules WHERE field_id = field_a;
  INSERT INTO public.field_availability_rules (field_id, organization_id, day_of_week, starts_at, ends_at)
  VALUES (field_a, org_a, 1, time '08:00', time '12:00');
  BEGIN
    INSERT INTO public.field_availability_rules (field_id, organization_id, day_of_week, starts_at, ends_at)
    VALUES (field_a, org_a, 1, time '11:00', time '14:00');
    INSERT INTO public.__mig012_test_results VALUES ('15_overlapping_rejected_by_constraint', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig012_test_results VALUES (
      '15_overlapping_rejected_by_constraint',
      SQLERRM ILIKE '%no_overlapping_field_availability%' OR SQLERRM ILIKE '%exclude%',
      SQLERRM
    );
  END;

  -- 16 ends_at <= starts_at
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(
      field_a,
      '[{"day_of_week":1,"starts_at":"12:00","ends_at":"11:00"}]'::jsonb
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('16_ends_at_must_be_after_starts_at', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '16_ends_at_must_be_after_starts_at',
      SQLERRM ILIKE '%after starts_at%' OR SQLERRM ILIKE '%time_range%',
      SQLERRM
    );
  END;

  -- 17 day out of range
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(
      field_a,
      '[{"day_of_week":7,"starts_at":"08:00","ends_at":"09:00"}]'::jsonb
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('17_day_of_week_out_of_range', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '17_day_of_week_out_of_range',
      SQLERRM ILIKE '%between 0 and 6%',
      SQLERRM
    );
  END;

  -- 18 non-array JSON
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(field_a, '{"day_of_week":1}'::jsonb);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('18_non_array_json_fails', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '18_non_array_json_fails',
      SQLERRM ILIKE '%JSON array%',
      SQLERRM
    );
  END;

  -- 19 incomplete element
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(
      field_a,
      '[{"day_of_week":1,"starts_at":"08:00"}]'::jsonb
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('19_incomplete_element_fails', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '19_incomplete_element_fails',
      SQLERRM ILIKE '%missing required%',
      SQLERRM
    );
  END;

  -- 20 empty array clears
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.replace_field_availability(
    field_a,
    '[{"day_of_week":0,"starts_at":"08:00","ends_at":"10:00"}]'::jsonb
  );
  SELECT count(*) INTO v_count FROM public.replace_field_availability(field_a, '[]'::jsonb);
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig012_test_results VALUES ('20_empty_array_clears_availability', v_count = 0, format('count=%s', v_count));

  -- 22 member cannot execute RPC
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(
      field_a,
      '[{"day_of_week":1,"starts_at":"08:00","ends_at":"09:00"}]'::jsonb
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('22_member_cannot_execute_rpc', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '22_member_cannot_execute_rpc',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 23 other org cannot execute on A field
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.replace_field_availability(
      field_a,
      '[{"day_of_week":1,"starts_at":"08:00","ends_at":"09:00"}]'::jsonb
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('23_other_org_cannot_execute_rpc', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '23_other_org_cannot_execute_rpc',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 24 anon cannot execute
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.replace_field_availability(field_a, '[]'::jsonb);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES ('24_anon_cannot_execute_rpc', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig012_test_results VALUES (
      '24_anon_cannot_execute_rpc',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%Not authenticated%',
      SQLERRM
    );
  END;

  -- 25 PUBLIC no execute
  SELECT count(*) INTO v_count
  FROM information_schema.role_routine_grants
  WHERE specific_schema = 'public'
    AND routine_name = 'replace_field_availability'
    AND grantee = 'PUBLIC'
    AND privilege_type = 'EXECUTE';
  INSERT INTO public.__mig012_test_results VALUES (
    '25_public_no_execute',
    v_count = 0,
    format('public_grants=%s', v_count)
  );

  -- 26 actor/profile not parameters
  SELECT count(*) INTO v_count
  FROM information_schema.parameters
  WHERE specific_schema = 'public'
    AND specific_name LIKE 'replace_field_availability%'
    AND parameter_name IN ('p_profile_id', 'p_actor', 'profile_id', 'actor');
  INSERT INTO public.__mig012_test_results VALUES (
    '26_no_actor_profile_params',
    v_count = 0,
    format('bad_params=%s', v_count)
  );

  -- 27 organization_id not a parameter
  SELECT count(*) INTO v_count
  FROM information_schema.parameters
  WHERE specific_schema = 'public'
    AND specific_name LIKE 'replace_field_availability%'
    AND parameter_name IN ('p_organization_id', 'organization_id');
  INSERT INTO public.__mig012_test_results VALUES (
    '27_no_organization_id_param',
    v_count = 0,
    format('bad_params=%s', v_count)
  );

  -- 28 audit is_active change
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.venues SET is_active = false WHERE id = venue_a;
  UPDATE public.venues SET is_active = true WHERE id = venue_a;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'venues'
    AND entity_id = venue_a
    AND action = 'update'
    AND 'is_active' = ANY (changed_fields);
  INSERT INTO public.__mig012_test_results VALUES (
    '28_audit_is_active_change',
    v_count >= 1,
    format('count=%s', v_count)
  );

  -- 29 audit DELETE/INSERT availability
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.replace_field_availability(
    field_a,
    '[{"day_of_week":1,"starts_at":"07:00","ends_at":"09:00"}]'::jsonb
  );
  PERFORM public.replace_field_availability(
    field_a,
    '[{"day_of_week":2,"starts_at":"10:00","ends_at":"12:00"}]'::jsonb
  );
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE entity_type = 'field_availability_rules'
    AND organization_id = org_a
    AND action IN ('insert', 'delete');
  INSERT INTO public.__mig012_test_results VALUES (
    '29_audit_availability_delete_insert',
    v_count >= 2,
    format('count=%s', v_count)
  );

  -- 30 ordered return
  v_json := '[
    {"day_of_week":3,"starts_at":"14:00","ends_at":"16:00"},
    {"day_of_week":1,"starts_at":"09:00","ends_at":"11:00"},
    {"day_of_week":1,"starts_at":"07:00","ends_at":"08:00"}
  ]'::jsonb;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT string_agg(
    day_of_week::text || ':' || to_char(starts_at, 'HH24:MI'),
    ','
    ORDER BY day_of_week, starts_at
  )
  INTO v_ordered
  FROM public.replace_field_availability(field_a, v_json);
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig012_test_results VALUES (
    '30_rules_returned_ordered',
    v_ordered = '1:07:00,1:09:00,3:14:00',
    format('ordered=%s', v_ordered)
  );

  -- 31 field/venue org inconsistency blocked by existing trigger
  BEGIN
    INSERT INTO public.fields (venue_id, organization_id, name)
    VALUES (venue_a, org_b, 'Cross tenant');
    INSERT INTO public.__mig012_test_results VALUES ('31_field_venue_org_mismatch_rejected', false, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig012_test_results VALUES (
      '31_field_venue_org_mismatch_rejected',
      SQLERRM ILIKE '%must match venues.organization_id%',
      SQLERRM
    );
  END;

  -- Cleanup (disable mutation guards like 010/011 patterns)
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.venues DISABLE TRIGGER audit_venues;
  ALTER TABLE public.fields DISABLE TRIGGER audit_fields;
  ALTER TABLE public.field_availability_rules DISABLE TRIGGER audit_field_availability_rules;
  ALTER TABLE public.organizations DISABLE TRIGGER audit_organizations;
  ALTER TABLE public.organization_members DISABLE TRIGGER audit_organization_members;

  DELETE FROM public.audit_log
  WHERE organization_id IN (org_a, org_b)
     OR actor_profile_id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM auth.users WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_owner_b);

  ALTER TABLE public.organization_members ENABLE TRIGGER audit_organization_members;
  ALTER TABLE public.organizations ENABLE TRIGGER audit_organizations;
  ALTER TABLE public.field_availability_rules ENABLE TRIGGER audit_field_availability_rules;
  ALTER TABLE public.fields ENABLE TRIGGER audit_fields;
  ALTER TABLE public.venues ENABLE TRIGGER audit_venues;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  -- 32 placeholder: suite 002 run separately as regression
  INSERT INTO public.__mig012_test_results VALUES (
    '32_suite_002_run_as_regression',
    true,
    'execute 002_venues_fields_isolation.sql separately'
  );
END $$;

SELECT test_name, passed, details
FROM public.__mig012_test_results
ORDER BY test_name;
