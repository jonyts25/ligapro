-- Organization-wide live matchday (matches on a local date)

CREATE OR REPLACE FUNCTION public.get_organization_matchday(
  p_organization_id uuid,
  p_date date
)
RETURNS TABLE (
  match_id uuid,
  season_id uuid,
  competition_id uuid,
  season_name text,
  competition_name text,
  home_team_name text,
  away_team_name text,
  home_team_logo_path text,
  away_team_logo_path text,
  starts_at timestamptz,
  venue_name text,
  field_name text,
  status text,
  home_score integer,
  away_score integer,
  is_result_official boolean,
  has_confirmed_referee boolean,
  has_open_dispute boolean,
  home_validated_count integer,
  away_validated_count integer,
  match_duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_member_of(p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to read organization matchday'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS match_id,
    s.id AS season_id,
    s.competition_id AS competition_id,
    s.name AS season_name,
    c.name AS competition_name,
    COALESCE(NULLIF(btrim(st_home.display_name), ''), th.name) AS home_team_name,
    COALESCE(NULLIF(btrim(st_away.display_name), ''), ta.name) AS away_team_name,
    th.logo_path AS home_team_logo_path,
    ta.logo_path AS away_team_logo_path,
    fr.starts_at AS starts_at,
    v.name AS venue_name,
    f.name AS field_name,
    m.status AS status,
    m.home_score AS home_score,
    m.away_score AS away_score,
    (m.result_approved_at IS NOT NULL) AS is_result_official,
    EXISTS (
      SELECT 1
      FROM public.match_officials mo
      WHERE mo.match_id = m.id
        AND mo.role = 'referee'
        AND mo.status = 'confirmed'
    ) AS has_confirmed_referee,
    EXISTS (
      SELECT 1
      FROM public.match_result_disputes d
      WHERE d.match_id = m.id
        AND d.status = 'open'
    ) AS has_open_dispute,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_participants mp
      JOIN public.season_team_players stp ON stp.id = mp.season_team_player_id
      WHERE mp.match_id = m.id
        AND mp.status = 'played'
        AND stp.season_team_id = m.home_season_team_id
    ), 0) AS home_validated_count,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.match_participants mp
      JOIN public.season_team_players stp ON stp.id = mp.season_team_player_id
      WHERE mp.match_id = m.id
        AND mp.status = 'played'
        AND stp.season_team_id = m.away_season_team_id
    ), 0) AS away_validated_count,
    COALESCE(sr.match_duration_minutes, 90)::integer AS match_duration_minutes
  FROM public.matches m
  INNER JOIN public.seasons s
    ON s.id = m.season_id
    AND s.organization_id = p_organization_id
    AND s.visibility <> 'archived'
  INNER JOIN public.competitions c ON c.id = s.competition_id
  INNER JOIN public.field_reservations fr
    ON fr.match_id = m.id
    AND fr.status = 'confirmed'
    AND (fr.starts_at AT TIME ZONE 'America/Mexico_City')::date = p_date
  INNER JOIN public.season_teams st_home ON st_home.id = m.home_season_team_id
  INNER JOIN public.season_teams st_away ON st_away.id = m.away_season_team_id
  INNER JOIN public.teams th ON th.id = st_home.team_id
  INNER JOIN public.teams ta ON ta.id = st_away.team_id
  LEFT JOIN public.season_rules sr
    ON sr.season_id = s.id
    AND sr.organization_id = p_organization_id
  LEFT JOIN public.fields f ON f.id = fr.field_id
  LEFT JOIN public.venues v ON v.id = f.venue_id
  WHERE m.organization_id = p_organization_id
  ORDER BY fr.starts_at ASC NULLS LAST, m.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organization_matchday(uuid, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_organization_matchday(uuid, date)
  TO authenticated;
