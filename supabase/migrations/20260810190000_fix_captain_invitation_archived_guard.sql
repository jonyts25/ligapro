-- Fix archived-season guard on captain invitation RPCs.
-- Migration 028 injected __assert_season_not_archived_for_season_team(p_season_team_id)
-- into functions whose first parameter is p_season_team_player_id, causing runtime errors.

CREATE OR REPLACE FUNCTION public.invite_captain_to_roster(
  p_season_team_player_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_is_leader boolean;
  v_invitation_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team_player(p_season_team_player_id);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Season team player id is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_email := lower(btrim(COALESCE(p_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Valid email is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    stp.organization_id,
    (stp.is_captain = true OR stp.is_vice_captain = true)
  INTO v_org, v_is_leader
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_is_leader, false) THEN
    RAISE EXCEPTION 'Player must be marked as captain or vice-captain before sending invitation'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.captain_invitations
  SET status = 'cancelled'
  WHERE season_team_player_id = p_season_team_player_id
    AND status = 'pending';

  INSERT INTO public.captain_invitations (
    organization_id,
    season_team_player_id,
    email,
    invited_by_profile_id,
    expires_at
  ) VALUES (
    v_org,
    p_season_team_player_id,
    v_email,
    v_uid,
    now() + interval '7 days'
  )
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_payment_mark(
  p_season_team_player_id uuid,
  p_marked_paid boolean,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_season_team uuid;
  v_notes text;
  v_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team_player(p_season_team_player_id);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_team_player_id IS NULL OR p_marked_paid IS NULL THEN
    RAISE EXCEPTION 'Season team player id and marked_paid are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT stp.organization_id, stp.season_team_id
  INTO v_org, v_season_team
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_active_captain_or_vice_of_season_team(v_season_team, v_uid) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  INSERT INTO public.season_team_player_payment_marks (
    organization_id,
    season_team_player_id,
    marked_paid,
    marked_by_profile_id,
    notes
  ) VALUES (
    v_org,
    p_season_team_player_id,
    p_marked_paid,
    v_uid,
    v_notes
  )
  ON CONFLICT (season_team_player_id) DO UPDATE
  SET
    marked_paid = EXCLUDED.marked_paid,
    marked_by_profile_id = EXCLUDED.marked_by_profile_id,
    notes = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_captain_to_roster(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_player_payment_mark(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_captain_to_roster(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_payment_mark(uuid, boolean, text) TO authenticated;
