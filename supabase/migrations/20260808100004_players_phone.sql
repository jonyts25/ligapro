-- Store optional WhatsApp contact phone on player records.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS phone text;

-- Replace the 4-arg overload; CREATE OR REPLACE alone would leave both signatures.
DROP FUNCTION IF EXISTS public.create_player_and_add_to_roster(uuid, text, integer, text);

CREATE OR REPLACE FUNCTION public.create_player_and_add_to_roster(
  p_season_team_id uuid,
  p_full_name text,
  p_jersey_number integer DEFAULT NULL,
  p_registration_status text DEFAULT 'active',
  p_phone text DEFAULT NULL
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
  v_player_id uuid;
  v_stp_id uuid;
  v_is_admin boolean;
  v_is_leader boolean;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_id IS NULL THEN
    RAISE EXCEPTION 'Season team id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT st.organization_id INTO v_org_id
  FROM public.season_teams st
  WHERE st.id = p_season_team_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season team not found'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_admin := public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  );
  v_is_leader := public.is_active_captain_or_vice_of_season_team(
    p_season_team_id,
    v_uid
  );

  IF NOT v_is_admin AND NOT v_is_leader THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_leader AND NOT v_is_admin THEN
    PERFORM public.__assert_captain_roster_add_allowed(p_season_team_id);
  END IF;

  v_name := btrim(COALESCE(p_full_name, ''));
  IF char_length(v_name) < 2 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'Player name must be between 2 and 100 characters'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.players (organization_id, full_name, profile_id, phone)
  VALUES (
    v_org_id,
    v_name,
    NULL,
    NULLIF(btrim(COALESCE(p_phone, '')), '')
  )
  RETURNING id INTO v_player_id;

  v_stp_id := public.add_player_to_season_team(
    p_season_team_id,
    v_player_id,
    p_jersey_number,
    p_registration_status
  );

  RETURN v_stp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_player_and_add_to_roster(uuid, text, integer, text, text)
  TO authenticated;
