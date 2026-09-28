-- Migration 042 (step 3.4): player claim invite + phone dedup tests
--
-- PREREQUISITE: apply supabase/migrations/20261001100000_player_claim_and_phone_dedup.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/041_player_claim_and_phone_dedup.sql

DROP TABLE IF EXISTS public.__mig041_claim_test_results;
CREATE TABLE public.__mig041_claim_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig041_claim_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig041_claim_as(p_uid uuid)
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
  uid_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa041a';
  uid_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb041b';
  org_a uuid;
  org_b uuid;
  competition_a uuid;
  season_a uuid;
  team_a uuid;
  st_a uuid;
  st_b uuid;
  stp_regular uuid;
  stp_captain uuid;
  player_regular uuid;
  player_phone uuid;
  player_other_org uuid;
  invite_id uuid;
  v_err text;
  v_count integer;
  v_dup_name text;
  v_dup_claimed boolean;
  v_dup_teams integer;
  v_stp_new uuid;
BEGIN
  DELETE FROM public.organizations
  WHERE slug IN ('org-a-mig041claim', 'org-b-mig041claim');
  DELETE FROM auth.users WHERE id IN (uid_owner_a, uid_owner_b);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner_a, 'authenticated', 'authenticated',
     'owner-a@ligapro-mig041claim.local', '$2a$06$testhashligapromigration041claim', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_owner_b, 'authenticated', 'authenticated',
     'owner-b@ligapro-mig041claim.local', '$2a$06$testhashligapromigration041claim', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_owner_a, 'owner-a@ligapro-mig041claim.local', 'Owner A'),
    (uid_owner_b, 'owner-b@ligapro-mig041claim.local', 'Owner B')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig041_claim_as(uid_owner_a);
  org_a := public.create_organization_with_owner('Org A Mig041 Claim');
  UPDATE public.organizations SET slug = 'org-a-mig041claim' WHERE id = org_a;

  PERFORM public.__mig041_claim_as(uid_owner_b);
  org_b := public.create_organization_with_owner('Org B Mig041 Claim');
  UPDATE public.organizations SET slug = 'org-b-mig041claim' WHERE id = org_b;

  INSERT INTO public.competitions (organization_id, name, slug)
  VALUES (org_a, 'Liga Claim', 'liga-claim')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, status)
  VALUES (org_a, competition_a, 'Temporada Claim', 'temp-claim', 'active')
  RETURNING id INTO season_a;

  INSERT INTO public.teams (organization_id, name)
  VALUES (org_a, 'Equipo A')
  RETURNING id INTO team_a;

  st_a := public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'confirmed');

  INSERT INTO public.teams (organization_id, name)
  VALUES (org_a, 'Equipo B')
  RETURNING id INTO team_b;

  st_b := public.enroll_team_in_season(season_a, team_b, NULL, NULL, 'confirmed');

  stp_regular := public.create_player_and_add_to_roster(st_a, 'Jugador Regular', 9);
  SELECT player_id INTO player_regular
  FROM public.season_team_players WHERE id = stp_regular;

  stp_captain := public.create_player_and_add_to_roster(st_a, 'Capitan Existente', 10);
  PERFORM public.set_season_team_captain(st_a, (
    SELECT player_id FROM public.season_team_players WHERE id = stp_captain
  ));

  -- invite_player_to_roster works for non-captain (invite_captain would fail)
  BEGIN
    invite_id := public.invite_player_to_roster(
      stp_regular,
      'regular@ligapro-mig041claim.local'
    );
    INSERT INTO public.__mig041_claim_test_results VALUES (
      'invite_player_non_captain_succeeds',
      invite_id IS NOT NULL,
      format('invitation_id=%s', invite_id)
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig041_claim_test_results VALUES (
      'invite_player_non_captain_succeeds',
      false,
      v_err
    );
  END;

  BEGIN
    PERFORM public.invite_captain_to_roster(
      stp_regular,
      'should-fail@ligapro-mig041claim.local'
    );
    INSERT INTO public.__mig041_claim_test_results VALUES (
      'invite_captain_still_blocks_non_leader',
      false,
      'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig041_claim_test_results VALUES (
      'invite_captain_still_blocks_non_leader',
      v_err ILIKE '%captain%',
      v_err
    );
  END;

  INSERT INTO public.players (organization_id, full_name, phone, profile_id)
  VALUES (org_a, 'Duplicado Tel', '5551234567', NULL)
  RETURNING id INTO player_phone;

  PERFORM public.add_existing_player_to_roster(player_phone, st_a, 11, 'active');

  PERFORM public.__mig041_claim_as(uid_owner_a);
  SELECT count(*) INTO v_count
  FROM public.find_potential_duplicate_player(org_a, '5551234567');

  SELECT d.full_name, d.is_claimed, d.teams_count
  INTO v_dup_name, v_dup_claimed, v_dup_teams
  FROM public.find_potential_duplicate_player(org_a, '5551234567') AS d
  LIMIT 1;

  INSERT INTO public.__mig041_claim_test_results VALUES (
    'find_duplicate_by_phone_same_org',
    v_count >= 1
      AND v_dup_name = 'Duplicado Tel'
      AND v_dup_teams >= 1,
    format('count=%s name=%s teams=%s', v_count, v_dup_name, v_dup_teams)
  );

  INSERT INTO public.players (organization_id, full_name, phone)
  VALUES (org_b, 'Otra Org Mismo Tel', '5551234567')
  RETURNING id INTO player_other_org;

  PERFORM public.__mig041_claim_as(uid_owner_a);
  SELECT count(*) INTO v_count
  FROM public.find_potential_duplicate_player(org_a, '5551234567')
  WHERE player_id = player_other_org;

  INSERT INTO public.__mig041_claim_test_results VALUES (
    'find_duplicate_does_not_cross_orgs',
    v_count = 0,
    format('foreign_matches=%s', v_count)
  );

  PERFORM public.__mig041_claim_as(uid_owner_a);
  SELECT count(*) INTO v_count
  FROM public.find_potential_duplicate_player(org_a, NULL);

  INSERT INTO public.__mig041_claim_test_results VALUES (
    'find_duplicate_empty_phone_returns_nothing',
    v_count = 0,
    format('count=%s', v_count)
  );

  BEGIN
    PERFORM public.add_existing_player_to_roster(player_phone, st_a, 12, 'active');
    INSERT INTO public.__mig041_claim_test_results VALUES (
      'add_existing_rejects_same_season_team_twice',
      false,
      'expected exception'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    INSERT INTO public.__mig041_claim_test_results VALUES (
      'add_existing_rejects_same_season_team_twice',
      v_err ILIKE '%already on this roster%',
      v_err
    );
  END;

  v_stp_new := public.add_existing_player_to_roster(player_phone, st_b, 7, 'active');

  INSERT INTO public.__mig041_claim_test_results VALUES (
    'add_existing_allows_second_team_same_org',
    v_stp_new IS NOT NULL,
    format('stp_id=%s', v_stp_new)
  );

  PERFORM public.__mig041_claim_as(uid_owner_a);
  v_stp_new := public.create_player_and_add_to_roster(
    st_b,
    'Jugador Sin Tel',
    8,
    'active',
    NULL
  );

  INSERT INTO public.__mig041_claim_test_results VALUES (
    'create_without_phone_still_creates_new_player',
    v_stp_new IS NOT NULL,
    format('stp_id=%s', v_stp_new)
  );

  PERFORM public.__mig041_claim_as(uid_owner_a);
  v_stp_new := public.create_player_and_add_to_roster(
    st_b,
    'Jugador Tel Nuevo',
    6,
    'active',
    '5559998888'
  );

  SELECT count(*) INTO v_count
  FROM public.find_potential_duplicate_player(org_a, '5559998888');

  INSERT INTO public.__mig041_claim_test_results VALUES (
    'create_with_unmatched_phone_is_only_match',
    v_stp_new IS NOT NULL AND v_count = 1,
    format('stp_id=%s matches=%s', v_stp_new, v_count)
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig041_claim_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed
  FROM public.__mig041_claim_test_results
  WHERE NOT passed;

  IF v_failed > 0 THEN
    RAISE EXCEPTION '041_player_claim_and_phone_dedup: % test(s) failed', v_failed;
  END IF;
END;
$$;
