-- Migration 044 (step 3.3): get_my_player_stats + can_view_player_photo self
--
-- PREREQUISITE: apply supabase/migrations/20261003100000_get_my_player_stats.sql
--
-- Run:
--   npx supabase db query --linked -f supabase/tests/044_get_my_player_stats.sql

DROP TABLE IF EXISTS public.__mig044_test_results;
CREATE TABLE public.__mig044_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);
ALTER TABLE public.__mig044_test_results DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.__mig044_as(p_uid uuid)
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
  uid_owner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0441';
  uid_player uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0441';
  uid_other uuid := 'cccccccc-cccc-cccc-cccc-cccccccc0441';
  org_a uuid;
  competition_a uuid;
  season_a uuid;
  team_h uuid;
  team_a uuid;
  st_h uuid;
  st_a uuid;
  player_self uuid;
  player_other uuid;
  stp_self uuid;
  stp_other uuid;
  match_open uuid;
  v_row record;
  v_count integer;
  v_can_photo boolean;
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
  ALTER TABLE public.matches DISABLE TRIGGER USER;
  ALTER TABLE public.match_events DISABLE TRIGGER USER;
  ALTER TABLE public.match_participants DISABLE TRIGGER USER;

  DELETE FROM public.match_events WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE slug = 'org-mig044-stats'
  );
  DELETE FROM public.organizations WHERE slug = 'org-mig044-stats';
  DELETE FROM auth.users WHERE id IN (uid_owner, uid_player, uid_other);

  ALTER TABLE public.match_participants ENABLE TRIGGER USER;
  ALTER TABLE public.match_events ENABLE TRIGGER USER;
  ALTER TABLE public.matches ENABLE TRIGGER USER;
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
     'owner@ligapro-mig044.local', '$2a$06$testhashligapromigration044aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_player, 'authenticated', 'authenticated',
     'player@ligapro-mig044.local', '$2a$06$testhashligapromigration044aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_other, 'authenticated', 'authenticated',
     'other@ligapro-mig044.local', '$2a$06$testhashligapromigration044aa', now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (uid_owner, 'owner@ligapro-mig044.local', 'Owner 044'),
    (uid_player, 'player@ligapro-mig044.local', 'Player 044'),
    (uid_other, 'other@ligapro-mig044.local', 'Other 044')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM public.__mig044_as(uid_owner);
  org_a := public.create_organization_with_owner('Org Mig044 Stats');
  UPDATE public.organizations SET slug = 'org-mig044-stats' WHERE id = org_a;

  INSERT INTO public.competitions (organization_id, name, slug)
  VALUES (org_a, 'Liga 044', 'liga-044')
  RETURNING id INTO competition_a;

  INSERT INTO public.seasons (organization_id, competition_id, name, slug, status)
  VALUES (org_a, competition_a, 'Apertura 044', 'apertura-044', 'active')
  RETURNING id INTO season_a;

  INSERT INTO public.season_rules (organization_id, season_id, match_duration_minutes)
  VALUES (org_a, season_a, 90);

  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Local 044') RETURNING id INTO team_h;
  INSERT INTO public.teams (organization_id, name) VALUES (org_a, 'Visit 044') RETURNING id INTO team_a;

  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_h) RETURNING id INTO st_h;
  INSERT INTO public.season_teams (organization_id, season_id, team_id)
  VALUES (org_a, season_a, team_a) RETURNING id INTO st_a;

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (org_a, 'Jugador Propio', uid_player)
  RETURNING id INTO player_self;

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (org_a, 'Jugador Ajeno', uid_other)
  RETURNING id INTO player_other;

  INSERT INTO public.season_team_players (
    organization_id, season_id, season_team_id, player_id, registration_status
  ) VALUES (org_a, season_a, st_h, player_self, 'active') RETURNING id INTO stp_self;

  INSERT INTO public.season_team_players (
    organization_id, season_id, season_team_id, player_id, registration_status
  ) VALUES (org_a, season_a, st_a, player_other, 'active') RETURNING id INTO stp_other;

  INSERT INTO public.matches (
    organization_id, season_id, home_season_team_id, away_season_team_id, status
  ) VALUES (org_a, season_a, st_h, st_a, 'scheduled') RETURNING id INTO match_open;

  INSERT INTO public.match_participants (
    match_id, season_team_player_id, organization_id, status
  ) VALUES
    (match_open, stp_self, org_a, 'played'),
    (match_open, stp_other, org_a, 'played');

  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute
  ) VALUES
    (match_open, org_a, stp_self, 'goal', 10),
    (match_open, org_a, stp_self, 'yellow_card', 20),
    (match_open, org_a, stp_self, 'own_goal', 30);

  INSERT INTO public.match_events (
    match_id, organization_id, season_team_player_id, event_type, minute,
    assist_season_team_player_id
  ) VALUES
    (match_open, org_a, stp_other, 'goal', 40, stp_self);

  INSERT INTO public.match_events (
    match_id,
    organization_id,
    season_team_player_id,
    event_type,
    minute,
    voided_at,
    void_reason,
    voided_by_profile_id
  ) VALUES (
    match_open,
    org_a,
    stp_self,
    'goal',
    50,
    now(),
    'test void',
    uid_owner
  );

  PERFORM public.set_player_photo(
    player_self,
    org_a::text || '/' || player_self::text || '/44444444-4444-4444-4444-444444444444.webp'
  );

  PERFORM public.__mig044_as(uid_player);

  SELECT * INTO v_row
  FROM public.get_my_player_stats(ARRAY[stp_self, stp_other])
  WHERE season_team_player_id = stp_self;

  INSERT INTO public.__mig044_test_results VALUES (
    '01_own_stats_correct',
    v_row.season_team_player_id = stp_self
      AND v_row.matches_played = 1
      AND v_row.goals = 1
      AND v_row.assists = 1
      AND v_row.own_goals = 1
      AND v_row.yellow_cards = 1
      AND v_row.red_cards = 0,
    format(
      'mp=%s g=%s a=%s og=%s yc=%s rc=%s',
      v_row.matches_played, v_row.goals, v_row.assists,
      v_row.own_goals, v_row.yellow_cards, v_row.red_cards
    )
  );

  SELECT COUNT(*)::integer INTO v_count
  FROM public.get_my_player_stats(ARRAY[stp_self, stp_other])
  WHERE season_team_player_id = stp_other;

  INSERT INTO public.__mig044_test_results VALUES (
    '02_foreign_stp_silently_excluded',
    v_count = 0,
    v_count::text
  );

  SELECT public.can_view_player_photo(player_self) INTO v_can_photo;
  INSERT INTO public.__mig044_test_results VALUES (
    '03_claimed_player_views_own_photo',
    v_can_photo = true,
    coalesce(v_can_photo::text, 'null')
  );
END;
$$;

SELECT test_name, passed, details
FROM public.__mig044_test_results
ORDER BY test_name;

DO $$
DECLARE
  v_failed integer;
BEGIN
  SELECT COUNT(*) INTO v_failed
  FROM public.__mig044_test_results
  WHERE NOT passed;

  IF v_failed > 0 THEN
    RAISE EXCEPTION '% test(s) failed in 044_get_my_player_stats', v_failed;
  END IF;
END;
$$;
