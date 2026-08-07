-- RPCs to capture optional match statistics for AI chronicles (post-match / admin).

CREATE OR REPLACE FUNCTION public.__assert_match_stats_access(p_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id INTO v_org
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) AND NOT public.can_capture_match(p_match_id) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_match_stats_access(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_match_team_stats(
  p_match_id uuid,
  p_season_team_id uuid,
  p_shots integer DEFAULT NULL,
  p_shots_on_target integer DEFAULT NULL,
  p_possession_pct numeric DEFAULT NULL,
  p_corners integer DEFAULT NULL,
  p_fouls integer DEFAULT NULL,
  p_offsides integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_row_id uuid;
BEGIN
  v_org := public.__assert_match_stats_access(p_match_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        m.home_season_team_id = p_season_team_id
        OR m.away_season_team_id = p_season_team_id
      )
  ) THEN
    RAISE EXCEPTION 'Season team does not belong to this match'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_team_stats (
    match_id,
    organization_id,
    season_team_id,
    shots,
    shots_on_target,
    possession_pct,
    corners,
    fouls,
    offsides
  ) VALUES (
    p_match_id,
    v_org,
    p_season_team_id,
    p_shots,
    p_shots_on_target,
    p_possession_pct,
    p_corners,
    p_fouls,
    p_offsides
  )
  ON CONFLICT (match_id, season_team_id) DO UPDATE SET
    shots = EXCLUDED.shots,
    shots_on_target = EXCLUDED.shots_on_target,
    possession_pct = EXCLUDED.possession_pct,
    corners = EXCLUDED.corners,
    fouls = EXCLUDED.fouls,
    offsides = EXCLUDED.offsides,
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_match_player_stats(
  p_match_id uuid,
  p_season_team_player_id uuid,
  p_minutes_played integer DEFAULT NULL,
  p_passes_completed integer DEFAULT NULL,
  p_passes_attempted integer DEFAULT NULL,
  p_shots integer DEFAULT NULL,
  p_shots_on_target integer DEFAULT NULL,
  p_distance_km numeric DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_is_man_of_match boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_row_id uuid;
BEGIN
  v_org := public.__assert_match_stats_access(p_match_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.season_team_players stp
    JOIN public.matches m ON m.id = p_match_id
    WHERE stp.id = p_season_team_player_id
      AND stp.organization_id = v_org
      AND (
        stp.season_team_id = m.home_season_team_id
        OR stp.season_team_id = m.away_season_team_id
      )
  ) THEN
    RAISE EXCEPTION 'Player does not belong to this match'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_is_man_of_match THEN
    UPDATE public.match_player_stats
    SET is_man_of_match = false
    WHERE match_id = p_match_id
      AND is_man_of_match = true;
  END IF;

  INSERT INTO public.match_player_stats (
    match_id,
    organization_id,
    season_team_player_id,
    minutes_played,
    passes_completed,
    passes_attempted,
    shots,
    shots_on_target,
    distance_km,
    rating,
    is_man_of_match
  ) VALUES (
    p_match_id,
    v_org,
    p_season_team_player_id,
    p_minutes_played,
    p_passes_completed,
    p_passes_attempted,
    p_shots,
    p_shots_on_target,
    p_distance_km,
    p_rating,
    COALESCE(p_is_man_of_match, false)
  )
  ON CONFLICT (match_id, season_team_player_id) DO UPDATE SET
    minutes_played = EXCLUDED.minutes_played,
    passes_completed = EXCLUDED.passes_completed,
    passes_attempted = EXCLUDED.passes_attempted,
    shots = EXCLUDED.shots,
    shots_on_target = EXCLUDED.shots_on_target,
    distance_km = EXCLUDED.distance_km,
    rating = EXCLUDED.rating,
    is_man_of_match = EXCLUDED.is_man_of_match,
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_match_context(
  p_match_id uuid,
  p_attendance integer DEFAULT NULL,
  p_weather text DEFAULT NULL,
  p_referee_name text DEFAULT NULL,
  p_highlight_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_row_id uuid;
BEGIN
  v_org := public.__assert_match_stats_access(p_match_id);

  INSERT INTO public.match_context (
    match_id,
    organization_id,
    attendance,
    weather,
    referee_name,
    highlight_note
  ) VALUES (
    p_match_id,
    v_org,
    p_attendance,
    NULLIF(btrim(COALESCE(p_weather, '')), ''),
    NULLIF(btrim(COALESCE(p_referee_name, '')), ''),
    NULLIF(btrim(COALESCE(p_highlight_note, '')), '')
  )
  ON CONFLICT (match_id) DO UPDATE SET
    attendance = EXCLUDED.attendance,
    weather = EXCLUDED.weather,
    referee_name = EXCLUDED.referee_name,
    highlight_note = EXCLUDED.highlight_note,
    updated_at = now()
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_team_stats(uuid, uuid, integer, integer, numeric, integer, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_match_player_stats(uuid, uuid, integer, integer, integer, integer, integer, numeric, numeric, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_match_context(uuid, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_match_team_stats(uuid, uuid, integer, integer, numeric, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_match_player_stats(uuid, uuid, integer, integer, integer, integer, integer, numeric, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_match_context(uuid, integer, text, text, text) TO authenticated;
