-- Self-service confirmation: official confirms their own match_officials row.

CREATE OR REPLACE FUNCTION public.confirm_match_official(p_match_official_id uuid)
RETURNS public.match_officials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.match_officials
  WHERE id = p_match_official_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'match_official % does not exist', p_match_official_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'Not authorized to confirm match_official %',
      p_match_official_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_member_of(v_row.organization_id) THEN
    RAISE EXCEPTION
      'Not authorized to confirm match_official %',
      p_match_official_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status = 'confirmed' THEN
    RETURN v_row;
  END IF;

  IF v_row.status = 'declined' THEN
    RAISE EXCEPTION 'Cannot confirm a declined assignment'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_match(v_row.match_id);

  UPDATE public.match_officials
  SET
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_match_official_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_match_official(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_match_official(uuid) TO authenticated;
