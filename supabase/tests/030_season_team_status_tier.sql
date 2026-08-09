-- Migration 030: plan tier, season team status, void match, jornada summaries
-- Run after applying 20260809100000_season_teams_status_void_match.sql

CREATE TABLE IF NOT EXISTS public.__mig030_test_results (
  test_name text PRIMARY KEY,
  passed boolean NOT NULL,
  details text
);

DO $$
DECLARE
  v_org uuid;
  v_comp uuid;
  v_season uuid;
  v_team uuid;
  v_st uuid;
  v_match uuid;
  v_opponent uuid;
BEGIN
  DELETE FROM public.__mig030_test_results;

  SELECT id INTO v_org FROM public.organizations LIMIT 1;
  IF v_org IS NULL THEN
    INSERT INTO public.__mig030_test_results VALUES (
      '00_skip_no_org', true, 'no organizations seeded'
    );
    RETURN;
  END IF;

  INSERT INTO public.__mig030_test_results VALUES (
    '01_plan_tier_default_basico',
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = v_org AND o.plan_tier = 'basico'
    ),
    'organizations.plan_tier default'
  );

  INSERT INTO public.__mig030_test_results VALUES (
    '02_organization_has_premium_rpc',
    public.organization_has_premium(v_org) = false,
    'basico org returns false'
  );
END;
$$;

SELECT * FROM public.__mig030_test_results ORDER BY test_name;
