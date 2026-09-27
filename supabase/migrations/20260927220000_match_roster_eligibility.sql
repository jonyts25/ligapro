-- Match roster eligibility alerts (active suspensions per player)

CREATE OR REPLACE FUNCTION public.get_match_roster_eligibility(
  p_match_id uuid
)
RETURNS TABLE (
  season_team_player_id uuid,
  is_suspended boolean,
  matches_remaining integer,
  suspension_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_member_of(v_match.organization_id) THEN
    RAISE EXCEPTION 'Not authorized to read roster eligibility for match %', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT stp.id AS season_team_player_id
    FROM public.season_team_players stp
    WHERE stp.organization_id = v_match.organization_id
      AND stp.season_team_id IN (
        v_match.home_season_team_id,
        v_match.away_season_team_id
      )
      AND stp.registration_status <> 'inactive'
  ),
  active_susp AS (
    SELECT
      ds.season_team_player_id,
      ds.matches_remaining,
      ds.suspension_type,
      ds.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY ds.season_team_player_id
        ORDER BY ds.created_at DESC
      ) AS rn
    FROM public.discipline_suspensions ds
    WHERE ds.organization_id = v_match.organization_id
      AND ds.status = 'active'
  ),
  agg AS (
    SELECT
      asp.season_team_player_id,
      COUNT(*)::integer AS active_count,
      COALESCE(SUM(asp.matches_remaining), 0)::integer AS total_remaining
    FROM active_susp asp
    GROUP BY asp.season_team_player_id
  ),
  latest AS (
    SELECT
      asp.season_team_player_id,
      asp.suspension_type
    FROM active_susp asp
    WHERE asp.rn = 1
  )
  SELECT
    r.season_team_player_id,
    COALESCE(a.active_count, 0) > 0 AS is_suspended,
    COALESCE(a.total_remaining, 0)::integer AS matches_remaining,
    l.suspension_type
  FROM roster r
  LEFT JOIN agg a ON a.season_team_player_id = r.season_team_player_id
  LEFT JOIN latest l ON l.season_team_player_id = r.season_team_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_roster_eligibility(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_roster_eligibility(uuid)
  TO authenticated;
