-- Migration 013 + Frontend F4: atomic season/rules RPCs
-- Complements suite 003. Does not weaken prior asserts.
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/013_competitions_seasons_frontend.sql

DROP TABLE IF EXISTS public.__mig013_test_results;
CREATE TABLE public.__mig013_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0130';
  uid_admin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0131';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0132';
  uid_tadmin_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0133';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0130';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_admin uuid;
  season_tmp uuid;
  v_count int;
  v_name text;
  v_points int;
  v_draw int;
  v_vis text;
  v_audit int;
  v_before_seasons int;
  v_before_rules int;
  v_ok boolean;
  v_create_args text;
  v_update_args text;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b)
  );
  DELETE FROM public.organizations
  WHERE created_by IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b)
     OR slug LIKE 'org-%-mig013f4%';
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b);

  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.season_rules ENABLE TRIGGER USER;
  ALTER TABLE public.seasons ENABLE TRIGGER USER;
  ALTER TABLE public.competitions ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig013.local', '$2a$06$testhashligapromigration013aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin_a, 'authenticated', 'authenticated',
     'admin-a@ligapro-mig013.local', '$2a$06$testhashligapromigration013aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig013.local', '$2a$06$testhashligapromigration013aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_tadmin_a, 'authenticated', 'authenticated',
     'tadmin-a@ligapro-mig013.local', '$2a$06$testhashligapromigration013aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig013.local', '$2a$06$testhashligapromigration013aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  org_a := public.create_organization_with_owner('Org A Mig013 F4');

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES
    (org_a, uid_admin_a, 'organization_admin'),
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_tadmin_a, 'organization_member');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Liga Dominical Libre')
  RETURNING id INTO competition_a;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  org_b := public.create_organization_with_owner('Org B Mig013 F4');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B')
  RETURNING id INTO competition_b;
  EXECUTE 'RESET ROLE';

  -- 08 / 09: signature hardening (no organization_id / profile_id params)
  SELECT pg_get_function_identity_arguments(
    'public.create_season_with_rules(uuid,text,text,text,text,date,date,integer,integer,integer,boolean,integer,integer,integer,integer)'::regprocedure
  ) INTO v_create_args;
  SELECT pg_get_function_identity_arguments(
    'public.update_season_with_rules(uuid,text,text,text,date,date,integer,integer,integer,boolean,integer,integer,integer,integer)'::regprocedure
  ) INTO v_update_args;

  INSERT INTO public.__mig013_test_results VALUES (
    '08_create_rpc_no_organization_id_param',
    v_create_args IS NOT NULL AND v_create_args NOT ILIKE '%organization_id%',
    format('args=%s', v_create_args)
  );
  INSERT INTO public.__mig013_test_results VALUES (
    '09_rpcs_no_profile_id_param',
    v_create_args NOT ILIKE '%profile_id%'
      AND v_update_args NOT ILIKE '%profile_id%'
      AND v_update_args NOT ILIKE '%organization_id%',
    format('create=%s update=%s', v_create_args, v_update_args)
  );

  -- 07: PUBLIC has no EXECUTE
  SELECT NOT has_function_privilege(
    'public',
    'public.create_season_with_rules(uuid,text,text,text,text,date,date,integer,integer,integer,boolean,integer,integer,integer,integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'public',
    'public.update_season_with_rules(uuid,text,text,text,date,date,integer,integer,integer,boolean,integer,integer,integer,integer)',
    'EXECUTE'
  )
  INTO v_ok;
  INSERT INTO public.__mig013_test_results VALUES (
    '07_public_no_execute',
    v_ok,
    format('ok=%s', v_ok)
  );

  -- 06: anon cannot execute create
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM public.create_season_with_rules(
      competition_a, 'Anon Season', 'anon-013', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '06_anon_cannot_execute_create', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '06_anon_cannot_execute_create',
      SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%not authenticated%',
      SQLERRM
    );
  END;

  -- 01: owner creates season + rules (non-default values)
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    season_a := public.create_season_with_rules(
      competition_a,
      'Apertura 2026',
      'apertura-2026-013',
      'round_robin',
      'draft',
      '2026-08-01'::date,
      '2026-12-15'::date,
      4, 2, 0, true, 80, 15, 4, 2
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '01_owner_creates_season_with_rules',
      season_a IS NOT NULL,
      format('season=%s', season_a)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '01_owner_creates_season_with_rules', false, SQLERRM
    );
  END;

  -- 10: exactly one season_rules
  SELECT count(*) INTO v_count FROM public.season_rules WHERE season_id = season_a;
  INSERT INTO public.__mig013_test_results VALUES (
    '10_exactly_one_season_rules',
    v_count = 1,
    format('rules_count=%s', v_count)
  );

  -- 11: rules match params (not defaults 3/1/0/90/5/1)
  SELECT points_win, points_draw, match_duration_minutes, yellow_card_limit, suspension_matches
  INTO v_points, v_draw, v_count, v_audit, v_before_rules
  FROM public.season_rules WHERE season_id = season_a;
  INSERT INTO public.__mig013_test_results VALUES (
    '11_rules_match_params_not_defaults',
    v_points = 4 AND v_draw = 2 AND v_count = 80 AND v_audit = 4 AND v_before_rules = 2,
    format('win=%s draw=%s duration=%s yellow=%s susp=%s', v_points, v_draw, v_count, v_audit, v_before_rules)
  );

  -- 02: admin creates
  PERFORM set_config('request.jwt.claim.sub', uid_admin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    season_admin := public.create_season_with_rules(
      competition_a,
      'Clausura 2027',
      'clausura-2027-013',
      'knockout',
      'private',
      NULL, NULL,
      3, 1, 0, false, 70, 0, 3, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '02_admin_creates_season_with_rules',
      season_admin IS NOT NULL,
      format('season=%s', season_admin)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '02_admin_creates_season_with_rules', false, SQLERRM
    );
  END;

  -- 03: member cannot create
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_with_rules(
      competition_a, 'Member Season', 'member-013', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '03_member_cannot_create', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '03_member_cannot_create',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 04: tournament_admin cannot create
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role)
  VALUES (org_a, season_a, uid_tadmin_a, 'tournament_admin');
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_tadmin_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_tadmin_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_with_rules(
      competition_a, 'Tadmin Season', 'tadmin-013', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '04_tournament_admin_cannot_create', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '04_tournament_admin_cannot_create',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 05: other org cannot create on foreign competition
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_with_rules(
      competition_a, 'Cross', 'cross-013', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '05_other_org_cannot_create', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '05_other_org_cannot_create',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 12: invalid rules after valid season insert → no leftover season
  PERFORM set_config('request.jwt.claim.sub', uid_owner_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT count(*) INTO v_before_seasons FROM public.seasons WHERE organization_id = org_a;
  SELECT count(*) INTO v_before_rules FROM public.season_rules WHERE organization_id = org_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- Season fields valid; points order invalid → UPDATE fails after INSERT; txn rolls back.
    PERFORM public.create_season_with_rules(
      competition_a,
      'Bad Rules Season',
      'bad-rules-013',
      'round_robin',
      'draft',
      '2026-01-01'::date,
      '2026-06-01'::date,
      1, 2, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '12_rules_failure_leaves_no_season', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO v_count FROM public.seasons WHERE organization_id = org_a;
    SELECT count(*) INTO v_audit FROM public.season_rules WHERE organization_id = org_a;
    INSERT INTO public.__mig013_test_results VALUES (
      '12_rules_failure_leaves_no_season',
      v_count = v_before_seasons
        AND v_audit = v_before_rules
        AND NOT EXISTS (SELECT 1 FROM public.seasons WHERE slug = 'bad-rules-013'),
      format(
        'err=%s seasons_before=%s after=%s rules_before=%s after=%s',
        SQLERRM, v_before_seasons, v_count, v_before_rules, v_audit
      )
    );
  END;

  -- 13: invalid dates → no season
  SELECT count(*) INTO v_before_seasons FROM public.seasons WHERE organization_id = org_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_with_rules(
      competition_a, 'Bad Dates', 'bad-dates-013', 'round_robin', 'draft',
      '2026-12-01'::date, '2026-01-01'::date,
      3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '13_invalid_dates_leave_no_season', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO v_count FROM public.seasons WHERE organization_id = org_a;
    INSERT INTO public.__mig013_test_results VALUES (
      '13_invalid_dates_leave_no_season',
      v_count = v_before_seasons
        AND SQLERRM ILIKE '%ends_on%'
        AND NOT EXISTS (SELECT 1 FROM public.seasons WHERE slug = 'bad-dates-013'),
      format('err=%s count=%s', SQLERRM, v_count)
    );
  END;

  -- 14: duplicate slug → no partial season
  SELECT count(*) INTO v_before_seasons FROM public.seasons WHERE organization_id = org_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.create_season_with_rules(
      competition_a, 'Dup Slug', 'apertura-2026-013', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '14_duplicate_slug_no_partial', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO v_count FROM public.seasons WHERE organization_id = org_a;
    INSERT INTO public.__mig013_test_results VALUES (
      '14_duplicate_slug_no_partial',
      v_count = v_before_seasons
        AND (SQLERRM ILIKE '%unique%' OR SQLERRM ILIKE '%duplicate%'),
      format('err=%s count=%s', SQLERRM, v_count)
    );
  END;

  -- 15: update modifies season and rules
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_season_with_rules(
      season_a,
      'Apertura 2026 Editada',
      'round_robin_double',
      'private',
      '2026-08-05'::date,
      '2026-12-20'::date,
      5, 2, 1, true, 85, 10, 6, 3
    );
    SELECT name, visibility INTO v_name, v_vis FROM public.seasons WHERE id = season_a;
    SELECT points_win INTO v_points FROM public.season_rules WHERE season_id = season_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '15_update_modifies_season_and_rules',
      v_name = 'Apertura 2026 Editada' AND v_vis = 'private' AND v_points = 5,
      format('name=%s vis=%s points=%s', v_name, v_vis, v_points)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '15_update_modifies_season_and_rules', false, SQLERRM
    );
  END;

  -- 16: rules update failure keeps previous season
  SELECT name INTO v_name FROM public.seasons WHERE id = season_a;
  SELECT points_win INTO v_points FROM public.season_rules WHERE season_id = season_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_season_with_rules(
      season_a,
      'Should Rollback Name',
      'knockout',
      'public',
      NULL, NULL,
      1, 3, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '16_rules_fail_keeps_previous_season', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT name INTO v_vis FROM public.seasons WHERE id = season_a;
    SELECT points_win INTO v_draw FROM public.season_rules WHERE season_id = season_a;
    INSERT INTO public.__mig013_test_results VALUES (
      '16_rules_fail_keeps_previous_season',
      v_vis = v_name AND v_draw = v_points,
      format('err=%s name=%s points=%s', SQLERRM, v_vis, v_draw)
    );
  END;

  -- 17: season update failure keeps previous rules
  -- invalid format_type fails before rules write; confirm rules unchanged after failed call
  SELECT points_win INTO v_points FROM public.season_rules WHERE season_id = season_a;
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_season_with_rules(
      season_a,
      'Still Valid Name',
      'swiss',
      'draft',
      NULL, NULL,
      9, 9, 9, true, 99, 0, 9, 9
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '17_season_fail_keeps_previous_rules', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    SELECT points_win INTO v_draw FROM public.season_rules WHERE season_id = season_a;
    SELECT name INTO v_vis FROM public.seasons WHERE id = season_a;
    INSERT INTO public.__mig013_test_results VALUES (
      '17_season_fail_keeps_previous_rules',
      v_draw = v_points
        AND v_vis = 'Apertura 2026 Editada'
        AND SQLERRM ILIKE '%format_type%',
      format('err=%s points=%s name=%s', SQLERRM, v_draw, v_vis)
    );
  END;

  -- 18: member cannot update
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_season_with_rules(
      season_a, 'Hacked', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '18_member_cannot_update', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '18_member_cannot_update',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 19: other org cannot update
  PERFORM set_config('request.jwt.claim.sub', uid_owner_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.update_season_with_rules(
      season_a, 'Stolen', 'round_robin', 'draft',
      NULL, NULL, 3, 1, 0, true, 90, 0, 5, 1
    );
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '19_other_org_cannot_update', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '19_other_org_cannot_update',
      SQLERRM ILIKE '%not authorized%',
      SQLERRM
    );
  END;

  -- 20–22: audit
  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'seasons'
    AND action = 'insert'
    AND entity_id = season_a;
  INSERT INTO public.__mig013_test_results VALUES (
    '20_audit_season_insert',
    v_audit >= 1,
    format('audit_rows=%s', v_audit)
  );

  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'season_rules'
    AND action = 'update'
    AND entity_id IN (SELECT id FROM public.season_rules WHERE season_id = season_a);
  INSERT INTO public.__mig013_test_results VALUES (
    '21_audit_season_rules_update',
    v_audit >= 1,
    format('audit_rows=%s', v_audit)
  );

  SELECT count(*) INTO v_audit
  FROM public.audit_log
  WHERE organization_id = org_a
    AND entity_type = 'seasons'
    AND action = 'update'
    AND entity_id = season_a;
  INSERT INTO public.__mig013_test_results VALUES (
    '22_audit_season_update',
    v_audit >= 1,
    format('audit_rows=%s', v_audit)
  );

  -- 24: F4 regression — competition still owner-writable / member blocked (direct table)
  PERFORM set_config('request.jwt.claim.sub', uid_member_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_member_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.competitions (organization_id, name) VALUES (org_a, 'Member Comp');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '24_f4_member_cannot_create_competition', false, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig013_test_results VALUES (
      '24_f4_member_cannot_create_competition',
      SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%policy%',
      SQLERRM
    );
  END;

  -- Cleanup
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;

  DELETE FROM public.audit_log WHERE organization_id IN (org_a, org_b);
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
  DELETE FROM auth.users
  WHERE id IN (uid_owner_a, uid_admin_a, uid_member_a, uid_tadmin_a, uid_owner_b);

  ALTER TABLE public.season_roles ENABLE TRIGGER USER;
  ALTER TABLE public.season_rules ENABLE TRIGGER USER;
  ALTER TABLE public.seasons ENABLE TRIGGER USER;
  ALTER TABLE public.competitions ENABLE TRIGGER USER;
  ALTER TABLE public.organizations ENABLE TRIGGER USER;
  ALTER TABLE public.organization_members ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;
END $$;

SELECT test_name, passed, details
FROM public.__mig013_test_results
ORDER BY test_name;

DROP TABLE IF EXISTS public.__mig013_test_results;
