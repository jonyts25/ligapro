-- Public read RPCs for individual match pages (chronicle UI companion)
-- Adds match_id to get_public_season_matches for linking from public lists.

DROP FUNCTION IF EXISTS public.get_public_season_matches(uuid, text);

CREATE FUNCTION public.get_public_season_matches(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  match_id uuid,
  round_label text,
  round_number integer,
  sequence_in_round integer,
  home_team_name text,
  away_team_name text,
  status text,
  calendar_status text,
  home_score integer,
  away_score integer,
  starts_at timestamptz,
  venue_name text,
  field_name text,
  knockout_round_number integer,
  bracket_slot integer,
  leg_number integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id AS match_id,
    COALESCE(kr.round_label, m.round_label) AS round_label,
    COALESCE(kr.round_number, m.round_number) AS round_number,
    m.sequence_in_round,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name) AS home_team_name,
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name) AS away_team_name,
    m.status,
    m.calendar_status,
    m.home_score,
    m.away_score,
    fr.starts_at,
    v.name AS venue_name,
    f.name AS field_name,
    kr.round_number AS knockout_round_number,
    m.bracket_slot,
    m.leg_number
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.season_knockout_rounds kr ON kr.id = m.knockout_round_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  LEFT JOIN public.fields f ON f.id = fr.field_id
  LEFT JOIN public.venues v ON v.id = f.venue_id
  WHERE m.season_id = v_season_id
  ORDER BY
    kr.round_number NULLS LAST,
    m.round_number NULLS LAST,
    m.bracket_slot NULLS LAST,
    m.leg_number NULLS LAST,
    m.sequence_in_round NULLS LAST,
    fr.starts_at NULLS LAST,
    m.created_at ASC,
    m.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_season_matches(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_season_matches(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_match_detail(
  p_organization_id uuid,
  p_season_slug text,
  p_match_id uuid
)
RETURNS TABLE (
  match_id uuid,
  home_team_name text,
  away_team_name text,
  status text,
  home_score integer,
  away_score integer,
  starts_at timestamptz,
  venue_name text,
  field_name text,
  round_label text,
  round_number integer,
  leg_number integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name),
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name),
    m.status,
    m.home_score,
    m.away_score,
    fr.starts_at,
    v.name,
    f.name,
    COALESCE(kr.round_label, m.round_label),
    COALESCE(kr.round_number, m.round_number),
    m.leg_number
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.season_knockout_rounds kr ON kr.id = m.knockout_round_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  LEFT JOIN public.fields f ON f.id = fr.field_id
  LEFT JOIN public.venues v ON v.id = f.venue_id
  WHERE m.season_id = v_season_id
    AND m.id = p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_match_detail(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_match_detail(uuid, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_match_events(
  p_organization_id uuid,
  p_season_slug text,
  p_match_id uuid
)
RETURNS TABLE (
  minute integer,
  event_type text,
  player_name text,
  team_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    me.minute,
    me.event_type,
    p.full_name AS player_name,
    COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name
  FROM public.match_events me
  JOIN public.matches m ON m.id = me.match_id
  JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
  JOIN public.players p ON p.id = stp.player_id
  JOIN public.season_teams st ON st.id = stp.season_team_id
  JOIN public.teams t ON t.id = st.team_id
  WHERE m.season_id = v_season_id
    AND m.id = p_match_id
    AND me.voided_at IS NULL
    AND me.event_type IN ('goal', 'own_goal', 'yellow_card', 'red_card')
  ORDER BY me.minute ASC, me.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_match_events(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_match_events(uuid, text, uuid) TO anon, authenticated;
