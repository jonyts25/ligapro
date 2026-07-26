-- Migration 024: player photos + virtual credential access
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/024_player_photos_virtual_credential.sql

DROP TABLE IF EXISTS public.__mig024_test_results;
CREATE TABLE public.__mig024_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

CREATE OR REPLACE FUNCTION public.__mig024_as(p_uid uuid)
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
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0240';
  uid_member_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0241';
  uid_captain_a uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0241';
  uid_captain_b uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0242';
  uid_ref uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0243';
  uid_ref_assigned uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0244';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0240';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  competition_b uuid;
  season_a uuid;
  season_b uuid;
  team_a uuid;
  team_b uuid;
  team_c uuid;
  st_a uuid;
  st_b uuid;
  st_c uuid;
  stp_cap_a uuid;
  stp_cap_b uuid;
  stp_player_a uuid;
  stp_player_b uuid;
  stp_player_c uuid;
  player_a uuid;
  player_b uuid;
  player_c uuid;
  player_other_org uuid;
  match_ab uuid;
  match_cb uuid;
  v_token uuid;
  v_path_a text;
  v_path_b text;
  v_path_c text;
  v_can boolean;
  v_stp_new uuid;
  v_photo text;
  v_def text;
BEGIN
  ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_prevent_mutation;
  ALTER TABLE public.organization_members DISABLE TRIGGER USER;
  ALTER TABLE public.organizations DISABLE TRIGGER USER;
  ALTER TABLE public.competitions DISABLE TRIGGER USER;
  ALTER TABLE public.seasons DISABLE TRIGGER USER;
  ALTER TABLE public.season_rules DISABLE TRIGGER USER;
  ALTER TABLE public.season_roles DISABLE TRIGGER USER;
  ALTER TABLE public.teams DISABLE TRIGGER USER;
  ALTER TABLE public.players DISABLE TRIGGER USER;
  ALTER TABLE public.season_teams DISABLE TRIGGER USER;
  ALTER TABLE public.season_team_players DISABLE TRIGGER USER;
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.match_officials DISABLE TRIGGER USER;
  ALTER TABLE public.captain_invitations DISABLE TRIGGER USER;

  DELETE FROM public.audit_log
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE name LIKE '%Mig024%'
  );
  DELETE FROM public.organizations WHERE name LIKE '%Mig024%';
  DELETE FROM auth.users
  WHERE id IN (
    uid_owner_a, uid_member_a, uid_captain_a, uid_captain_b,
    uid_ref, uid_ref_assigned, uid_owner_b
  );

  ALTER TABLE public.captain_invitations ENABLE TRIGGER USER;
  ALTER TABLE public.match_officials ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
  ALTER TABLE public.season_team_players ENABLE TRIGGER USER;
  ALTER TABLE public.season_teams ENABLE TRIGGER USER;
  ALTER TABLE public.players ENABLE TRIGGER USER;
  ALTER TABLE public.teams ENABLE TRIGGER USER;
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
     'owner-a@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_member_a, 'authenticated', 'authenticated',
     'member-a@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_a, 'authenticated', 'authenticated',
     'captain-a@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain_b, 'authenticated', 'authenticated',
     'captain-b@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ref, 'authenticated', 'authenticated',
     'ref@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_ref_assigned, 'authenticated', 'authenticated',
     'ref-assigned@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig024.local', '$2a$06$testhashligapromigration024aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name) VALUES
    (uid_owner_a, 'owner-a@ligapro-mig024.local', 'Owner A 024'),
    (uid_member_a, 'member-a@ligapro-mig024.local', 'Member A 024'),
    (uid_captain_a, 'captain-a@ligapro-mig024.local', 'Captain A 024'),
    (uid_captain_b, 'captain-b@ligapro-mig024.local', 'Captain B 024'),
    (uid_ref, 'ref@ligapro-mig024.local', 'Ref 024'),
    (uid_ref_assigned, 'ref-assigned@ligapro-mig024.local', 'Ref Assigned 024'),
    (uid_owner_b, 'owner-b@ligapro-mig024.local', 'Owner B 024')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig024_as(uid_owner_a);
  org_a := public.create_organization_with_owner('Org A Mig024');
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.organization_members (organization_id, profile_id, role) VALUES
    (org_a, uid_member_a, 'organization_member'),
    (org_a, uid_ref, 'organization_member'),
    (org_a, uid_ref_assigned, 'organization_member');

  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_a, 'Comp 024') RETURNING id INTO competition_a;
  season_a := public.create_season_with_rules(
    competition_a, 'Season 024', 'season-024-mig024',
    'round_robin', 'draft', NULL, NULL,
    20, 1, 0, true, 90, 0, 2, 1
  );
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_a;
  PERFORM public.__mig024_as(uid_owner_a);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Alpha 024') RETURNING id INTO team_a;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Beta 024') RETURNING id INTO team_b;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Gamma 024') RETURNING id INTO team_c;

  st_a := public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'confirmed');
  st_b := public.enroll_team_in_season(season_a, team_b, NULL, NULL, 'confirmed');
  st_c := public.enroll_team_in_season(season_a, team_c, NULL, NULL, 'confirmed');

  stp_cap_a := public.create_captain_player_with_invitation(
    st_a, 'Captain Alpha 024', 'captain-a@ligapro-mig024.local', 10
  );
  stp_cap_b := public.create_captain_player_with_invitation(
    st_b, 'Captain Beta 024', 'captain-b@ligapro-mig024.local', 9
  );
  stp_player_a := public.create_player_and_add_to_roster(st_a, 'Player Alpha 024', 11);
  stp_player_b := public.create_player_and_add_to_roster(st_b, 'Player Beta 024', 8);
  stp_player_c := public.create_player_and_add_to_roster(st_c, 'Player Gamma 024', 7);

  SELECT player_id INTO player_a FROM public.season_team_players WHERE id = stp_player_a;
  SELECT player_id INTO player_b FROM public.season_team_players WHERE id = stp_player_b;
  SELECT player_id INTO player_c FROM public.season_team_players WHERE id = stp_player_c;

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_number, leg_number, sequence_in_round
  ) VALUES (
    season_a, org_a, st_a, st_b, 'scheduled', 1, 1, 1
  ) RETURNING id INTO match_ab;

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_number, leg_number, sequence_in_round
  ) VALUES (
    season_a, org_a, st_c, st_b, 'scheduled', 1, 1, 2
  ) RETURNING id INTO match_cb;

  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.season_roles (organization_id, season_id, profile_id, role) VALUES
    (org_a, season_a, uid_ref, 'referee'),
    (org_a, season_a, uid_ref_assigned, 'delegate');
  INSERT INTO public.match_officials (organization_id, match_id, profile_id, role, status) VALUES
    (org_a, match_ab, uid_ref, 'referee', 'confirmed'),
    (org_a, match_ab, uid_ref_assigned, 'delegate', 'assigned');
  EXECUTE 'RESET ROLE';

  PERFORM public.__mig024_as(uid_captain_a);
  SELECT token INTO v_token FROM public.captain_invitations WHERE season_team_player_id = stp_cap_a LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);
  PERFORM public.__mig024_as(uid_captain_b);
  SELECT token INTO v_token FROM public.captain_invitations WHERE season_team_player_id = stp_cap_b LIMIT 1;
  PERFORM public.accept_captain_invitation(v_token);

  v_path_a := org_a::text || '/' || player_a::text || '/11111111-1111-1111-1111-111111111111.webp';
  v_path_b := org_a::text || '/' || player_b::text || '/22222222-2222-2222-2222-222222222222.webp';
  v_path_c := org_a::text || '/' || player_c::text || '/33333333-3333-3333-3333-333333333333.webp';

  PERFORM public.__mig024_as(uid_owner_a);
  PERFORM public.set_player_photo(player_a, v_path_a);
  PERFORM public.set_player_photo(player_b, v_path_b);
  PERFORM public.set_player_photo(player_c, v_path_c);

  -- 01 captain sets photo for own team player
  PERFORM public.__mig024_as(uid_captain_a);
  BEGIN
    PERFORM public.set_player_photo(
      player_a,
      org_a::text || '/' || player_a::text || '/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp'
    );
    INSERT INTO public.__mig024_test_results VALUES (
      '01_captain_sets_own_team_photo', true, 'ok'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig024_test_results VALUES (
      '01_captain_sets_own_team_photo', false, SQLERRM
    );
  END;

  -- 02 captain cannot set photo for other team
  PERFORM public.__mig024_as(uid_captain_a);
  BEGIN
    PERFORM public.set_player_photo(player_b, v_path_b);
    INSERT INTO public.__mig024_test_results VALUES (
      '02_captain_denied_other_team_photo', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig024_test_results VALUES (
      '02_captain_denied_other_team_photo',
      SQLERRM ILIKE '%Not authorized%',
      SQLERRM
    );
  END;

  -- 03 org member can view org player photo
  PERFORM public.__mig024_as(uid_member_a);
  SELECT public.can_view_player_photo(player_a) INTO v_can;
  INSERT INTO public.__mig024_test_results VALUES (
    '03_member_views_org_player_photo',
    v_can = true,
    coalesce(v_can::text, 'null')
  );

  -- 05 confirmed official views match roster player
  PERFORM public.__mig024_as(uid_ref);
  SELECT public.can_view_player_photo(player_a) INTO v_can;
  INSERT INTO public.__mig024_test_results VALUES (
    '05_confirmed_official_views_match_roster',
    v_can = true,
    coalesce(v_can::text, 'null')
  );

  -- 06 confirmed official denied player outside assigned match roster
  PERFORM public.__mig024_as(uid_ref);
  SELECT public.can_view_player_photo(player_c) INTO v_can;
  INSERT INTO public.__mig024_test_results VALUES (
    '06_official_denied_outside_match_roster',
    v_can = false,
    coalesce(v_can::text, 'null')
  );

  -- 07 assigned (not confirmed) official denied
  PERFORM public.__mig024_as(uid_ref_assigned);
  SELECT public.can_view_player_photo(player_a) INTO v_can;
  INSERT INTO public.__mig024_test_results VALUES (
    '07_assigned_not_confirmed_denied',
    v_can = false,
    coalesce(v_can::text, 'null')
  );

  -- 08 add player without photo unchanged
  PERFORM public.__mig024_as(uid_captain_a);
  v_stp_new := public.create_player_and_add_to_roster(st_a, 'No Photo 024', 12);
  SELECT p.photo_path INTO v_photo
  FROM public.season_team_players stp
  JOIN public.players p ON p.id = stp.player_id
  WHERE stp.id = v_stp_new;
  INSERT INTO public.__mig024_test_results VALUES (
    '08_add_player_without_photo',
    v_photo IS NULL,
    coalesce(v_photo, 'null')
  );

  -- Org B for cross-org isolation (test 04)
  PERFORM public.__mig024_as(uid_owner_b);
  org_b := public.create_organization_with_owner('Org B Mig024');
  INSERT INTO public.competitions (organization_id, name)
  VALUES (org_b, 'Comp B 024') RETURNING id INTO competition_b;
  season_b := public.create_season_with_rules(
    competition_b, 'Season B 024', 'season-b-mig024',
    'round_robin', 'draft', NULL, NULL,
    20, 1, 0, true, 90, 0, 2, 1
  );
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.seasons SET platform_billing_status = 'pagado' WHERE id = season_b;
  PERFORM public.__mig024_as(uid_owner_b);
  INSERT INTO public.teams (organization_id, name) VALUES (org_b, 'Other 024') RETURNING id INTO team_a;
  st_a := public.enroll_team_in_season(season_b, team_a, NULL, NULL, 'confirmed');
  stp_player_a := public.create_player_and_add_to_roster(st_a, 'Other Org Player', 1);
  SELECT player_id INTO player_other_org FROM public.season_team_players WHERE id = stp_player_a;
  PERFORM public.set_player_photo(
    player_other_org,
    org_b::text || '/' || player_other_org::text || '/44444444-4444-4444-4444-444444444444.webp'
  );

  -- 04 org member cannot view other org player photo
  PERFORM public.__mig024_as(uid_member_a);
  SELECT public.can_view_player_photo(player_other_org) INTO v_can;
  INSERT INTO public.__mig024_test_results VALUES (
    '04_member_denied_other_org_photo',
    v_can = false,
    coalesce(v_can::text, 'null')
  );

  -- 09 public RPCs do not expose photo_path
  SELECT string_agg(pg_get_functiondef(p.oid), E'\n') INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'get_public_season_%';

  INSERT INTO public.__mig024_test_results VALUES (
    '09_public_rpcs_no_photo_path',
    v_def NOT ILIKE '%photo_path%',
    CASE WHEN v_def ILIKE '%photo_path%' THEN 'found photo_path' ELSE 'clean' END
  );

END;
$$;

SELECT
  test_name,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
  details
FROM public.__mig024_test_results
ORDER BY test_name;

SELECT
  count(*) FILTER (WHERE passed) AS passed,
  count(*) FILTER (WHERE NOT passed) AS failed,
  count(*) AS total
FROM public.__mig024_test_results;

DROP FUNCTION IF EXISTS public.__mig024_as(uuid);
