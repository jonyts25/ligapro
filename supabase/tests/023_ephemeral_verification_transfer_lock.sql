-- Migration 023: ephemeral verification + transfer lock
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/023_ephemeral_verification_transfer_lock.sql

DROP TABLE IF EXISTS public.__mig023_test_results;
CREATE TABLE public.__mig023_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0230';
  uid_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0231';
  uid_captain_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0231';
  uid_captain_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0232';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  team_a uuid;
  team_b uuid;
  st_a uuid;
  st_b uuid;
  stp_cap_a uuid;
  stp_cap_b uuid;
  player_cap_a uuid;
  player_cap_b uuid;
  player_roster_a uuid;
  player_approved uuid;
  player_transfer uuid;
  stp_transfer uuid;
  v_token uuid;
  v_count integer;
  v_status text;
  v_stp uuid;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.players DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_players DISABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations DISABLE TRIGGER USER;
  ALTER TABLE public.player_verification_reviews DISABLE TRIGGER USER;
  ALTER TABLE public.player_transfer_lock_releases DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations
    WHERE name LIKE '%Mig023%'
       OR created_by IN (uid_owner, uid_admin, uid_captain_a, uid_captain_b)
  );
  DELETE FROM public.organizations
  WHERE name LIKE '%Mig023%'
     OR created_by IN (uid_owner, uid_admin, uid_captain_a, uid_captain_b);
  DELETE FROM auth.users
  WHERE id IN (uid_owner, uid_admin, uid_captain_a, uid_captain_b);

  ALTER TABLE public.player_transfer_lock_releases ENABLE TRIGGER USER;
  ALTER TABLE public.player_verification_reviews ENABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations ENABLE TRIGGER USER;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
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
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig023.local', '$2a$06$testhashligapromigration023aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_admin, 'authenticated', 'authenticated',
     'admin@ligapro-mig023.local', '$2a$06$testhashligapromigration023aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_a, 'authenticated', 'authenticated',
     'captain-a@ligapro-mig023.local', '$2a$06$testhashligapromigration023aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_b, 'authenticated', 'authenticated',
     'captain-b@ligapro-mig023.local', '$2a$06$testhashligapromigration023aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (uid_owner, 'owner@ligapro-mig023.local', 'Owner 023'),
    (uid_admin, 'admin@ligapro-mig023.local', 'Admin 023'),
    (uid_captain_a, 'captain-a@ligapro-mig023.local', 'Captain A 023'),
    (uid_captain_b, 'captain-b@ligapro-mig023.local', 'Captain B 023')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );

  org_a := public.create_organization_with_owner('Org A Mig023');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_admin, 'organization_admin');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp 023') RETURNING id INTO competition_a;

  season_a := public.create_season_with_rules(
    competition_a, 'Season A 023', 'season-a-mig023',
    'round_robin', 'draft', NULL, NULL,
    3, 1, 0, true, 90, 0, 2, 1
  );

  UPDATE public.season_rules
  SET require_player_verification = true, transfer_lock_days = 7
  WHERE season_id = season_a;

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Alpha 023') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Beta 023') RETURNING id INTO team_b;

  st_a := public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'confirmed');
  st_b := public.enroll_team_in_season(season_a, team_b, NULL, NULL, 'confirmed');

  stp_cap_a := public.create_captain_player_with_invitation(
    st_a, 'Captain Alpha', 'captain-a@ligapro-mig023.local', 10
  );
  stp_cap_b := public.create_captain_player_with_invitation(
    st_b, 'Captain Beta', 'captain-b@ligapro-mig023.local', 9
  );

  player_cap_a := (SELECT player_id FROM public.season_team_players WHERE id = stp_cap_a);
  player_cap_b := (SELECT player_id FROM public.season_team_players WHERE id = stp_cap_b);

  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Roster Player A') RETURNING id INTO player_roster_a;

  PERFORM public.add_player_to_season_team(st_a, player_roster_a, 7, 'active');

  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Transfer Player') RETURNING id INTO player_transfer;
  stp_transfer := public.add_player_to_season_team(st_a, player_transfer, 11, 'active');
  PERFORM public.deactivate_season_team_player(stp_transfer);
  EXECUTE 'RESET ROLE';

  -- Accept captain invitations
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  SELECT token INTO v_token FROM public.captain_invitations
  WHERE season_team_player_id = stp_cap_a AND status = 'pending' LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  SELECT token INTO v_token FROM public.captain_invitations
  WHERE season_team_player_id = stp_cap_b AND status = 'pending' LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);

  -- 01 schema: no document/file/path/url storage columns in new tables
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('player_verification_reviews', 'player_transfer_lock_releases')
    AND column_name NOT LIKE '%profile_id%'
    AND (
      column_name ILIKE '%document%'
      OR column_name ILIKE '%storage%'
      OR column_name ILIKE '%file%'
      OR column_name ILIKE '%_path%'
      OR column_name ILIKE '%_url%'
      OR column_name ILIKE '%image%'
    );
  INSERT INTO public.__mig023_test_results VALUES (
    '01_no_document_columns_in_schema',
    v_count = 0,
    format('suspicious_columns=%s', v_count)
  );

  -- 02 captain requests verification for own roster player
  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.request_player_verification(player_roster_a);
    EXECUTE 'RESET ROLE';
    SELECT verification_status INTO v_status FROM public.players WHERE id = player_roster_a;
    INSERT INTO public.__mig023_test_results VALUES (
      '02_captain_requests_own_player',
      v_status = 'pending',
      format('status=%s', v_status)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '02_captain_requests_own_player', false, SQLERRM
    );
  END;

  -- 03 captain cannot request for other team player
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.request_player_verification(player_cap_b);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '03_captain_other_team_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '03_captain_other_team_rejected',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 04 captain cannot review
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.review_player_verification(player_roster_a, true, NULL);
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '04_captain_review_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '04_captain_review_rejected',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 05 reject without reason fails
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.review_player_verification(player_roster_a, false, '   ');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '05_reject_without_reason_fails', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '05_reject_without_reason_fails',
      SQLERRM ILIKE '%reason is required%',
      SQLERRM
    );
  END;

  -- 06 reject with reason
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.review_player_verification(
      player_roster_a, false, 'Documento no legible en revisión presencial'
    );
    EXECUTE 'RESET ROLE';
    SELECT verification_status INTO v_status FROM public.players WHERE id = player_roster_a;
    INSERT INTO public.__mig023_test_results VALUES (
      '06_reject_with_reason',
      v_status = 'rejected',
      format('status=%s', v_status)
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '06_reject_with_reason', false, SQLERRM
    );
  END;

  -- 07 captain cannot activate rejected player (deactivate first as admin)
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.deactivate_season_team_player(
    (SELECT id FROM public.season_team_players
     WHERE season_team_id = st_a AND player_id = player_roster_a)
  );
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_a, player_roster_a, 7, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '07_captain_cannot_activate_rejected', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '07_captain_cannot_activate_rejected',
      SQLERRM ILIKE '%verification%',
      SQLERRM
    );
  END;

  -- 08 admin bypass activates rejected player
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_stp := public.add_player_to_season_team(st_a, player_roster_a, 7, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '08_admin_bypass_verification',
      v_stp IS NOT NULL,
      coalesce(v_stp::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '08_admin_bypass_verification', false, SQLERRM
    );
  END;

  -- Approve another player for positive activation test
  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Approved Player') RETURNING id INTO player_approved;
  PERFORM public.request_player_verification(player_approved);
  PERFORM public.review_player_verification(player_approved, true, NULL);
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_captain_a::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_a::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_stp := public.add_player_to_season_team(st_a, player_approved, 8, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '09_captain_activates_approved',
      v_stp IS NOT NULL,
      coalesce(v_stp::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '09_captain_activates_approved', false, SQLERRM
    );
  END;

  -- 10 transfer lock blocks captain before expiry
  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.add_player_to_season_team(st_b, player_transfer, 12, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '10_transfer_lock_blocks_captain', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '10_transfer_lock_blocks_captain',
      SQLERRM ILIKE '%Transfer lock%',
      SQLERRM
    );
  END;

  -- 11 release without reason fails
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.release_player_transfer_lock(player_transfer, season_a, '  ');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '11_release_without_reason_fails', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '11_release_without_reason_fails',
      SQLERRM ILIKE '%reason is required%',
      SQLERRM
    );
  END;

  -- 12 release with reason allows captain activation
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.release_player_transfer_lock(
      player_transfer, season_a, 'Transferencia autorizada por la liga'
    );
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '12_release_allows_captain_activation', false, SQLERRM
    );
  END;

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_stp := public.add_player_to_season_team(st_b, player_transfer, 12, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '12_release_allows_captain_activation',
      v_stp IS NOT NULL,
      coalesce(v_stp::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '12_release_allows_captain_activation', false, SQLERRM
    );
  END;

  -- 13 admin activates without lock anytime
  PERFORM set_config('request.jwt.claim.sub', uid_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_admin::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Lock Bypass Player') RETURNING id INTO player_transfer;
  v_stp := public.add_player_to_season_team(st_a, player_transfer, 13, 'active');
  PERFORM public.deactivate_season_team_player(v_stp);
  v_stp := public.add_player_to_season_team(st_b, player_transfer, 14, 'active');
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig023_test_results VALUES (
    '13_admin_bypass_transfer_lock',
    v_stp IS NOT NULL,
    coalesce(v_stp::text, 'null')
  );

  -- 14 transfer_lock_days = 0 never blocks captain
  UPDATE public.season_rules SET transfer_lock_days = 0 WHERE season_id = season_a;
  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Zero Lock Player') RETURNING id INTO player_transfer;
  v_stp := public.add_player_to_season_team(st_a, player_transfer, 15, 'active');
  PERFORM public.deactivate_season_team_player(v_stp);
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_stp := public.add_player_to_season_team(st_b, player_transfer, 16, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '14_zero_lock_days_no_block',
      v_stp IS NOT NULL,
      coalesce(v_stp::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '14_zero_lock_days_no_block', false, SQLERRM
    );
  END;

  -- 15 expired lock allows captain (backdate inactive updated_at)
  UPDATE public.season_rules SET transfer_lock_days = 7 WHERE season_id = season_a;
  PERFORM set_config('request.jwt.claim.sub', uid_owner::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_owner::text, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.players (organization_id, full_name)
  VALUES (org_a, 'Expired Lock Player') RETURNING id INTO player_transfer;
  v_stp := public.add_player_to_season_team(st_a, player_transfer, 17, 'active');
  PERFORM public.deactivate_season_team_player(v_stp);
  EXECUTE 'RESET ROLE';

  ALTER TABLE public.season_team_players DISABLE TRIGGER USER;
  UPDATE public.season_team_players
  SET updated_at = now() - interval '8 days'
  WHERE season_team_id = st_a AND player_id = player_transfer;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', uid_captain_b::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_captain_b::text, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_stp := public.add_player_to_season_team(st_b, player_transfer, 18, 'active');
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '15_expired_lock_allows_captain',
      v_stp IS NOT NULL,
      coalesce(v_stp::text, 'null')
    );
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO public.__mig023_test_results VALUES (
      '15_expired_lock_allows_captain', false, SQLERRM
    );
  END;

EXCEPTION WHEN OTHERS THEN
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig023_test_results VALUES ('zz_suite_fatal', false, SQLERRM)
  ON CONFLICT (test_name) DO UPDATE SET passed = EXCLUDED.passed, details = EXCLUDED.details;
END;
$$;

SELECT test_name, passed, details FROM public.__mig023_test_results ORDER BY test_name;
SELECT COUNT(*) FILTER (WHERE passed) AS passed,
       COUNT(*) FILTER (WHERE NOT passed) AS failed,
       COUNT(*) AS total
FROM public.__mig023_test_results;

DROP TABLE IF EXISTS public.__mig023_test_results;
