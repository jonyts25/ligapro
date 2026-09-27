-- Configurable tiebreak order per season (standings ranking after points)

-- ---------------------------------------------------------------------------
-- 1. Validation helper + season_rules.tiebreak_order
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__is_valid_tiebreak_order(p_order text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_order IS NOT NULL
    AND coalesce(array_length(p_order, 1), 0) = 4
    AND (
      SELECT array_agg(x ORDER BY x)
      FROM unnest(p_order) AS x
    ) = ARRAY[
      'goal_difference',
      'goals_against',
      'goals_for',
      'wins'
    ]::text[];
$$;

ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS tiebreak_order text[] NOT NULL DEFAULT
    ARRAY['goal_difference', 'goals_for', 'goals_against', 'wins']::text[];

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_tiebreak_order_valid_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_tiebreak_order_valid_check CHECK (
    public.__is_valid_tiebreak_order(tiebreak_order)
  );

COMMENT ON COLUMN public.season_rules.tiebreak_order IS
  'Secondary tiebreak criteria order after points in standings (exact set of four keys).';

-- ---------------------------------------------------------------------------
-- 2. __season_standings_core — only ranked CTE uses configurable order
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__season_standings_core(
  p_season_id uuid,
  p_group_id uuid DEFAULT NULL
)
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
  v_walkover_en_retiro boolean;
  v_wo_home integer;
  v_wo_away integer;
BEGIN
  SELECT
    sr.points_win,
    sr.points_draw,
    sr.points_loss,
    sr.walkover_en_retiro,
    sr.walkover_retiro_home_goals,
    sr.walkover_retiro_away_goals
  INTO
    v_points_win,
    v_points_draw,
    v_points_loss,
    v_walkover_en_retiro,
    v_wo_home,
    v_wo_away
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_points_win IS NULL THEN
    RETURN;
  END IF;

  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.season_groups sg
    WHERE sg.id = p_group_id AND sg.season_id = p_season_id
  ) THEN
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
      AND (p_group_id IS NULL OR st.season_group_id = p_group_id)
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
      AND m.knockout_round_id IS NULL
      AND (p_group_id IS NULL OR m.season_group_id = p_group_id)
      AND m.voided_at IS NULL
      AND m.status IN ('finished', 'walkover')
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  ),
  withdrawal_walkover AS (
    SELECT
      m.id,
      m.home_season_team_id,
      m.away_season_team_id,
      CASE
        WHEN hs.status = 'retirado' THEN v_wo_away
        WHEN aws.status = 'retirado' THEN v_wo_home
        ELSE NULL
      END AS home_score,
      CASE
        WHEN hs.status = 'retirado' THEN v_wo_home
        WHEN aws.status = 'retirado' THEN v_wo_away
        ELSE NULL
      END AS away_score,
      m.created_at,
      fr.starts_at
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    JOIN public.season_teams hs ON hs.id = m.home_season_team_id
    JOIN public.season_teams aws ON aws.id = m.away_season_team_id
    WHERE v_walkover_en_retiro
      AND m.season_id = p_season_id
      AND m.knockout_round_id IS NULL
      AND (p_group_id IS NULL OR m.season_group_id = p_group_id)
      AND m.voided_at IS NOT NULL
      AND m.void_reason = 'equipo retirado'
      AND (hs.status = 'retirado' OR aws.status = 'retirado')
  ),
  all_official AS (
    SELECT * FROM official
    UNION ALL
    SELECT * FROM withdrawal_walkover ww
    WHERE ww.home_score IS NOT NULL AND ww.away_score IS NOT NULL
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
    FROM all_official o
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
    FROM all_official o
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
  tiebreak AS (
    SELECT sr.tiebreak_order
    FROM public.season_rules sr
    WHERE sr.season_id = p_season_id
  ),
  ranked AS (
    SELECT
      a.*,
      COALESCE(f.recent_form, '') AS recent_form,
      RANK() OVER (
        ORDER BY
          a.points DESC,
          (CASE tb.tiebreak_order[1]
            WHEN 'goal_difference' THEN a.goal_difference
            WHEN 'goals_for' THEN a.goals_for
            WHEN 'goals_against' THEN -a.goals_against
            WHEN 'wins' THEN a.won
          END) DESC,
          (CASE tb.tiebreak_order[2]
            WHEN 'goal_difference' THEN a.goal_difference
            WHEN 'goals_for' THEN a.goals_for
            WHEN 'goals_against' THEN -a.goals_against
            WHEN 'wins' THEN a.won
          END) DESC,
          (CASE tb.tiebreak_order[3]
            WHEN 'goal_difference' THEN a.goal_difference
            WHEN 'goals_for' THEN a.goals_for
            WHEN 'goals_against' THEN -a.goals_against
            WHEN 'wins' THEN a.won
          END) DESC,
          (CASE tb.tiebreak_order[4]
            WHEN 'goal_difference' THEN a.goal_difference
            WHEN 'goals_for' THEN a.goals_for
            WHEN 'goals_against' THEN -a.goals_against
            WHEN 'wins' THEN a.won
          END) DESC
      )::integer AS "position"
    FROM agg a
    CROSS JOIN tiebreak tb
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

-- ---------------------------------------------------------------------------
-- 3. RPC update_season_tiebreak_order
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_season_tiebreak_order(
  p_season_id uuid,
  p_tiebreak_order text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_visibility text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.__is_valid_tiebreak_order(p_tiebreak_order) THEN
    RAISE EXCEPTION 'Invalid tiebreak order'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.visibility
  INTO v_org_id, v_visibility
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_visibility = 'archived' THEN
    RAISE EXCEPTION 'Esta temporada está archivada y no admite cambios'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role_in_org(
      v_org_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(p_season_id, ARRAY['tournament_admin']::text[])
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_rules sr
  SET tiebreak_order = p_tiebreak_order
  WHERE sr.season_id = p_season_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Season rules not found'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_season_tiebreak_order(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_season_tiebreak_order(uuid, text[]) TO authenticated;
