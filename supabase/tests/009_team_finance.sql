-- Tests for Migration 009 (team_charges, team_payments, season_team_financial_summary)
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/009_team_finance.sql

DROP TABLE IF EXISTS public.__mig009_test_results;
CREATE TABLE public.__mig009_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa91';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa92';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa93';
  uid_tourn_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa94';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb91';
  uid_admin_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb92';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  team_a1 uuid;
  team_a2 uuid;
  team_a_empty uuid;
  team_b1 uuid;
  team_b2 uuid;
  st_fin uuid;
  st_empty uuid;
  st_b uuid;
  charge_admin uuid;
  charge_owner uuid;
  charge_void uuid;
  charge_mxn uuid;
  payment_admin uuid;
  payment_void uuid;
  charge_after_void uuid;
  payment_after_void uuid;
  v_count int;
  v_charges numeric;
  v_payments numeric;
  v_balance numeric;
  v_currency text;
  v_amount numeric;
  v_charge_type text;
  v_voided_at timestamptz;
  v_void_reason text;
  v_fn_ok boolean;
BEGIN
  ALTER TABLE public.team_charges DISABLE TRIGGER team_charges_prevent_mutation;
  ALTER TABLE public.team_payments DISABLE TRIGGER team_payments_prevent_mutation;

  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_owner_b, uid_admin_b)
     OR slug IN ('org-a-mig009', 'org-b-mig009');

  ALTER TABLE public.team_charges ENABLE TRIGGER team_charges_prevent_mutation;
  ALTER TABLE public.team_payments ENABLE TRIGGER team_payments_prevent_mutation;

  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_admin_a, uid_member_a, uid_tourn_a, uid_owner_b, uid_admin_b
  );

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig009.local', '$2a$06$testhashligapromigration009aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig009.local', '$2a$06$testhashligapromigration009aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig009.local', '$2a$06$testhashligapromigration009aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tourn_a, 'authenticated', 'authenticated',
     'tourn-a@ligapro-mig009.local', '$2a$06$testhashligapromigration009aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig009.local', '$2a$06$testhashligapromigration009aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_b, 'authenticated', 'authenticated',
     'admin-b@ligapro-mig009.local', '$2a$06$testhashligapromigration009aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  -- Org A
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := (public.create_organization_with_owner('Org A Mig009', 'org-a-mig009')).id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tourn_a, 'organization_member');
  EXECUTE 'RESET ROLE';

  -- Org B
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := (public.create_organization_with_owner('Org B Mig009', 'org-b-mig009')).id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_b, uid_admin_b, 'organization_admin');
  EXECUTE 'RESET ROLE';

  -- Admin setup org A
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp A') RETURNING id INTO competition_a;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_a, org_a, 'Season A', 'season-a-mig009', 'round_robin')
  RETURNING id INTO season_a;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Fin Team') RETURNING id INTO team_a1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Other Team') RETURNING id INTO team_a2;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Empty Team') RETURNING id INTO team_a_empty;

  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_a1, org_a) RETURNING id INTO st_fin;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_a2, org_a);
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_a, team_a_empty, org_a) RETURNING id INTO st_empty;

  INSERT INTO public.season_roles (
    organization_id, season_id, profile_id, role
  ) VALUES (org_a, season_a, uid_tourn_a, 'tournament_admin');
  EXECUTE 'RESET ROLE';

  -- Admin setup org B + seed finance data for isolation tests
  PERFORM set_config('request.jwt.claim.sub', uid_admin_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_b::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B') RETURNING id INTO competition_b;
  INSERT INTO public.seasons (
    competition_id, organization_id, name, slug, format_type
  ) VALUES (competition_b, org_b, 'Season B', 'season-b-mig009', 'round_robin')
  RETURNING id INTO season_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B Team') RETURNING id INTO team_b1;
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'B Team 2') RETURNING id INTO team_b2;
  INSERT INTO public.season_teams (season_id, team_id, organization_id)
  VALUES (season_b, team_b1, org_b) RETURNING id INTO st_b;

  INSERT INTO public.team_charges (
    organization_id, season_team_id, charge_type, amount, created_by_profile_id
  ) VALUES (org_b, st_b, 'registration', 999.99, uid_admin_b);
  INSERT INTO public.team_payments (
    organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
  ) VALUES (org_b, st_b, 100.00, 'cash', uid_admin_b);
  EXECUTE 'RESET ROLE';

  -- Test 1: org A cannot read org B charges
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.team_charges WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '1_org_a_cannot_read_org_b_charges',
    v_count = 0,
    format('visible_charges=%s', v_count)
  );

  -- Test 2: org A cannot read org B payments
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.team_payments WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '2_org_a_cannot_read_org_b_payments',
    v_count = 0,
    format('visible_payments=%s', v_count)
  );

  -- Test 3: common member cannot read own org finances
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.team_charges WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '3_member_cannot_read_own_org_charges',
    v_count = 0,
    format('member_visible_charges=%s expected=0', v_count)
  );

  -- Test 4: tournament_admin cannot read finances
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.team_payments WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '4_tournament_admin_cannot_read_payments',
    v_count = 0,
    format('tournament_admin_visible_payments=%s expected=0', v_count)
  );

  -- Test 5: admin creates valid charge
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_charges (
    organization_id, season_team_id, charge_type, description, amount,
    due_date, created_by_profile_id
  ) VALUES (
    org_a, st_fin, 'registration', 'Inscripción', 1000.00,
    current_date + 7, uid_admin_a
  ) RETURNING id INTO charge_admin;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '5_admin_creates_valid_charge',
    charge_admin IS NOT NULL,
    format('charge_id=%s', charge_admin)
  );

  -- Test 6: owner creates valid charge
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_charges (
    organization_id, season_team_id, charge_type, amount, created_by_profile_id
  ) VALUES (org_a, st_fin, 'referee_fee', 500.00, uid_owner_a)
  RETURNING id INTO charge_owner;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '6_owner_creates_valid_charge',
    charge_owner IS NOT NULL,
    format('charge_id=%s', charge_owner)
  );

  -- Test 7: organization_id mismatch fails
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_b, st_fin, 'fine', 50.00, uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '7_org_id_mismatch_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '7_org_id_mismatch_fails',
      SQLERRM ILIKE '%must match season_teams.organization_id%'
        OR SQLERRM ILIKE '%must be a member of organization%'
        OR SQLERRM ILIKE '%row-level security%'
        OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 8: amount = 0 fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_a, st_fin, 'other', 0, uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '8_zero_amount_charge_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '8_zero_amount_charge_fails',
      SQLERRM ILIKE '%team_charges_amount_positive_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 9: negative amount fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_a, st_fin, 'other', -10.00, uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '9_negative_amount_charge_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '9_negative_amount_charge_fails',
      SQLERRM ILIKE '%team_charges_amount_positive_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 10: invalid charge_type fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_a, st_fin, 'invalid_type', 10.00, uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '10_invalid_charge_type_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '10_invalid_charge_type_fails',
      SQLERRM ILIKE '%team_charges_charge_type_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 11: USD (and any non-MXN) currency fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, currency, created_by_profile_id
    ) VALUES (org_a, st_fin, 'other', 10.00, 'USD', uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '11_usd_currency_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '11_usd_currency_fails',
      SQLERRM ILIKE '%team_charges_currency_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 11b: explicit MXN succeeds
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, currency, created_by_profile_id
    ) VALUES (org_a, st_fin, 'other', 10.00, 'MXN', uid_admin_a)
    RETURNING id, currency INTO charge_mxn, v_currency;
    PERFORM public.void_team_charge(charge_mxn, 'Helper MXN currency test');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '11b_mxn_currency_accepted',
      charge_mxn IS NOT NULL AND v_currency = 'MXN',
      format('charge_id=%s currency=%s', charge_mxn, v_currency)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '11b_mxn_currency_accepted', false, SQLERRM
    );
  END;

  -- Test 11c: omitted currency defaults to MXN
  SELECT currency INTO v_currency
  FROM public.team_charges
  WHERE id = charge_admin;
  INSERT INTO public.__mig009_test_results VALUES (
    '11c_default_currency_is_mxn',
    v_currency = 'MXN',
    format('charge_admin_currency=%s expected=MXN', v_currency)
  );

  -- Test 12: admin valid payment
  INSERT INTO public.team_payments (
    organization_id, season_team_id, amount, payment_method,
    reference, notes, recorded_by_profile_id
  ) VALUES (
    org_a, st_fin, 300.00, 'transfer', 'REF-001', 'Anticipo', uid_admin_a
  ) RETURNING id INTO payment_admin;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '12_admin_creates_valid_payment',
    payment_admin IS NOT NULL,
    format('payment_id=%s', payment_admin)
  );

  -- Test 13: invalid payment_method fails
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_payments (
      organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
    ) VALUES (org_a, st_fin, 50.00, 'bitcoin', uid_admin_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '13_invalid_payment_method_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '13_invalid_payment_method_fails',
      SQLERRM ILIKE '%team_payments_payment_method_check%'
        OR SQLERRM ILIKE '%check constraint%',
      SQLERRM
    );
  END;

  -- Test 14: recorded_by_profile_id != auth.uid() fails
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_payments (
      organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
    ) VALUES (org_a, st_fin, 50.00, 'cash', uid_owner_a);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '14_wrong_recorded_by_profile_fails', false, 'unexpected insert success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '14_wrong_recorded_by_profile_fails',
      SQLERRM ILIKE '%must match auth.uid()%'
        OR SQLERRM ILIKE '%row-level security%'
        OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 15: member cannot insert charge
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_charges (
      organization_id, season_team_id, charge_type, amount, created_by_profile_id
    ) VALUES (org_a, st_fin, 'fine', 25.00, uid_member_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '15_member_cannot_insert_charge', false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '15_member_cannot_insert_charge',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 16: member cannot insert payment
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.team_payments (
      organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
    ) VALUES (org_a, st_fin, 25.00, 'cash', uid_member_a);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '16_member_cannot_insert_payment', false,
      format('unexpected success inserted_rows=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '16_member_cannot_insert_payment',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Test 17: balance view calculates correctly (1000 + 500 charges, 300 payments => 1200)
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT total_active_charges, total_active_payments, balance_due, currency
  INTO v_charges, v_payments, v_balance, v_currency
  FROM public.season_team_financial_summary
  WHERE season_team_id = st_fin AND currency = 'MXN';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '17_balance_view_calculates_correctly',
    v_charges = 1500.00 AND v_payments = 300.00 AND v_balance = 1200.00 AND v_currency = 'MXN',
    format('charges=%s payments=%s balance=%s currency=%s', v_charges, v_payments, v_balance, v_currency)
  );

  -- Test 18: overpayment produces negative balance (saldo a favor)
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_payments (
    organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
  ) VALUES (org_a, st_fin, 2000.00, 'cash', uid_owner_a);
  SELECT balance_due INTO v_balance
  FROM public.season_team_financial_summary
  WHERE season_team_id = st_fin AND currency = 'MXN';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '18_overpayment_negative_balance_allowed',
    v_balance = -800.00,
    format('balance_due=%s expected=-800.00', v_balance)
  );

  -- Test 19: voided charge excluded from balance
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_charges (
    organization_id, season_team_id, charge_type, amount, created_by_profile_id
  ) VALUES (org_a, st_fin, 'fine', 200.00, uid_admin_a)
  RETURNING id INTO charge_void;
  PERFORM public.void_team_charge(charge_void, 'Cargo duplicado');
  SELECT total_active_charges, balance_due INTO v_charges, v_balance
  FROM public.season_team_financial_summary
  WHERE season_team_id = st_fin AND currency = 'MXN';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '19_voided_charge_excluded_from_balance',
    v_charges = 1500.00 AND v_balance = -800.00,
    format('active_charges=%s balance=%s (voided 200 should not count)', v_charges, v_balance)
  );

  -- Test 20: voided payment excluded from balance
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_payments (
    organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
  ) VALUES (org_a, st_fin, 100.00, 'cash', uid_admin_a)
  RETURNING id INTO payment_void;
  PERFORM public.void_team_payment(payment_void, 'Pago registrado por error');
  SELECT total_active_payments, balance_due INTO v_payments, v_balance
  FROM public.season_team_financial_summary
  WHERE season_team_id = st_fin AND currency = 'MXN';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '20_voided_payment_excluded_from_balance',
    v_payments = 2300.00 AND v_balance = -800.00,
    format('active_payments=%s balance=%s (voided 100 should not count)', v_payments, v_balance)
  );

  -- Test 21: cannot void without reason
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_team_charge(charge_admin, '   ');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '21_void_without_reason_fails', false, 'unexpected void success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '21_void_without_reason_fails',
      SQLERRM ILIKE '%void reason is required%',
      SQLERRM
    );
  END;

  -- Test 22: cannot void twice
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.void_team_charge(charge_admin, 'Primera anulación válida');
  BEGIN
    PERFORM public.void_team_charge(charge_admin, 'Segunda anulación');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '22_cannot_void_twice', false, 'unexpected second void success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '22_cannot_void_twice',
      SQLERRM ILIKE '%already voided%',
      SQLERRM
    );
  END;

  -- Test 23: member cannot void charge
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_team_charge(charge_owner, 'Intento miembro');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '23_member_cannot_void_charge', false, 'unexpected void success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '23_member_cannot_void_charge',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- Test 24: tournament_admin cannot void payment
  PERFORM set_config('request.jwt.claim.sub', uid_tourn_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tourn_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.void_team_payment(payment_admin, 'Intento tournament_admin');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '24_tournament_admin_cannot_void_payment', false, 'unexpected void success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '24_tournament_admin_cannot_void_payment',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- Test 25: anon cannot execute void RPCs
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.void_team_charge(charge_admin, 'anon attempt');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '25_anon_cannot_execute_void_rpcs', false, 'unexpected RPC success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '25_anon_cannot_execute_void_rpcs',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%must be owner%',
      SQLERRM
    );
  END;

  -- Test 26: no direct UPDATE of amount
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    UPDATE public.team_charges SET amount = 1.00 WHERE id = charge_owner;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    SELECT amount INTO v_amount FROM public.team_charges WHERE id = charge_owner;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '26_no_direct_update_amount',
      (v_count = 0 AND v_amount = 500.00),
      format('updated_rows=%s amount=%s expected=500.00', v_count, v_amount)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '26_no_direct_update_amount',
      SQLERRM ILIKE '%immutable%' OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Test 27: no direct DELETE charges
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.team_charges WHERE id = charge_owner;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '27_no_direct_delete_charges',
      v_count = 0,
      format('deleted_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '27_no_direct_delete_charges',
      SQLERRM ILIKE '%immutable%' OR SQLERRM ILIKE '%cannot be deleted%'
        OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Test 28: no direct DELETE payments
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    DELETE FROM public.team_payments WHERE id = payment_admin;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '28_no_direct_delete_payments',
      v_count = 0,
      format('deleted_rows=%s expected=0', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '28_no_direct_delete_payments',
      SQLERRM ILIKE '%immutable%' OR SQLERRM ILIKE '%cannot be deleted%'
        OR SQLERRM ILIKE '%row-level security%',
      SQLERRM
    );
  END;

  -- Test 29: season_team without movements shows zero balance
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT total_active_charges, total_active_payments, balance_due, currency
  INTO v_charges, v_payments, v_balance, v_currency
  FROM public.season_team_financial_summary
  WHERE season_team_id = st_empty AND currency = 'MXN';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '29_empty_season_team_zero_balance',
    v_charges = 0 AND v_payments = 0 AND v_balance = 0 AND v_currency = 'MXN',
    format('charges=%s payments=%s balance=%s', v_charges, v_payments, v_balance)
  );

  -- Test 30: other org records do not contaminate summary
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count
  FROM public.season_team_financial_summary
  WHERE organization_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '30_other_org_not_in_summary_for_org_a_admin',
    v_count = 0,
    format('org_b_rows_visible_to_org_a_admin=%s expected=0', v_count)
  );

  -- Test 31: PUBLIC no EXECUTE on void RPCs
  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('void_team_charge', 'void_team_payment')
      AND has_function_privilege('public', p.oid, 'EXECUTE')
  ) INTO v_fn_ok;

  INSERT INTO public.__mig009_test_results VALUES (
    '31_public_no_execute_on_void_rpcs',
    v_fn_ok,
    format('public_has_execute=%s', NOT v_fn_ok)
  );

  -- Test 32: anon no SELECT on tables nor view
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO v_count FROM public.team_charges;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '32_anon_no_select_finance', false,
      format('unexpected anon select team_charges count=%s', v_count)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig009_test_results VALUES (
      '32_anon_no_select_finance',
      SQLERRM ILIKE '%permission denied%',
      SQLERRM
    );
  END;

  -- Test 33: voided record preserves original amount and data
  SELECT amount, charge_type, voided_at, void_reason
  INTO v_amount, v_charge_type, v_voided_at, v_void_reason
  FROM public.team_charges
  WHERE id = charge_void;
  INSERT INTO public.__mig009_test_results VALUES (
    '33_voided_record_preserves_original_data',
    v_amount = 200.00 AND v_charge_type = 'fine'
      AND v_voided_at IS NOT NULL AND btrim(v_void_reason) <> '',
    format('amount=%s type=%s voided_at=%s reason=%s', v_amount, v_charge_type, v_voided_at, v_void_reason)
  );

  -- Test 34: owner/admin can insert after voiding previous records
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_charges (
    organization_id, season_team_id, charge_type, amount, created_by_profile_id
  ) VALUES (org_a, st_fin, 'other', 75.00, uid_owner_a)
  RETURNING id INTO charge_after_void;
  INSERT INTO public.team_payments (
    organization_id, season_team_id, amount, payment_method, recorded_by_profile_id
  ) VALUES (org_a, st_fin, 75.00, 'card', uid_owner_a)
  RETURNING id INTO payment_after_void;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig009_test_results VALUES (
    '34_insert_after_void_still_allowed',
    charge_after_void IS NOT NULL AND payment_after_void IS NOT NULL,
    format('charge_id=%s payment_id=%s', charge_after_void, payment_after_void)
  );

  -- Test 35: FK ON DELETE RESTRICT prevents deleting season_team with finance history
  BEGIN
    DELETE FROM public.season_teams WHERE id = st_fin;
    INSERT INTO public.__mig009_test_results VALUES (
      '35_season_team_delete_restrict_with_finance', false, 'unexpected delete success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig009_test_results VALUES (
      '35_season_team_delete_restrict_with_finance',
      SQLERRM ILIKE '%violates foreign key constraint%'
        OR SQLERRM ILIKE '%restrict%',
      SQLERRM
    );
  END;
END;
$$;

SELECT test_name, passed, details
FROM public.__mig009_test_results
ORDER BY test_name;
