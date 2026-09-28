-- Migration 045 (step 3.5): captain access for roster invite + phone dedup

CREATE OR REPLACE FUNCTION public.invite_player_to_roster(
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
  v_season_team_id uuid;
  v_email text;
  v_invitation_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_season_team(p_season_team_player_id);
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

  SELECT stp.organization_id, stp.season_team_id
  INTO v_org, v_season_team_id
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Roster entry not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role_in_org(
      v_org,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.is_active_captain_or_vice_of_season_team(v_season_team_id, v_uid)
  ) THEN
    RAISE EXCEPTION 'Not authorized'
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

CREATE OR REPLACE FUNCTION public.find_potential_duplicate_player(
  p_organization_id uuid,
  p_phone text
)
RETURNS TABLE (
  player_id uuid,
  full_name text,
  is_claimed boolean,
  teams_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role_in_org(
      p_organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR EXISTS (
      SELECT 1
      FROM public.season_team_players stp
      INNER JOIN public.players p ON p.id = stp.player_id
      WHERE stp.organization_id = p_organization_id
        AND p.profile_id = v_uid
        AND stp.registration_status = 'active'
        AND (stp.is_captain OR stp.is_vice_captain)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_phone := NULLIF(btrim(COALESCE(p_phone, '')), '');
  IF v_phone IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    (p.profile_id IS NOT NULL) AS is_claimed,
    (
      SELECT count(*)::integer
      FROM public.season_team_players stp
      WHERE stp.player_id = p.id
    ) AS teams_count
  FROM public.players p
  WHERE p.organization_id = p_organization_id
    AND NULLIF(btrim(COALESCE(p.phone, '')), '') IS NOT NULL
    AND btrim(p.phone) = v_phone
  ORDER BY p.full_name;
END;
$$;

CREATE POLICY captain_invitations_select_team_leader
  ON public.captain_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.season_team_players stp
      WHERE stp.id = captain_invitations.season_team_player_id
        AND public.is_active_captain_or_vice_of_season_team(
          stp.season_team_id,
          auth.uid()
        )
    )
  );
