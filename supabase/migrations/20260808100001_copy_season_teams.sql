-- Copy enrolled teams (and optionally roster) from a prior season in the same competition.

CREATE OR REPLACE FUNCTION public.copy_season_teams(
  p_from_season_id uuid,
  p_to_season_id uuid,
  p_team_ids uuid[],
  p_copy_roster boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from_org uuid;
  v_to_org uuid;
  v_from_comp uuid;
  v_to_comp uuid;
  v_team_id uuid;
  v_from_st uuid;
  v_to_st uuid;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_from_season_id IS NULL OR p_to_season_id IS NULL THEN
    RAISE EXCEPTION 'Both season ids are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_from_season_id = p_to_season_id THEN
    RAISE EXCEPTION 'Source and target seasons must differ'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_team_ids IS NULL OR array_length(p_team_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.competition_id
  INTO v_from_org, v_from_comp
  FROM public.seasons s
  WHERE s.id = p_from_season_id;

  SELECT s.organization_id, s.competition_id
  INTO v_to_org, v_to_comp
  FROM public.seasons s
  WHERE s.id = p_to_season_id;

  IF v_from_org IS NULL OR v_to_org IS NULL THEN
    RAISE EXCEPTION 'Season not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_from_org IS DISTINCT FROM v_to_org THEN
    RAISE EXCEPTION 'Seasons must belong to the same organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_from_comp IS DISTINCT FROM v_to_comp THEN
    RAISE EXCEPTION 'Seasons must belong to the same competition'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_to_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_team_id IN ARRAY p_team_ids LOOP
    SELECT st.id INTO v_from_st
    FROM public.season_teams st
    WHERE st.season_id = p_from_season_id
      AND st.team_id = v_team_id
      AND st.organization_id = v_from_org;

    IF v_from_st IS NULL THEN
      RAISE EXCEPTION 'Team % is not enrolled in source season', v_team_id
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.season_teams st
      WHERE st.season_id = p_to_season_id
        AND st.team_id = v_team_id
    ) THEN
      CONTINUE;
    END IF;

    v_to_st := public.enroll_team_in_season(
      p_to_season_id,
      v_team_id,
      (
        SELECT st.display_name
        FROM public.season_teams st
        WHERE st.id = v_from_st
      ),
      (
        SELECT st.group_name
        FROM public.season_teams st
        WHERE st.id = v_from_st
      ),
      (
        SELECT st.registration_status
        FROM public.season_teams st
        WHERE st.id = v_from_st
      )
    );

    IF p_copy_roster THEN
      INSERT INTO public.season_team_players (
        season_team_id,
        player_id,
        organization_id,
        season_id,
        jersey_number,
        is_captain,
        is_vice_captain,
        registration_status
      )
      SELECT
        v_to_st,
        stp.player_id,
        stp.organization_id,
        p_to_season_id,
        stp.jersey_number,
        false,
        false,
        stp.registration_status
      FROM public.season_team_players stp
      WHERE stp.season_team_id = v_from_st
        AND stp.registration_status <> 'inactive'
        AND NOT EXISTS (
          SELECT 1
          FROM public.season_team_players existing
          WHERE existing.season_team_id = v_to_st
            AND existing.player_id = stp.player_id
        );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_season_teams(uuid, uuid, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_season_teams(uuid, uuid, uuid[], boolean) TO authenticated;
