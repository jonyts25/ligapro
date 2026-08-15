-- Allow captain/vice to update jersey numbers while roster is not locked.

CREATE OR REPLACE FUNCTION public.update_captain_roster_jersey(
  p_season_team_player_id uuid,
  p_jersey_number integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stp public.season_team_players;
  v_locked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Roster player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_jersey_number IS NOT NULL AND p_jersey_number <= 0 THEN
    RAISE EXCEPTION 'Jersey number must be a positive integer'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_stp
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_stp.id IS NULL THEN
    RAISE EXCEPTION 'Roster player not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_stp.registration_status <> 'active' THEN
    RAISE EXCEPTION 'Only active roster players can be updated'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_or_vice_of_season_team(
    v_stp.season_team_id,
    v_uid
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.roster_locked_by_captain INTO v_locked
  FROM public.season_teams st
  WHERE st.id = v_stp.season_team_id;

  IF COALESCE(v_locked, false) THEN
    RAISE EXCEPTION 'Roster jersey edits by the captain are locked for this team'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.season_team_players
  SET jersey_number = p_jersey_number
  WHERE id = p_season_team_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_captain_roster_jersey(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_captain_roster_jersey(uuid, integer) TO authenticated;
