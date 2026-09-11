-- Block closing a match when both teams have zero active roster players.

CREATE OR REPLACE FUNCTION public.__assert_match_teams_have_active_roster_for_close(
  p_home_season_team_id uuid,
  p_away_season_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_home_active integer;
  v_away_active integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_home_active
  FROM public.season_team_players
  WHERE season_team_id = p_home_season_team_id
    AND registration_status = 'active';

  SELECT COUNT(*)::integer INTO v_away_active
  FROM public.season_team_players
  WHERE season_team_id = p_away_season_team_id
    AND registration_status = 'active';

  IF COALESCE(v_home_active, 0) = 0 AND COALESCE(v_away_active, 0) = 0 THEN
    RAISE EXCEPTION
      'Neither team has active players on the roster to close this match'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_match_result(
  p_match_id uuid,
  p_status text,
  p_home_score integer,
  p_away_score integer
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
  v_is_privileged boolean;
  v_is_confirmed_referee boolean;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  v_is_privileged := (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
  );
  v_is_confirmed_referee := public.is_confirmed_match_referee(p_match_id);

  IF NOT (v_is_privileged OR v_is_confirmed_referee) THEN
    RAISE EXCEPTION
      'Not authorized to update match result for match %',
      p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_confirmed_referee AND NOT v_is_privileged THEN
    IF v_match.status IN ('finished', 'walkover', 'cancelled') THEN
      RAISE EXCEPTION
        'Confirmed referee cannot modify a closed match result'
        USING ERRCODE = 'P0001';
    END IF;

    IF p_status NOT IN ('finished', 'walkover') THEN
      RAISE EXCEPTION
        'Confirmed referee can only set status to finished or walkover'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  IF p_status IN ('finished', 'walkover') THEN
    PERFORM public.__assert_match_teams_have_active_roster_for_close(
      v_match.home_season_team_id,
      v_match.away_season_team_id
    );
  END IF;

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  IF p_status IN ('finished', 'walkover', 'cancelled') THEN
    UPDATE public.match_officials
    SET
      invite_expires_at = now(),
      updated_at = now()
    WHERE match_id = p_match_id
      AND invite_token IS NOT NULL
      AND (invite_expires_at IS NULL OR invite_expires_at > now());
  END IF;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_update_match_result(
  p_token uuid,
  p_match_id uuid,
  p_status text,
  p_home_score integer,
  p_away_score integer
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_official public.match_officials;
  v_match public.matches;
BEGIN
  v_official := public.__fetch_valid_guest_official(p_token, p_match_id, true);

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_match.status IN ('finished', 'walkover', 'cancelled') THEN
    RAISE EXCEPTION
      'Confirmed referee cannot modify a closed match result'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_status NOT IN ('finished', 'walkover') THEN
    RAISE EXCEPTION
      'Confirmed referee can only set status to finished or walkover'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  PERFORM public.__assert_match_teams_have_active_roster_for_close(
    v_match.home_season_team_id,
    v_match.away_season_team_id
  );

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  PERFORM public.set_match_context(
    p_match_id,
    NULL,
    NULL,
    v_official.guest_name,
    NULL
  );

  UPDATE public.match_officials
  SET
    invite_expires_at = now(),
    updated_at = now()
  WHERE id = v_official.id;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_match_teams_have_active_roster_for_close(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__assert_match_teams_have_active_roster_for_close(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_match_result(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_match_result(uuid, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.guest_update_match_result(uuid, uuid, text, integer, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_update_match_result(uuid, uuid, text, integer, integer)
  TO anon, authenticated;
