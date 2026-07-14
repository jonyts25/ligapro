-- Migration 018: season read models + secure public wrappers (F8)
-- Standings from official match scores; scorers from goal events; discipline read-only.
-- Anon never receives SELECT on base tables.

-- ---------------------------------------------------------------------------
-- Helper: resolve season for authenticated member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__assert_season_readable(p_season_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_member_of(v_org) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.__assert_season_readable(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper: resolve public season (visibility = public only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__resolve_public_season(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_season_id uuid;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_slug := NULLIF(btrim(COALESCE(p_season_slug, '')), '');
  IF v_slug IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_season_id
  FROM public.seasons s
  WHERE s.organization_id = p_organization_id
    AND s.slug = v_slug
    AND s.visibility = 'public';

  RETURN v_season_id;
END;
$$;

REVOKE ALL ON FUNCTION public.__resolve_public_season(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_season_standings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_season_standings(p_season_id uuid)
RETURNS TABLE (
  "position" integer,
  season_team_id uuid,
  team_id uuid,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_win integer;
  v_points_draw integer;
  v_points_loss integer;
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);

  SELECT sr.points_win, sr.points_draw, sr.points_loss
  INTO v_points_win, v_points_draw, v_points_loss
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_points_win IS NULL THEN
    RAISE EXCEPTION 'Season rules not found'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  WITH teams AS (
    SELECT
      st.id AS season_team_id,
      st.team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      st.registration_status
    FROM public.season_teams st
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = p_season_id
  ),
  official AS (
    SELECT
      m.id,
      m.home_season_team_id,
      m.away_season_team_id,
      m.home_score,
      m.away_score,
      m.created_at,
      fr.starts_at
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.season_id = p_season_id
      AND m.status IN ('finished', 'walkover')
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  ),
  results AS (
    SELECT
      o.home_season_team_id AS season_team_id,
      CASE
        WHEN o.home_score > o.away_score THEN 'W'
        WHEN o.home_score < o.away_score THEN 'L'
        ELSE 'D'
      END AS result,
      o.home_score AS gf,
      o.away_score AS ga,
      COALESCE(o.starts_at, o.created_at) AS sort_at,
      o.id AS match_id
    FROM official o
    UNION ALL
    SELECT
      o.away_season_team_id,
      CASE
        WHEN o.away_score > o.home_score THEN 'W'
        WHEN o.away_score < o.home_score THEN 'L'
        ELSE 'D'
      END,
      o.away_score,
      o.home_score,
      COALESCE(o.starts_at, o.created_at),
      o.id
    FROM official o
  ),
  agg AS (
    SELECT
      t.season_team_id,
      t.team_id,
      t.team_name,
      t.registration_status,
      COALESCE(COUNT(r.match_id), 0)::integer AS played,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0)::integer AS won,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0)::integer AS drawn,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0)::integer AS lost,
      COALESCE(SUM(r.gf), 0)::integer AS goals_for,
      COALESCE(SUM(r.ga), 0)::integer AS goals_against,
      (
        COALESCE(SUM(r.gf), 0) - COALESCE(SUM(r.ga), 0)
      )::integer AS goal_difference,
      (
        COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0) * v_points_win
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0) * v_points_draw
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0) * v_points_loss
      )::integer AS points
    FROM teams t
    LEFT JOIN results r ON r.season_team_id = t.season_team_id
    GROUP BY t.season_team_id, t.team_id, t.team_name, t.registration_status
  ),
  form_ranked AS (
    SELECT
      r.season_team_id,
      r.result,
      ROW_NUMBER() OVER (
        PARTITION BY r.season_team_id
        ORDER BY r.sort_at DESC, r.match_id DESC
      ) AS rn
    FROM results r
  ),
  form_agg AS (
    SELECT
      fr.season_team_id,
      string_agg(
        CASE fr.result
          WHEN 'W' THEN 'G'
          WHEN 'D' THEN 'E'
          ELSE 'P'
        END,
        ''
        ORDER BY fr.rn DESC
      ) AS recent_form
    FROM form_ranked fr
    WHERE fr.rn <= 5
    GROUP BY fr.season_team_id
  ),
  ranked AS (
    SELECT
      a.*,
      COALESCE(f.recent_form, '') AS recent_form,
      RANK() OVER (
        ORDER BY a.points DESC, a.goal_difference DESC, a.goals_for DESC
      )::integer AS "position"
    FROM agg a
    LEFT JOIN form_agg f ON f.season_team_id = a.season_team_id
  )
  SELECT
    r."position",
    r.season_team_id,
    r.team_id,
    r.team_name,
    r.registration_status,
    r.played,
    r.won,
    r.drawn,
    r.lost,
    r.goals_for,
    r.goals_against,
    r.goal_difference,
    r.points,
    r.recent_form
  FROM ranked r
  ORDER BY r."position" ASC, r.team_name ASC, r.season_team_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_season_standings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_season_standings(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_season_top_scorers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_season_top_scorers(p_season_id uuid)
RETURNS TABLE (
  "position" integer,
  player_id uuid,
  player_name text,
  season_team_id uuid,
  team_name text,
  goals integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);

  RETURN QUERY
  WITH goals AS (
    SELECT
      p.id AS player_id,
      p.full_name AS player_name,
      st.id AS season_team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      COUNT(*)::integer AS goals
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE m.season_id = p_season_id
      AND me.event_type = 'goal'
      AND m.status <> 'cancelled'
      AND st.season_id = p_season_id
    GROUP BY p.id, p.full_name, st.id, COALESCE(NULLIF(btrim(st.display_name), ''), t.name)
  ),
  ranked AS (
    SELECT
      g.*,
      RANK() OVER (ORDER BY g.goals DESC)::integer AS "position"
    FROM goals g
  )
  SELECT
    r."position",
    r.player_id,
    r.player_name,
    r.season_team_id,
    r.team_name,
    r.goals
  FROM ranked r
  ORDER BY r."position" ASC, r.player_name ASC, r.player_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_season_top_scorers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_season_top_scorers(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_season_discipline_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_season_discipline_summary(p_season_id uuid)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  season_team_id uuid,
  team_name text,
  yellow_cards integer,
  red_cards integer,
  active_suspensions integer,
  matches_remaining integer,
  suspension_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);

  RETURN QUERY
  WITH roster AS (
    SELECT
      p.id AS player_id,
      p.full_name AS player_name,
      st.id AS season_team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      stp.id AS season_team_player_id
    FROM public.season_team_players stp
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = p_season_id
  ),
  cards AS (
    SELECT
      me.season_team_player_id,
      COUNT(*) FILTER (WHERE me.event_type = 'yellow_card')::integer AS yellow_cards,
      COUNT(*) FILTER (WHERE me.event_type = 'red_card')::integer AS red_cards
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE m.season_id = p_season_id
      AND m.status <> 'cancelled'
      AND me.event_type IN ('yellow_card', 'red_card')
    GROUP BY me.season_team_player_id
  ),
  susp AS (
    SELECT
      ds.season_team_player_id,
      COUNT(*) FILTER (WHERE ds.status = 'active')::integer AS active_suspensions,
      COALESCE(
        SUM(ds.matches_remaining) FILTER (WHERE ds.status = 'active'),
        0
      )::integer AS matches_remaining,
      CASE
        WHEN COUNT(*) FILTER (WHERE ds.status = 'active') > 0 THEN 'active'
        WHEN COUNT(*) FILTER (WHERE ds.status = 'served') > 0 THEN 'served'
        WHEN COUNT(*) FILTER (WHERE ds.status = 'waived') > 0 THEN 'waived'
        ELSE NULL
      END AS suspension_status
    FROM public.discipline_suspensions ds
    JOIN public.season_team_players stp ON stp.id = ds.season_team_player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    WHERE st.season_id = p_season_id
    GROUP BY ds.season_team_player_id
  )
  SELECT
    r.player_id,
    r.player_name,
    r.season_team_id,
    r.team_name,
    COALESCE(c.yellow_cards, 0)::integer,
    COALESCE(c.red_cards, 0)::integer,
    COALESCE(s.active_suspensions, 0)::integer,
    COALESCE(s.matches_remaining, 0)::integer,
    s.suspension_status
  FROM roster r
  LEFT JOIN cards c ON c.season_team_player_id = r.season_team_player_id
  LEFT JOIN susp s ON s.season_team_player_id = r.season_team_player_id
  WHERE COALESCE(c.yellow_cards, 0) > 0
     OR COALESCE(c.red_cards, 0) > 0
     OR COALESCE(s.active_suspensions, 0) > 0
     OR s.suspension_status IS NOT NULL
  ORDER BY
    COALESCE(s.active_suspensions, 0) DESC,
    COALESCE(s.matches_remaining, 0) DESC,
    COALESCE(c.red_cards, 0) DESC,
    COALESCE(c.yellow_cards, 0) DESC,
    r.player_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_season_discipline_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_season_discipline_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Internal standings body reuse for public (no auth assert)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__season_standings_core(p_season_id uuid)
RETURNS TABLE (
  "position" integer,
  season_team_id uuid,
  team_id uuid,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_win integer;
  v_points_draw integer;
  v_points_loss integer;
BEGIN
  SELECT sr.points_win, sr.points_draw, sr.points_loss
  INTO v_points_win, v_points_draw, v_points_loss
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_points_win IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH teams AS (
    SELECT
      st.id AS season_team_id,
      st.team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      st.registration_status
    FROM public.season_teams st
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = p_season_id
  ),
  official AS (
    SELECT
      m.id,
      m.home_season_team_id,
      m.away_season_team_id,
      m.home_score,
      m.away_score,
      m.created_at,
      fr.starts_at
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.season_id = p_season_id
      AND m.status IN ('finished', 'walkover')
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  ),
  results AS (
    SELECT
      o.home_season_team_id AS season_team_id,
      CASE
        WHEN o.home_score > o.away_score THEN 'W'
        WHEN o.home_score < o.away_score THEN 'L'
        ELSE 'D'
      END AS result,
      o.home_score AS gf,
      o.away_score AS ga,
      COALESCE(o.starts_at, o.created_at) AS sort_at,
      o.id AS match_id
    FROM official o
    UNION ALL
    SELECT
      o.away_season_team_id,
      CASE
        WHEN o.away_score > o.home_score THEN 'W'
        WHEN o.away_score < o.home_score THEN 'L'
        ELSE 'D'
      END,
      o.away_score,
      o.home_score,
      COALESCE(o.starts_at, o.created_at),
      o.id
    FROM official o
  ),
  agg AS (
    SELECT
      t.season_team_id,
      t.team_id,
      t.team_name,
      t.registration_status,
      COALESCE(COUNT(r.match_id), 0)::integer AS played,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0)::integer AS won,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0)::integer AS drawn,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0)::integer AS lost,
      COALESCE(SUM(r.gf), 0)::integer AS goals_for,
      COALESCE(SUM(r.ga), 0)::integer AS goals_against,
      (
        COALESCE(SUM(r.gf), 0) - COALESCE(SUM(r.ga), 0)
      )::integer AS goal_difference,
      (
        COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0) * v_points_win
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0) * v_points_draw
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0) * v_points_loss
      )::integer AS points
    FROM teams t
    LEFT JOIN results r ON r.season_team_id = t.season_team_id
    GROUP BY t.season_team_id, t.team_id, t.team_name, t.registration_status
  ),
  form_ranked AS (
    SELECT
      r.season_team_id,
      r.result,
      ROW_NUMBER() OVER (
        PARTITION BY r.season_team_id
        ORDER BY r.sort_at DESC, r.match_id DESC
      ) AS rn
    FROM results r
  ),
  form_agg AS (
    SELECT
      fr.season_team_id,
      string_agg(
        CASE fr.result
          WHEN 'W' THEN 'G'
          WHEN 'D' THEN 'E'
          ELSE 'P'
        END,
        ''
        ORDER BY fr.rn DESC
      ) AS recent_form
    FROM form_ranked fr
    WHERE fr.rn <= 5
    GROUP BY fr.season_team_id
  ),
  ranked AS (
    SELECT
      a.*,
      COALESCE(f.recent_form, '') AS recent_form,
      RANK() OVER (
        ORDER BY a.points DESC, a.goal_difference DESC, a.goals_for DESC
      )::integer AS "position"
    FROM agg a
    LEFT JOIN form_agg f ON f.season_team_id = a.season_team_id
  )
  SELECT
    r."position",
    r.season_team_id,
    r.team_id,
    r.team_name,
    r.registration_status,
    r.played,
    r.won,
    r.drawn,
    r.lost,
    r.goals_for,
    r.goals_against,
    r.goal_difference,
    r.points,
    r.recent_form
  FROM ranked r
  ORDER BY r."position" ASC, r.team_name ASC, r.season_team_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.__season_standings_core(uuid) FROM PUBLIC, anon, authenticated;

