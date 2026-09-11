-- Guest match official invites: one-time link capture without an account.

ALTER TABLE public.match_officials
  ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.match_officials
  ADD COLUMN IF NOT EXISTS invite_token uuid,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_name text;

ALTER TABLE public.match_officials
  DROP CONSTRAINT IF EXISTS match_officials_match_profile_role_unique;

CREATE UNIQUE INDEX IF NOT EXISTS match_officials_match_profile_role_unique
  ON public.match_officials (match_id, profile_id, role)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS match_officials_invite_token_unique
  ON public.match_officials (invite_token)
  WHERE invite_token IS NOT NULL;

ALTER TABLE public.match_officials
  DROP CONSTRAINT IF EXISTS match_officials_profile_or_invite_check;

ALTER TABLE public.match_officials
  ADD CONSTRAINT match_officials_profile_or_invite_check
  CHECK (profile_id IS NOT NULL OR invite_token IS NOT NULL);

CREATE OR REPLACE FUNCTION public.__fetch_valid_guest_official(
  p_token uuid,
  p_match_id uuid DEFAULT NULL,
  p_require_name boolean DEFAULT false
)
RETURNS public.match_officials
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Invalid guest invite token'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.match_officials mo
  WHERE mo.invite_token = p_token;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Invalid guest invite token'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NOT NULL AND v_row.match_id IS DISTINCT FROM p_match_id THEN
    RAISE EXCEPTION 'Guest invite token is not valid for this match'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.invite_expires_at IS NULL OR v_row.invite_expires_at <= now() THEN
    RAISE EXCEPTION 'Guest invite link has expired or was already used'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status NOT IN ('assigned', 'confirmed') THEN
    RAISE EXCEPTION 'Guest invite is no longer active'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.role <> 'referee' THEN
    RAISE EXCEPTION 'Guest invite is not authorized for capture'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_require_name AND NULLIF(btrim(COALESCE(v_row.guest_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Guest name is required before capture'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.__fetch_valid_guest_official(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_official_invite(p_token uuid)
RETURNS TABLE (
  match_official_id uuid,
  match_id uuid,
  organization_id uuid,
  season_id uuid,
  competition_id uuid,
  guest_name text,
  role text,
  status text,
  invite_expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
  v_competition_id uuid;
BEGIN
  v_row := public.__fetch_valid_guest_official(p_token, NULL, false);

  SELECT s.competition_id INTO v_competition_id
  FROM public.matches m
  JOIN public.seasons s ON s.id = m.season_id
  WHERE m.id = v_row.match_id;

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.match_id,
    v_row.organization_id,
    m.season_id,
    v_competition_id,
    v_row.guest_name,
    v_row.role,
    v_row.status,
    v_row.invite_expires_at
  FROM public.matches m
  WHERE m.id = v_row.match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_official_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_official_invite(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_guest_official_name(
  p_token uuid,
  p_name text
)
RETURNS public.match_officials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
  v_name text;
BEGIN
  v_row := public.__fetch_valid_guest_official(p_token, NULL, false);
  v_name := NULLIF(btrim(COALESCE(p_name, '')), '');

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Guest name is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived_for_match(v_row.match_id);

  UPDATE public.match_officials
  SET
    guest_name = v_name,
    status = 'confirmed',
    updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_guest_official_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_guest_official_name(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_record_match_event(
  p_token uuid,
  p_match_id uuid,
  p_season_team_player_id uuid,
  p_event_type text,
  p_minute integer,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_official public.match_officials;
  v_org uuid;
  v_status text;
  v_home uuid;
  v_away uuid;
  v_player_st uuid;
  v_player_status text;
  v_event_type text;
  v_notes text;
  v_event_id uuid;
BEGIN
  v_official := public.__fetch_valid_guest_official(p_token, p_match_id, true);

  IF p_match_id IS NULL OR p_season_team_player_id IS NULL THEN
    RAISE EXCEPTION 'Match id and season_team_player_id are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_minute IS NULL OR p_minute < 0 OR p_minute > 130 THEN
    RAISE EXCEPTION 'minute must be between 0 and 130'
      USING ERRCODE = 'P0001';
  END IF;

  v_event_type := NULLIF(btrim(COALESCE(p_event_type, '')), '');
  IF v_event_type IS NULL OR v_event_type NOT IN (
    'goal',
    'own_goal',
    'yellow_card',
    'red_card',
    'substitution_in',
    'substitution_out',
    'injury'
  ) THEN
    RAISE EXCEPTION 'Invalid event_type'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  SELECT
    m.organization_id,
    m.status,
    m.home_season_team_id,
    m.away_season_team_id
  INTO v_org, v_status, v_home, v_away
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('finished', 'cancelled', 'walkover') THEN
    RAISE EXCEPTION 'Cannot record events on a closed match (%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_match_capture_window(p_match_id);

  SELECT stp.season_team_id, stp.registration_status
  INTO v_player_st, v_player_status
  FROM public.season_team_players stp
  WHERE stp.id = p_season_team_player_id
    AND stp.organization_id = v_org;

  IF v_player_st IS NULL THEN
    RAISE EXCEPTION 'season_team_player not found in this organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_status = 'inactive' THEN
    RAISE EXCEPTION 'Cannot record events for an inactive player'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_st IS DISTINCT FROM v_home AND v_player_st IS DISTINCT FROM v_away THEN
    RAISE EXCEPTION 'Player does not belong to either team in this match'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.match_events (
    match_id,
    organization_id,
    season_team_player_id,
    event_type,
    minute,
    notes
  ) VALUES (
    p_match_id,
    v_org,
    p_season_team_player_id,
    v_event_type,
    p_minute,
    v_notes
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_record_match_event(uuid, uuid, uuid, text, integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_record_match_event(uuid, uuid, uuid, text, integer, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_update_match_result(
  p_token uuid,
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
  v_official public.match_officials;
  v_match public.matches;
BEGIN
  v_official := public.__fetch_valid_guest_official(p_token, p_match_id, true);

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

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

  PERFORM public.__assert_match_capture_window(p_match_id);

  UPDATE public.matches
  SET
    status = p_status,
    home_score = p_home_score,
    away_score = p_away_score,
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  PERFORM public.set_match_context(
    p_match_id,
    NULL,
    NULL,
    v_official.guest_name,
    NULL
  );

  UPDATE public.match_officials
  SET
    invite_expires_at = now(),
    updated_at = now()
  WHERE id = v_official.id;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_update_match_result(uuid, uuid, text, integer, integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_update_match_result(uuid, uuid, text, integer, integer)
  TO anon, authenticated;

COMMENT ON COLUMN public.match_officials.invite_token IS
  'One-time guest invite token. profile_id is NULL when invite_token is set.';
COMMENT ON COLUMN public.match_officials.guest_name IS
  'Display name captured from the guest referee invite flow.';

CREATE OR REPLACE FUNCTION public.get_guest_match_snapshot(p_token uuid)
RETURNS TABLE (
  match_id uuid,
  status text,
  home_score integer,
  away_score integer,
  calendar_status text,
  home_name text,
  away_name text,
  home_season_team_id uuid,
  away_season_team_id uuid,
  starts_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
BEGIN
  v_row := public.__fetch_valid_guest_official(p_token, NULL, false);

  RETURN QUERY
  SELECT
    m.id,
    m.status,
    m.home_score,
    m.away_score,
    m.calendar_status,
    COALESCE(NULLIF(btrim(sth.display_name), ''), th.name) AS home_name,
    COALESCE(NULLIF(btrim(sta.display_name), ''), ta.name) AS away_name,
    m.home_season_team_id,
    m.away_season_team_id,
    fr.starts_at
  FROM public.matches m
  JOIN public.season_teams sth ON sth.id = m.home_season_team_id
  JOIN public.teams th ON th.id = sth.team_id
  JOIN public.season_teams sta ON sta.id = m.away_season_team_id
  JOIN public.teams ta ON ta.id = sta.team_id
  LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  WHERE m.id = v_row.match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_match_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_match_snapshot(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_match_roster(p_token uuid)
RETURNS TABLE (
  season_team_player_id uuid,
  season_team_id uuid,
  player_id uuid,
  player_name text,
  jersey_number integer,
  registration_status text,
  photo_path text,
  verification_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
  v_home uuid;
  v_away uuid;
  v_org uuid;
BEGIN
  v_row := public.__fetch_valid_guest_official(p_token, NULL, true);

  SELECT m.organization_id, m.home_season_team_id, m.away_season_team_id
  INTO v_org, v_home, v_away
  FROM public.matches m
  WHERE m.id = v_row.match_id;

  RETURN QUERY
  SELECT
    stp.id,
    stp.season_team_id,
    stp.player_id,
    p.full_name,
    stp.jersey_number,
    stp.registration_status,
    p.photo_path,
    p.verification_status
  FROM public.season_team_players stp
  JOIN public.players p ON p.id = stp.player_id
  WHERE stp.organization_id = v_org
    AND stp.season_team_id IN (v_home, v_away)
    AND stp.registration_status <> 'inactive'
  ORDER BY stp.season_team_id, stp.jersey_number NULLS LAST, p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_match_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_match_roster(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guest_match_timeline(p_token uuid)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  minute integer,
  notes text,
  created_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  season_team_player_id uuid,
  season_team_id uuid,
  player_name text,
  team_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_officials;
BEGIN
  v_row := public.__fetch_valid_guest_official(p_token, NULL, true);

  RETURN QUERY
  SELECT
    me.id,
    me.event_type,
    me.minute,
    me.notes,
    me.created_at,
    me.voided_at,
    me.void_reason,
    me.season_team_player_id,
    stp.season_team_id,
    p.full_name,
    COALESCE(NULLIF(btrim(st.display_name), ''), t.name)
  FROM public.match_events me
  JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
  JOIN public.players p ON p.id = stp.player_id
  JOIN public.season_teams st ON st.id = stp.season_team_id
  JOIN public.teams t ON t.id = st.team_id
  WHERE me.match_id = v_row.match_id
  ORDER BY me.minute ASC, me.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_match_timeline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_match_timeline(uuid) TO anon, authenticated;
