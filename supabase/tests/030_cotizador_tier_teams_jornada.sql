-- Migration 030: plan tier, team status, match void, jornada summaries
-- Run with: psql ... -f supabase/tests/030_cotizador_tier_teams_jornada.sql

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS __mig030_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
);

DO $$
DECLARE
  org_a uuid;
  org_b uuid;
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  comp_a uuid;
  season_a uuid;
  team1 uuid;
  team2 uuid;
  st1 uuid;
  st2 uuid;
  match_future uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (owner_a, 'mig030-owner-a@test.local'),
    (owner_b, 'mig030-owner-b@test.local');

  INSERT INTO public.profiles (id, full_name) VALUES
    (owner_a, 'Owner A'),
    (owner_b, 'Owner B');

  INSERT INTO public.organizations (id, name, slug, created_by)
  VALUES (gen_random_uuid(), 'Org A 030', 'org-a-030', owner_a)
  RETURNING id INTO org_a;

  INSERT INTO public.organizations (id, name, slug, created_by)
  VALUES (gen_random_uuid(), 'Org B 030', 'org-b-030', owner_b)
  RETURNING id INTO org_b;

  INSERT INTO public.organization_members (organization_id, profile_id, role)
  VALUES (org_a, owner_a, 'organization_owner');

  -- Default plan_tier basico
  INSERT INTO public.__mig030_results
  SELECT '01_default_plan_basico', plan_tier = 'basico', plan_tier
  FROM public.organizations WHERE id = org_a;

  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Premium gate rejects jornada enqueue
  INSERT INTO public.competitions (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'Comp A') RETURNING id INTO comp_a;

  INSERT INTO public.seasons (
    id, competition_id, organization_id, name, slug, format_type, visibility
  ) VALUES (
    gen_random_uuid(), comp_a, org_a, 'Temp A', 'temp-a-030', 'round_robin', 'draft'
  ) RETURNING id INTO season_a;

  BEGIN
    PERFORM public.enqueue_jornada_summary(season_a, 1, 'test prompt');
    INSERT INTO public.__mig030_results VALUES (
      '02_premium_gate_rejects', false, 'should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.__mig030_results VALUES (
      '02_premium_gate_rejects', true, SQLERRM
    );
  END;

  EXECUTE 'RESET ROLE';

  -- Platform staff sets premium
  INSERT INTO public.platform_staff (profile_id) VALUES (owner_b);
  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  PERFORM public.set_organization_plan_tier(org_a, 'premium');

  INSERT INTO public.__mig030_results
  SELECT '03_set_premium_ok', plan_tier = 'premium', plan_tier
  FROM public.organizations WHERE id = org_a;

  EXECUTE 'RESET ROLE';

  -- Team status + void future match
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.teams (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'T1') RETURNING id INTO team1;
  INSERT INTO public.teams (id, organization_id, name)
  VALUES (gen_random_uuid(), org_a, 'T2') RETURNING id INTO team2;

  st1 := public.enroll_team_in_season(season_a, team1, NULL, NULL, 'confirmed');
  st2 := public.enroll_team_in_season(season_a, team2, NULL, NULL, 'confirmed');

  INSERT INTO public.matches (
    season_id, organization_id, home_season_team_id, away_season_team_id,
    status, round_number, leg_number, sequence_in_round
  ) VALUES (
    season_a, org_a, st1, st2, 'scheduled', 1, 1, 1
  ) RETURNING id INTO match_future;

  PERFORM public.set_season_team_status(st1, 'retirado', 'baja del club');

  INSERT INTO public.__mig030_results
  SELECT
    '04_future_match_voided',
    voided_at IS NOT NULL AND void_reason = 'equipo retirado',
    COALESCE(void_reason, 'null')
  FROM public.matches WHERE id = match_future;

  EXECUTE 'RESET ROLE';
END $$;

SELECT test_name, passed, detail FROM public.__mig030_results ORDER BY test_name;

ROLLBACK;
