-- Migration 046 (step 3.7): public team registration requests
--
-- PREREQUISITE: apply supabase/migrations/20261005100000_public_team_registration.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/046_public_team_registration.sql

DROP TABLE IF EXISTS public.__mig046_test_results;
CREATE TABLE public.__mig046_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig046_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig046_as(p_uid uuid)
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

CREATE OR REPLACE FUNCTION public.__mig046_as_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon')::text,
    true
  );
END;
$$;

DO $$
DECLARE
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0461';
  uid_member uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0461';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  season_private uuid;
  request_id uuid;
  request_id2 uuid;
  season_team_id uuid;
  v_count integer;
  v_invitation_id uuid;
  v_ok boolean;
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
  ALTER TABLE public.season_team_registration_requests DISABLE TRIGGER USER;

  DELETE FROM public.season_team_registration_requests WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'org-mig046-public-reg'
  );
  DELETE FROM public.organizations WHERE slug = 'org-mig046-public-reg';
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_member);

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
  ALTER TABLE public.season_team_registration_requests ENABLE TRIGGER USER;
  ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_prevent_mutation;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig046.local', '$2a$06$testhashligapromigration046aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member, 'authenticated', 'authenticated',
     'member@ligapro-mig046.local', '$2a$06$testhashligapromigration046aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_owner, 'owner@ligapro-mig046.local', 'Owner 046'),
    (uid_member, 'member@ligapro-mig046.local', 'Member 046')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig046_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Mig046 Public Reg');
  UPDATE public.organizations SET slug = 'org-mig046-public-reg' WHERE id = org_a;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, uid_member, 'organization_member');

  INSERT INTO public.competitions (organization_id, name, slug)
  VALUES (org_a, 'Liga 046', 'liga-046')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, competition_a, 'Apertura 046', 'apertura-046', 'public')
  RETURNING id INTO season_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, visibility)
  VALUES (org_a, competition_a, 'Privada 046', 'privada-046', 'private')
  RETURNING id INTO season_private;

  INSERT INTO public.season_rules (
    organization_id, season_id, match_duration_minutes, allow_public_team_registration
  ) VALUES (org_a, season_a, 90, true);

  INSERT INTO public.season_rules (
    organization_id, season_id, match_duration_minutes, allow_public_team_registration
  ) VALUES (org_a, season_private, 90, true);

  -- anon cannot submit when toggle off
  UPDATE public.season_rules
  SET allow_public_team_registration = false
  WHERE season_id = season_a;

  PERFORM public.__mig046_as_anon();
  BEGIN
    PERFORM public.submit_team_registration_request(
      org_a, 'apertura-046', 'Halcones FC', 'Capitan H', 'capitan@halcones.local'
    );
    INSERT INTO public.__mig046_test_results VALUES (
      '01_anon_rejects_when_disabled', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig046_test_results VALUES (
      '01_anon_rejects_when_disabled', true, SQLERRM
    );
  END;

  UPDATE public.season_rules
  SET allow_public_team_registration = true
  WHERE season_id = season_a;

  -- anon cannot submit for non-public season
  PERFORM public.__mig046_as_anon();
  BEGIN
    PERFORM public.submit_team_registration_request(
      org_a, 'privada-046', 'Secretos FC', 'Capitan S', 'capitan@secretos.local'
    );
    INSERT INTO public.__mig046_test_results VALUES (
      '02_anon_rejects_non_public_season', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig046_test_results VALUES (
      '02_anon_rejects_non_public_season', true, SQLERRM
    );
  END;

  -- anon submit succeeds when enabled + public
  PERFORM public.__mig046_as_anon();
  request_id := public.submit_team_registration_request(
    org_a,
    'apertura-046',
    'Halcones FC',
    'Capitan Halcon',
    'capitan@halcones.local',
    '+52 55 1234 5678',
    'Grupo A'
  );
  INSERT INTO public.__mig046_test_results VALUES (
    '03_anon_submit_succeeds',
    request_id IS NOT NULL,
    format('request=%s', request_id)
  );

  -- member cannot SELECT requests (contact data)
  PERFORM public.__mig046_as(uid_member);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT COUNT(*) INTO v_count
  FROM public.season_team_registration_requests
  WHERE organization_id = org_a;
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig046_test_results VALUES (
    '04_member_cannot_select_requests',
    v_count = 0,
    format('count=%s', v_count)
  );

  -- owner can SELECT
  PERFORM public.__mig046_as(uid_owner);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT COUNT(*) INTO v_count
  FROM public.season_team_registration_requests
  WHERE organization_id = org_a AND status = 'pending';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.__mig046_test_results VALUES (
    '05_owner_can_select_pending',
    v_count = 1,
    format('count=%s', v_count)
  );

  -- approve creates team, enrollment, captain invitation
  PERFORM public.__mig046_as(uid_owner);
  season_team_id := public.approve_team_registration_request(request_id);

  SELECT COUNT(*) INTO v_count
  FROM public.teams t
  WHERE t.organization_id = org_a AND t.name = 'Halcones FC';
  INSERT INTO public.__mig046_test_results VALUES (
    '06_approve_creates_team',
    v_count = 1 AND season_team_id IS NOT NULL,
    format('team_count=%s season_team=%s', v_count, season_team_id)
  );

  SELECT COUNT(*) INTO v_count
  FROM public.season_teams st
  WHERE st.id = season_team_id AND st.registration_status = 'confirmed';
  INSERT INTO public.__mig046_test_results VALUES (
    '07_approve_enrolls_team',
    v_count = 1,
    format('count=%s', v_count)
  );

  SELECT ci.id INTO v_invitation_id
  FROM public.captain_invitations ci
  JOIN public.season_team_players stp ON stp.id = ci.season_team_player_id
  WHERE stp.season_team_id = season_team_id
    AND ci.email = 'capitan@halcones.local'
    AND ci.status = 'pending'
  LIMIT 1;
  INSERT INTO public.__mig046_test_results VALUES (
    '08_approve_creates_captain_invitation',
    v_invitation_id IS NOT NULL,
    format('invitation=%s', v_invitation_id)
  );

  SELECT status INTO v_ok
  FROM public.season_team_registration_requests
  WHERE id = request_id;
  INSERT INTO public.__mig046_test_results VALUES (
    '09_request_marked_approved',
    v_ok = 'approved',
    format('status=%s', v_ok)
  );

  -- second anon request for reject flow
  PERFORM public.__mig046_as_anon();
  request_id2 := public.submit_team_registration_request(
    org_a,
    'apertura-046',
    'Leones FC',
    'Capitan Leon',
    'capitan@leones.local'
  );

  PERFORM public.__mig046_as(uid_owner);
  BEGIN
    PERFORM public.reject_team_registration_request(request_id2, NULL);
    INSERT INTO public.__mig046_test_results VALUES (
      '10_reject_requires_reason', false, 'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig046_test_results VALUES (
      '10_reject_requires_reason', true, SQLERRM
    );
  END;

  PERFORM public.__mig046_as(uid_owner);
  PERFORM public.reject_team_registration_request(request_id2, 'Cupo lleno');

  SELECT COUNT(*) INTO v_count
  FROM public.teams t
  WHERE t.organization_id = org_a AND t.name = 'Leones FC';
  INSERT INTO public.__mig046_test_results VALUES (
    '11_reject_does_not_create_team',
    v_count = 0,
    format('count=%s', v_count)
  );

  SELECT status INTO v_ok
  FROM public.season_team_registration_requests
  WHERE id = request_id2;
  INSERT INTO public.__mig046_test_results VALUES (
    '12_request_marked_rejected',
    v_ok = 'rejected',
    format('status=%s', v_ok)
  );

  -- anon has execute on submit only
  SELECT
    has_function_privilege('anon', 'public.submit_team_registration_request(uuid, text, text, text, text, text, text)', 'EXECUTE')
    AND has_function_privilege('anon', 'public.is_public_team_registration_open(uuid, text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.approve_team_registration_request(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.reject_team_registration_request(uuid, text)', 'EXECUTE')
  INTO v_ok;
  INSERT INTO public.__mig046_test_results VALUES (
    '13_grants_anon_submit_only',
    v_ok,
    format('ok=%s', v_ok)
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig046_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT COUNT(*) INTO v_failed
  FROM public.__mig046_test_results
  WHERE NOT passed;
  IF v_failed > 0 THEN
    RAISE EXCEPTION '% test(s) failed in 046_public_team_registration.sql', v_failed;
  END IF;
END;
$$;
