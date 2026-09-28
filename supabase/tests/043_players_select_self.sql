-- Migration 043 (step 3.2): players_select_self + captain roster join fix
--
-- PREREQUISITE: apply supabase/migrations/20261002100000_players_select_self.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/043_players_select_self.sql

DROP TABLE IF EXISTS public.__mig043_test_results;
CREATE TABLE public.__mig043_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig043_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig043_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0431';
  uid_captain uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0431';
  uid_other uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0431';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  team_a uuid;
  st_a uuid;
  player_captain uuid;
  player_other uuid;
  v_count integer;
  v_team_name text;
  v_can_read_other boolean;
BEGIN
  DELETE FROM public.organizations WHERE slug = 'org-mig043-self';
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_captain, uid_other);

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', uid_owner, 'authenticated', 'authenticated',
     'owner@ligapro-mig043.local', '$2a$06$testhashligapromigration043aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_captain, 'authenticated', 'authenticated',
     'captain@ligapro-mig043.local', '$2a$06$testhashligapromigration043aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_other, 'authenticated', 'authenticated',
     'other@ligapro-mig043.local', '$2a$06$testhashligapromigration043aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_owner, 'owner@ligapro-mig043.local', 'Owner 043'),
    (uid_captain, 'captain@ligapro-mig043.local', 'Captain 043'),
    (uid_other, 'other@ligapro-mig043.local', 'Other 043')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig043_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Mig043 Self');
  UPDATE public.organizations SET slug = 'org-mig043-self' WHERE id = org_a;

  INSERT INTO public.competitions (organization_id, name, slug)
  VALUES (org_a, 'Liga 043', 'liga-043')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, status)
  VALUES (org_a, competition_a, 'Temporada 043', 'temp-043', 'active')
  RETURNING id INTO season_a;

  INSERT INTO public.teams (organization_id, name)
  VALUES (org_a, 'Equipo Capitan Real')
  RETURNING id INTO team_a;

  st_a := public.enroll_team_in_season(season_a, team_a, NULL, NULL, 'confirmed');

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (org_a, 'Capitan Reclamado', uid_captain)
  RETURNING id INTO player_captain;

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (org_a, 'Otro Jugador', uid_other)
  RETURNING id INTO player_other;

  INSERT INTO public.season_team_players (
    season_team_id, player_id, organization_id, is_captain, registration_status
  ) VALUES (st_a, player_captain, org_a, true, 'active');

  PERFORM public.__mig043_as(uid_captain);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count
  FROM public.players
  WHERE id = player_captain;

  SELECT count(*) > 0 INTO v_can_read_other
  FROM public.players
  WHERE id = player_other;

  EXECUTE 'RESET ROLE';

  INSERT INTO public.__mig043_test_results VALUES (
    'players_select_self_own_row',
    v_count = 1,
    format('own_count=%s', v_count)
  );

  INSERT INTO public.__mig043_test_results VALUES (
    'players_select_self_not_other_profile',
    v_can_read_other = false,
    format('read_other=%s', v_can_read_other)
  );

  PERFORM public.__mig043_as(uid_captain);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT COALESCE(st.display_name, t.name)
  INTO v_team_name
  FROM public.season_team_players stp
  INNER JOIN public.players p
    ON p.id = stp.player_id
   AND p.profile_id = uid_captain
  JOIN public.season_teams st ON st.id = stp.season_team_id
  JOIN public.teams t ON t.id = st.team_id
  WHERE stp.registration_status = 'active'
    AND (stp.is_captain = true OR stp.is_vice_captain = true)
  LIMIT 1;

  EXECUTE 'RESET ROLE';

  INSERT INTO public.__mig043_test_results VALUES (
    'claimed_captain_inner_join_returns_team_name',
    v_team_name = 'Equipo Capitan Real',
    format('team_name=%s', v_team_name)
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig043_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT count(*) INTO v_failed
  FROM public.__mig043_test_results
  WHERE NOT passed;

  IF v_failed > 0 THEN
    RAISE EXCEPTION '043_players_select_self: % test(s) failed', v_failed;
  END IF;
END;
$$;
