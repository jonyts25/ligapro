-- Migration 014: atomic team enrollment and roster management RPCs
-- Reuses set_season_team_captain from Migration 004.
-- Soft-remove roster rows via registration_status = inactive (no DELETE from UI).

-- ---------------------------------------------------------------------------
-- enroll_team_in_season
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enroll_team_in_season(
  p_season_id uuid,
  p_team_id uuid,
  p_display_name text DEFAULT NULL,
  p_group_name text DEFAULT NULL,
  p_registration_status text DEFAULT 'registered'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season_org uuid;
  v_team_org uuid;
  v_status text;
  v_display text;
  v_group text;
  v_season_team_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_team_id IS NULL THEN
    RAISE EXCEPTION 'Season id and team id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT t.organization_id INTO v_team_org
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF v_team_org IS NULL THEN
    RAISE EXCEPTION 'Team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_season_org IS DISTINCT FROM v_team_org THEN
    RAISE EXCEPTION 'Team and season must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_season_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'registered');
  IF v_status NOT IN ('registered', 'confirmed', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  v_display := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_group := NULLIF(btrim(COALESCE(p_group_name, '')), '');

  IF v_display IS NOT NULL AND char_length(v_display) > 100 THEN
    RAISE EXCEPTION 'Display name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_group IS NOT NULL AND char_length(v_group) > 100 THEN
    RAISE EXCEPTION 'Group name must be at most 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.season_teams (
    season_id,
    team_id,
    organization_id,
    display_name,
    group_name,
    registration_status
  ) VALUES (
    p_season_id,
    p_team_id,
    v_season_org,
    v_display,
    v_group,
    v_status
  )
  RETURNING id INTO v_season_team_id;

  RETURN v_season_team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_team_in_season(uuid, uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_team_in_season(uuid, uuid, text, text, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- add_player_to_season_team
-- Inserts or reactivates an existing roster row (UNIQUE season_team + player).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_player_to_season_team(
  p_season_team_id uuid,
  p_player_id uuid,
  p_jersey_number integer DEFAULT NULL,
  p_registration_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_player_org uuid;
  v_status text;
  v_existing public.season_team_players;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL OR p_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team id and player id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT p.organization_id INTO v_player_org
  FROM public.players p
  WHERE p.id = p_player_id;

  IF v_player_org IS NULL THEN
    RAISE EXCEPTION 'Player not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_org_id IS DISTINCT FROM v_player_org THEN
    RAISE EXCEPTION 'Player and season team must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'active');
  IF v_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_jersey_number IS NOT NULL AND p_jersey_number <= 0 THEN
    RAISE EXCEPTION 'Jersey number must be greater than zero'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.season_team_players stp
  WHERE stp.season_team_id = p_season_team_id
    AND stp.player_id = p_player_id;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.registration_status = 'active' THEN
      RAISE EXCEPTION 'Player is already on this roster'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.season_team_players
    SET
      registration_status = v_status,
      jersey_number = p_jersey_number,
      is_captain = false
    WHERE id = v_existing.id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  INSERT INTO public.season_team_players (
    season_team_id,
    player_id,
    organization_id,
    jersey_number,
    is_captain,
    registration_status
  ) VALUES (
    p_season_team_id,
    p_player_id,
    v_org_id,
    p_jersey_number,
    false,
    v_status
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_player_to_season_team(uuid, uuid, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_player_to_season_team(uuid, uuid, integer, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- create_player_and_add_to_roster
-- Creates player (profile_id NULL) + roster entry atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_player_and_add_to_roster(
  p_season_team_id uuid,
  p_full_name text,
  p_jersey_number integer DEFAULT NULL,
  p_registration_status text DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_name text;
  v_player_id uuid;
  v_stp_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_full_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Player name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.players (organization_id, full_name, profile_id)
  VALUES (v_org_id, v_name, NULL)
  RETURNING id INTO v_player_id;

  v_stp_id := public.add_player_to_season_team(
    p_season_team_id,
    v_player_id,
    p_jersey_number,
    p_registration_status
  );

  RETURN v_stp_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_player_and_add_to_roster(uuid, text, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_player_and_add_to_roster(uuid, text, integer, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- deactivate_season_team_player
-- Soft-remove from roster: clears captaincy and sets inactive. Keeps players row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deactivate_season_team_player(
  p_season_team_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id INTO v_org_id
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_team_players
  SET
    is_captain = false,
    registration_status = 'inactive'
  WHERE id = p_season_team_player_id
    AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to deactivate roster entry'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_season_team_player(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_season_team_player(uuid)
  TO authenticated;
