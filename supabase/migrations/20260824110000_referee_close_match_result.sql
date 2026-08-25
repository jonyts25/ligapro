-- Confirmed match referee may close a match (finished/walkover only).
-- Org admin / tournament_admin behavior unchanged.

CREATE OR REPLACE FUNCTION public.is_confirmed_match_referee(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_officials mo
    WHERE mo.match_id = p_match_id
      AND mo.profile_id = auth.uid()
      AND mo.role = 'referee'
      AND mo.status = 'confirmed'
  );
$$;

REVOKE ALL ON FUNCTION public.is_confirmed_match_referee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_confirmed_match_referee(uuid) TO authenticated;

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

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.update_match_result(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_match_result(uuid, text, integer, integer) TO authenticated;