-- Rebuild get_season_standings to call core (avoid duplication at runtime)
CREATE OR REPLACE FUNCTION public.get_season_standings(p_season_id uuid)
RETURNS TABLE (
  "position" integer,
  season_team_id uuid,
  team_id uuid,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);
  RETURN QUERY SELECT * FROM public.__season_standings_core(p_season_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_season_standings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_season_standings(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_season_overview(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  organization_name text,
  organization_logo_path text,
  organization_brand_color text,
  competition_name text,
  season_name text,
  season_slug text,
  format_type text,
  starts_on date,
  ends_on date,
  visibility text
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
    o.name,
    o.logo_path,
    o.brand_color,
    c.name,
    s.name,
    s.slug,
    s.format_type,
    s.starts_on,
    s.ends_on,
    s.visibility
  FROM public.seasons s
  JOIN public.organizations o ON o.id = s.organization_id
  JOIN public.competitions c ON c.id = s.competition_id
  WHERE s.id = v_season_id
    AND s.organization_id = p_organization_id
    AND s.visibility = 'public';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_season_standings(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  "position" integer,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
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
    c."position",
    c.team_name,
    c.registration_status,
    c.played,
    c.won,
    c.drawn,
    c.lost,
    c.goals_for,
    c.goals_against,
    c.goal_difference,
    c.points,
    c.recent_form
  FROM public.__season_standings_core(v_season_id) c;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_season_matches(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  round_label text,
  round_number integer,
  sequence_in_round integer,
  home_team_name text,
  away_team_name text,
  status text,
  home_score integer,
  away_score integer,
  starts_at timestamptz,
  venue_name text,
  field_name text
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
    m.round_label,
    m.round_number,
    m.sequence_in_round,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name) AS home_team_name,
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name) AS away_team_name,
    m.status,
    m.home_score,
    m.away_score,
    fr.starts_at,
    v.name AS venue_name,
    f.name AS field_name
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  LEFT JOIN public.fields f ON f.id = fr.field_id
  LEFT JOIN public.venues v ON v.id = f.venue_id
  WHERE m.season_id = v_season_id
  ORDER BY
    m.round_number NULLS LAST,
    m.sequence_in_round NULLS LAST,
    fr.starts_at NULLS LAST,
    m.created_at ASC,
    m.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_season_scorers(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  "position" integer,
  player_name text,
  team_name text,
  goals integer
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
  WITH goals AS (
    SELECT
      p.full_name AS player_name,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      COUNT(*)::integer AS goals
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE m.season_id = v_season_id
      AND me.event_type = 'goal'
      AND m.status <> 'cancelled'
      AND st.season_id = v_season_id
    GROUP BY p.id, p.full_name, COALESCE(NULLIF(btrim(st.display_name), ''), t.name)
  ),
  ranked AS (
    SELECT
      g.*,
      RANK() OVER (ORDER BY g.goals DESC)::integer AS "position"
    FROM goals g
  )
  SELECT
    r."position",
    r.player_name,
    r.team_name,
    r.goals
  FROM ranked r
  ORDER BY r."position" ASC, r.player_name ASC;
END;
$$;

-- Public discipline: minimal columns only (no notes, no IDs)
CREATE OR REPLACE FUNCTION public.get_public_season_discipline(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  player_name text,
  team_name text,
  is_suspended boolean,
  matches_remaining integer
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
    q.player_name,
    q.team_name,
    q.is_suspended,
    q.matches_remaining
  FROM (
    SELECT
      p.full_name AS player_name,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      true AS is_suspended,
      COALESCE(SUM(ds.matches_remaining), 0)::integer AS matches_remaining
    FROM public.discipline_suspensions ds
    JOIN public.season_team_players stp ON stp.id = ds.season_team_player_id
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = v_season_id
      AND ds.status = 'active'
    GROUP BY p.id, p.full_name, COALESCE(NULLIF(btrim(st.display_name), ''), t.name)
  ) q
  ORDER BY q.matches_remaining DESC, q.player_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_season_overview(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_season_standings(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_season_matches(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_season_scorers(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_season_discipline(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_season_overview(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_season_standings(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_season_matches(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_season_scorers(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_season_discipline(uuid, text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_season_standings(uuid) IS
  'Member standings from official match scores (finished/walkover with both scores). RANK by PTS, DG, GF. Advanced tiebreakers pending.';

COMMENT ON FUNCTION public.get_season_top_scorers(uuid) IS
  'Member top scorers from match_events.goal only; own_goal excluded. Depends on complete event capture.';

COMMENT ON FUNCTION public.get_public_season_overview(uuid, text) IS
  'Anon/authenticated public overview. Returns empty when season missing or visibility <> public.';
