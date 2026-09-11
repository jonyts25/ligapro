-- Align append_season_catch_up_matches with product rule: catch-up is round-robin only.
-- Removes unreachable groups_knockout knockout-phase branch from 20260829150000.

CREATE OR REPLACE FUNCTION public.append_season_catch_up_matches(
  p_season_id uuid,
  p_new_season_team_id uuid,
  p_mode text,
  p_matches jsonb
)
RETURNS SETOF public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_mode text;
  v_existing_count integer;
  v_new_team_count integer;
  v_elem jsonb;
  v_round integer;
  v_leg integer;
  v_seq integer;
  v_home uuid;
  v_away uuid;
  v_max_round integer;
  v_expected_round integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL OR p_new_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season and new season team are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_mode := NULLIF(btrim(COALESCE(p_mode, '')), '');
  IF v_mode IS NULL OR v_mode NOT IN ('single', 'double') THEN
    RAISE EXCEPTION 'Mode must be single or double'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RAISE EXCEPTION 'Matches payload must be a JSON array'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(p_matches) = 0 THEN
    RAISE EXCEPTION 'At least one catch-up match is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(p_season_id);
  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  IF v_format = 'groups_knockout' THEN
    RAISE EXCEPTION
      'Catch-up matches are not available for groups and knockout seasons'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_format NOT IN ('round_robin', 'round_robin_double') THEN
    RAISE EXCEPTION 'Catch-up matches are only supported for round-robin seasons'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.season_teams st
    WHERE st.id = p_new_season_team_id
      AND st.season_id = p_season_id
      AND st.organization_id = v_org
      AND st.registration_status IN ('registered', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'New season team is not eligible'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND m.knockout_round_id IS NULL
    AND m.season_group_id IS NULL;

  IF v_existing_count = 0 THEN
    RAISE EXCEPTION 'Season has no league matches yet'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_new_team_count
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND (
      m.home_season_team_id = p_new_season_team_id
      OR m.away_season_team_id = p_new_season_team_id
    );

  IF v_new_team_count > 0 THEN
    RAISE EXCEPTION 'Season team already has matches in this season'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(MAX(m.round_number), 0)
  INTO v_max_round
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND m.knockout_round_id IS NULL
    AND m.season_group_id IS NULL;

  v_expected_round := v_max_round + 1;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    BEGIN
      v_round := (v_elem->>'round_number')::integer;
      v_leg := (v_elem->>'leg_number')::integer;
      v_seq := (v_elem->>'sequence_in_round')::integer;
      v_home := (v_elem->>'home_season_team_id')::uuid;
      v_away := (v_elem->>'away_season_team_id')::uuid;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid match field types'
          USING ERRCODE = 'P0001';
    END;

    IF v_home IS NULL OR v_away IS NULL THEN
      RAISE EXCEPTION 'home and away season teams are required'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_home = v_away THEN
      RAISE EXCEPTION 'Home and away must be distinct'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_home <> p_new_season_team_id AND v_away <> p_new_season_team_id THEN
      RAISE EXCEPTION 'Catch-up match must include the new season team'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_leg IS NULL OR v_leg NOT IN (1, 2) THEN
      RAISE EXCEPTION 'leg_number must be 1 or 2'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_mode = 'single' AND v_leg <> 1 THEN
      RAISE EXCEPTION 'Single mode requires leg_number = 1'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_round IS NULL OR v_round <= v_max_round THEN
      RAISE EXCEPTION 'Catch-up matches must use a new round after existing jornadas'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_mode = 'single' AND v_round <> v_expected_round THEN
      RAISE EXCEPTION 'Catch-up round number must be %', v_expected_round
        USING ERRCODE = 'P0001';
    END IF;

    IF v_mode = 'double' AND v_round NOT IN (v_expected_round, v_expected_round + 1) THEN
      RAISE EXCEPTION 'Catch-up double mode must use rounds % and %',
        v_expected_round, v_expected_round + 1
        USING ERRCODE = 'P0001';
    END IF;

    IF v_mode = 'double' AND v_leg = 1 AND v_round <> v_expected_round THEN
      RAISE EXCEPTION 'First leg catch-up matches must use round %', v_expected_round
        USING ERRCODE = 'P0001';
    END IF;

    IF v_mode = 'double' AND v_leg = 2 AND v_round <> v_expected_round + 1 THEN
      RAISE EXCEPTION 'Second leg catch-up matches must use round %', v_expected_round + 1
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.season_teams st
      WHERE st.id = v_home
        AND st.season_id = p_season_id
        AND st.registration_status IN ('registered', 'confirmed')
    ) OR NOT EXISTS (
      SELECT 1
      FROM public.season_teams st
      WHERE st.id = v_away
        AND st.season_id = p_season_id
        AND st.registration_status IN ('registered', 'confirmed')
    ) THEN
      RAISE EXCEPTION 'Opponent season team is not eligible'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.matches (
    season_id,
    organization_id,
    home_season_team_id,
    away_season_team_id,
    status,
    round_number,
    leg_number,
    sequence_in_round,
    round_label
  )
  SELECT
    p_season_id,
    v_org,
    (e->>'home_season_team_id')::uuid,
    (e->>'away_season_team_id')::uuid,
    'scheduled',
    (e->>'round_number')::integer,
    (e->>'leg_number')::integer,
    (e->>'sequence_in_round')::integer,
    CASE
      WHEN v_mode = 'double' AND (e->>'leg_number')::integer = 2 THEN
        'Jornada de alcance (vuelta)'
      ELSE
        'Jornada de alcance'
    END
  FROM jsonb_array_elements(p_matches) AS e
  ORDER BY (e->>'round_number')::integer, (e->>'sequence_in_round')::integer;

  RETURN QUERY
  SELECT m.*
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND (
      m.home_season_team_id = p_new_season_team_id
      OR m.away_season_team_id = p_new_season_team_id
    )
  ORDER BY m.round_number, m.sequence_in_round, m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_season_catch_up_matches(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_season_catch_up_matches(uuid, uuid, text, jsonb)
  TO authenticated;
