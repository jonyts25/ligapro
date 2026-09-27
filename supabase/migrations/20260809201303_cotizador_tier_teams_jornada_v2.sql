-- Migration 030b: reconcile cotizador migration history with ligapro-dev
--
-- ligapro-dev has this version recorded in schema_migrations; the repo previously
-- only had 20260808200000_cotizador_tier_teams_jornada.sql (v1). Investigation
-- (docs/reports/0.2_REPORT.md) found no additional schema objects beyond v1:
-- database.ts (generated from dev), app RPC usage, ADRs 0015–0018, and test
-- 030 all align with v1. v2 on dev was likely applied manually via MCP as a
-- history marker or idempotent re-run, similar to harden_create_player_grants.
--
-- Fresh installs: v1 creates all objects; this migration is idempotent and
-- reaffirms authenticated-only grants on the cotizador RPC bundle.

REVOKE ALL ON FUNCTION public.organization_has_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_has_premium(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_organization_plan_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_organization_plan_tier(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_platform_organizations_billing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_organizations_billing() TO authenticated;

REVOKE ALL ON FUNCTION public.void_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_season_team_status(uuid, text, text, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_team_status(uuid, text, text, timestamptz)
  TO authenticated;

REVOKE ALL ON FUNCTION public.enqueue_jornada_summary(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_jornada_summary(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_teams_bulk(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_teams_bulk(uuid, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.create_players_and_add_to_roster_bulk(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_players_and_add_to_roster_bulk(uuid, jsonb)
  TO authenticated;

REVOKE ALL ON TABLE public.jornada_summaries FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.jornada_summaries TO authenticated;
