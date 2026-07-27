-- Migration 030: archived-season guard on direct INSERT paths (INSERT-only scope)
-- team_charges / team_payments: extend existing enforce triggers (Migration 009)
-- season_roles / match_officials: dedicated BEFORE INSERT triggers (narrowed from 028)

-- ---------------------------------------------------------------------------
-- team_charges — season via season_teams.season_id (wrapper for_season_team)
-- Trigger: team_charges_enforce_org_matches_season_team (BEFORE INSERT, Migration 009)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_charges_enforce_org_matches_season_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
BEGIN
  SELECT st.organization_id INTO v_st_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_st_org THEN
    RAISE EXCEPTION
      'team_charges.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_st_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team(NEW.season_team_id);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- team_payments — season via season_teams.season_id (wrapper for_season_team)
-- Trigger: team_payments_enforce_org_matches_season_team (BEFORE INSERT, Migration 009)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_payments_enforce_org_matches_season_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
BEGIN
  SELECT st.organization_id INTO v_st_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_st_org THEN
    RAISE EXCEPTION
      'team_payments.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_st_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_season_team(NEW.season_team_id);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- season_roles — season_id column on row (wrapper __assert_season_not_archived)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_roles_archived_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_not_archived(NEW.season_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS season_roles_archived_write_guard ON public.season_roles;
DROP TRIGGER IF EXISTS season_roles_archived_insert_guard ON public.season_roles;
CREATE TRIGGER season_roles_archived_insert_guard
  BEFORE INSERT ON public.season_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.season_roles_archived_insert_guard();

-- ---------------------------------------------------------------------------
-- match_officials — season via matches.season_id (wrapper for_match)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_officials_archived_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(NEW.match_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_officials_archived_write_guard ON public.match_officials;
DROP TRIGGER IF EXISTS match_officials_archived_insert_guard ON public.match_officials;
CREATE TRIGGER match_officials_archived_insert_guard
  BEFORE INSERT ON public.match_officials
  FOR EACH ROW
  EXECUTE FUNCTION public.match_officials_archived_insert_guard();

COMMENT ON FUNCTION public.season_roles_archived_insert_guard() IS
  'BEFORE INSERT on season_roles: rejects when season.visibility = archived.';

COMMENT ON FUNCTION public.match_officials_archived_insert_guard() IS
  'BEFORE INSERT on match_officials: rejects when parent match season is archived.';
