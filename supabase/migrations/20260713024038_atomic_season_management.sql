-- Migration 013: atomic season + season_rules RPCs
-- Frontend F4 must use these instead of separate INSERT/UPDATE (+ app DELETE compensation).

-- ---------------------------------------------------------------------------
-- create_season_with_rules
-- Inserts season (trigger creates default rules), then updates rules.
-- All in one function transaction: any failure leaves no season/rules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_season_with_rules(
  p_competition_id uuid,
  p_name text,
  p_slug text,
  p_format_type text,
  p_visibility text,
  p_starts_on date,
  p_ends_on date,
  p_points_win integer,
  p_points_draw integer,
  p_points_loss integer,
  p_allow_draws boolean,
  p_match_duration_minutes integer,
  p_minimum_rest_minutes integer,
  p_yellow_card_limit integer,
  p_suspension_matches integer
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
  v_slug text;
  v_season_id uuid;
  v_rules_count integer;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_competition_id IS NULL THEN
    RAISE EXCEPTION 'Competition id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT c.organization_id INTO v_org_id
  FROM public.competitions c
  WHERE c.id = p_competition_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Competition not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Season name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  v_slug := btrim(COALESCE(p_slug, ''));
  IF char_length(v_slug) < 1 OR char_length(v_slug) > 80 THEN
    RAISE EXCEPTION 'Season slug is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_format_type IS NULL OR p_format_type NOT IN (
    'round_robin',
    'round_robin_double',
    'groups_knockout',
    'knockout'
  ) THEN
    RAISE EXCEPTION 'Invalid format_type'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN (
    'draft',
    'private',
    'unlisted',
    'public',
    'archived'
  ) THEN
    RAISE EXCEPTION 'Invalid visibility'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_starts_on IS NOT NULL
     AND p_ends_on IS NOT NULL
     AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'ends_on must be on or after starts_on'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_points_win IS NULL
     OR p_points_draw IS NULL
     OR p_points_loss IS NULL
     OR p_allow_draws IS NULL
     OR p_match_duration_minutes IS NULL
     OR p_minimum_rest_minutes IS NULL
     OR p_yellow_card_limit IS NULL
     OR p_suspension_matches IS NULL THEN
    RAISE EXCEPTION 'All season rule values are required'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.seasons (
    competition_id,
    organization_id,
    name,
    slug,
    format_type,
    visibility,
    starts_on,
    ends_on
  ) VALUES (
    p_competition_id,
    v_org_id,
    v_name,
    v_slug,
    p_format_type,
    p_visibility,
    p_starts_on,
    p_ends_on
  )
  RETURNING id INTO v_season_id;

  SELECT count(*)::integer INTO v_rules_count
  FROM public.season_rules sr
  WHERE sr.season_id = v_season_id;

  IF v_rules_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one season_rules row after season insert'
      USING ERRCODE = 'P0001';
  END IF;

  -- Rule CHECKs (points order, ranges) enforced here: failure rolls back season insert.
  UPDATE public.season_rules
  SET
    points_win = p_points_win,
    points_draw = p_points_draw,
    points_loss = p_points_loss,
    allow_draws = p_allow_draws,
    match_duration_minutes = p_match_duration_minutes,
    minimum_rest_minutes = p_minimum_rest_minutes,
    yellow_card_limit = p_yellow_card_limit,
    suspension_matches = p_suspension_matches
  WHERE season_id = v_season_id
    AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season_rules'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_season_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_season_with_rules(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_season_with_rules(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer
) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_season_with_rules
-- Updates season + season_rules atomically. Does not change competition_id,
-- organization_id, id, slug, or timestamps manually.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_season_with_rules(
  p_season_id uuid,
  p_name text,
  p_format_type text,
  p_visibility text,
  p_starts_on date,
  p_ends_on date,
  p_points_win integer,
  p_points_draw integer,
  p_points_loss integer,
  p_allow_draws boolean,
  p_match_duration_minutes integer,
  p_minimum_rest_minutes integer,
  p_yellow_card_limit integer,
  p_suspension_matches integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_name text;
  v_rules_count integer;
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org_id
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::integer INTO v_rules_count
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_rules_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one season_rules row for season'
      USING ERRCODE = 'P0001';
  END IF;

  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Season name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_format_type IS NULL OR p_format_type NOT IN (
    'round_robin',
    'round_robin_double',
    'groups_knockout',
    'knockout'
  ) THEN
    RAISE EXCEPTION 'Invalid format_type'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN (
    'draft',
    'private',
    'unlisted',
    'public',
    'archived'
  ) THEN
    RAISE EXCEPTION 'Invalid visibility'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_starts_on IS NOT NULL
     AND p_ends_on IS NOT NULL
     AND p_ends_on < p_starts_on THEN
    RAISE EXCEPTION 'ends_on must be on or after starts_on'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_points_win IS NULL
     OR p_points_draw IS NULL
     OR p_points_loss IS NULL
     OR p_allow_draws IS NULL
     OR p_match_duration_minutes IS NULL
     OR p_minimum_rest_minutes IS NULL
     OR p_yellow_card_limit IS NULL
     OR p_suspension_matches IS NULL THEN
    RAISE EXCEPTION 'All season rule values are required'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.seasons
  SET
    name = v_name,
    format_type = p_format_type,
    visibility = p_visibility,
    starts_on = p_starts_on,
    ends_on = p_ends_on
  WHERE id = p_season_id
    AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_rules
  SET
    points_win = p_points_win,
    points_draw = p_points_draw,
    points_loss = p_points_loss,
    allow_draws = p_allow_draws,
    match_duration_minutes = p_match_duration_minutes,
    minimum_rest_minutes = p_minimum_rest_minutes,
    yellow_card_limit = p_yellow_card_limit,
    suspension_matches = p_suspension_matches
  WHERE season_id = p_season_id
    AND organization_id = v_org_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Failed to update season_rules'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_season_with_rules(
  uuid, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_season_with_rules(
  uuid, text, text, text, date, date,
  integer, integer, integer, boolean, integer, integer, integer, integer
) TO authenticated;
