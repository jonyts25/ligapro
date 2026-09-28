-- Migration 042 (step 3.4): generic player profile claim invite + phone dedup helpers

CREATE OR REPLACE FUNCTION public.invite_player_to_roster(
  p_season_team_player_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_invitation_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_player_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_email := lower(btrim(COALESCE(p_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id
  INTO v_org
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.captain_invitations
  SET status = 'cancelled'
  WHERE season_team_player_id = p_season_team_player_id
    AND status = 'pending';

  INSERT INTO public.captain_invitations (
    organization_id,
    season_team_player_id,
    email,
    invited_by_profile_id,
    expires_at
  ) VALUES (
    v_org,
    p_season_team_player_id,
    v_email,
    v_uid,
    now() + interval '7 days'
  )
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_potential_duplicate_player(
  p_organization_id uuid,
  p_phone text
)
RETURNS TABLE (
  player_id uuid,
  full_name text,
  is_claimed boolean,
  teams_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    p_organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_phone := NULLIF(btrim(COALESCE(p_phone, '')), '');
  IF v_phone IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    (p.profile_id IS NOT NULL) AS is_claimed,
    (
      SELECT count(*)::integer
      FROM public.season_team_players stp
      WHERE stp.player_id = p.id
    ) AS teams_count
  FROM public.players p
  WHERE p.organization_id = p_organization_id
    AND NULLIF(btrim(COALESCE(p.phone, '')), '') IS NOT NULL
    AND btrim(p.phone) = v_phone
  ORDER BY p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_existing_player_to_roster(
  p_player_id uuid,
  p_season_team_id uuid,
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
  v_season_id uuid;
  v_player_org uuid;
  v_status text;
  v_existing public.season_team_players;
  v_id uuid;
  v_is_admin boolean;
  v_is_leader boolean;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL OR p_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team id and player id are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id, st.season_id
  INTO v_org_id, v_season_id
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

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );
  v_is_leader := public.is_active_captain_or_vice_of_season_team(
    p_season_team_id,
    v_uid
  );

  IF NOT v_is_admin AND NOT v_is_leader THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_leader AND NOT v_is_admin THEN
    PERFORM public.__assert_captain_roster_add_allowed(p_season_team_id);
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_registration_status), ''), 'active');
  IF v_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid registration_status'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'active' THEN
    PERFORM public.__assert_player_activation_allowed(
      p_player_id,
      v_season_id,
      p_season_team_id,
      v_is_admin
    );
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
    RAISE EXCEPTION 'Player is already on this roster'
      USING ERRCODE = 'P0001';
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

REVOKE ALL ON FUNCTION public.invite_player_to_roster(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_potential_duplicate_player(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_existing_player_to_roster(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_player_to_roster(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_potential_duplicate_player(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_existing_player_to_roster(uuid, uuid, integer, text) TO authenticated;
