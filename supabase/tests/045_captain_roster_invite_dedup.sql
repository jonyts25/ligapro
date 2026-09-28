-- Migration 045 (step 3.5): captain invite + phone dedup access
--
-- PREREQUISITE: apply supabase/migrations/20261004100000_captain_roster_invite_dedup.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/045_captain_roster_invite_dedup.sql

DROP TABLE IF EXISTS public.__mig045_test_results;
CREATE TABLE public.__mig045_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig045_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig045_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0451';
  uid_captain uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0451';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  team_a uuid;
  st_a uuid;
  player_existing uuid;
  player_new uuid;
  stp_captain uuid;
  stp_existing uuid;
  v_invitation_id uuid;
  v_token text;
  v_count integer;
  v_dup_count integer;
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

  DELETE FROM public.captain_invitations WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'org-mig045-captain'
  );
  DELETE FROM public.organizations WHERE slug = 'org-mig045-captain';
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_captain);

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
     'owner@ligapro-mig045.local', '$2a$06$testhashligapromigration045aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain, 'authenticated', 'authenticated',
     'captain@ligapro-mig045.local', '$2a$06$testhashligapromigration045aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_owner, 'owner@ligapro-mig045.local', 'Owner 045'),
    (uid_captain, 'captain@ligapro-mig045.local', 'Captain 045')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig045_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Mig045 Captain');
  UPDATE public.organizations SET slug = 'org-mig045-captain' WHERE id = org_a;

  INSERT INTO public.competitions (organization_id, name, slug)
  VALUES (org_a, 'Liga 045', 'liga-045')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, status)
  VALUES (org_a, competition_a, 'Apertura 045', 'apertura-045', 'active')
  RETURNING id INTO season_a;

  INSERT INTO public.season_rules (organization_id, season_id, match_duration_minutes)
  VALUES (org_a, season_a, 90);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Capitanes 045') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_a) RETURNING id INTO st_a;

  INSERT INTO public.players (organization_id, full_name, profile_id, phone)
  VALUES (org_a, 'Capitan Lider', uid_captain, NULL)
  RETURNING id INTO player_new;

  INSERT INTO public.players (organization_id, full_name, phone)
  VALUES (org_a, 'Duplicado Tel', '5550450001')
  RETURNING id INTO player_existing;

  INSERT INTO public.season_team_players (
    organization_id, season_id, season_team_id, player_id, registration_status, is_captain
  ) VALUES (org_a, season_a, st_a, player_new, 'active', true) RETURNING id INTO stp_captain;

  INSERT INTO public.season_team_players (
    organization_id, season_id, season_team_id, player_id, registration_status
  ) VALUES (org_a, season_a, st_a, player_existing, 'active') RETURNING id INTO stp_existing;

  PERFORM public.__mig045_as(uid_captain);

  SELECT count(*)::integer INTO v_dup_count
  FROM public.find_potential_duplicate_player(org_a, '5550450001');

  INSERT INTO public.__mig045_test_results VALUES (
    '01_captain_can_find_duplicate_by_phone',
    v_dup_count = 1,
    v_dup_count::text
  );

  v_invitation_id := public.invite_player_to_roster(
    stp_existing,
    'duplicado@ligapro-mig045.local'
  );

  SELECT token INTO v_token
  FROM public.captain_invitations
  WHERE id = v_invitation_id;

  INSERT INTO public.__mig045_test_results VALUES (
    '02_captain_can_invite_player_to_claim',
    v_invitation_id IS NOT NULL AND v_token IS NOT NULL,
    coalesce(v_token, 'null')
  );

  SELECT count(*)::integer INTO v_count
  FROM public.captain_invitations
  WHERE season_team_player_id = stp_existing
    AND status = 'pending';

  INSERT INTO public.__mig045_test_results VALUES (
    '03_captain_can_read_pending_invitation_token',
    v_count = 1,
    v_count::text
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig045_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT COUNT(*) INTO v_failed
  FROM public.__mig045_test_results
  WHERE NOT passed;

  IF v_failed > 0 THEN
    RAISE EXCEPTION '% test(s) failed in 045_captain_roster_invite_dedup', v_failed;
  END IF;
END;
$$;
