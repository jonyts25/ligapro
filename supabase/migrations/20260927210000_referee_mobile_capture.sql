-- Referee mobile capture: optional assist, client dedup, official void window

-- ---------------------------------------------------------------------------
-- 1. match_events.client_dedup_key
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS client_dedup_key text;

CREATE UNIQUE INDEX IF NOT EXISTS match_events_client_dedup_key_unique
  ON public.match_events (client_dedup_key)
  WHERE client_dedup_key IS NOT NULL;

COMMENT ON COLUMN public.match_events.client_dedup_key IS
  'Optional client idempotency key for offline capture replay.';

-- ---------------------------------------------------------------------------
-- 2. record_match_event — assist + dedup (backward-compatible defaults)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_match_event(uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.record_match_event(uuid, uuid, text, integer, text);

CREATE OR REPLACE FUNCTION public.record_match_event(
  p_match_id uuid,
  p_season_team_player_id uuid,
  p_event_type text,
  p_minute integer,
  p_notes text DEFAULT NULL,
  p_assist_season_team_player_id uuid DEFAULT NULL,
  p_client_dedup_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_status text;
  v_home uuid;
  v_away uuid;
  v_player_st uuid;
  v_player_status text;
  v_event_type text;
  v_notes text;
  v_dedup_key text;
  v_assist_st uuid;
  v_assist_status text;
  v_event_id uuid;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

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
  v_dedup_key := NULLIF(btrim(COALESCE(p_client_dedup_key, '')), '');

  IF v_dedup_key IS NOT NULL THEN
    SELECT me.id INTO v_event_id
    FROM public.match_events me
    WHERE me.client_dedup_key = v_dedup_key;

    IF v_event_id IS NOT NULL THEN
      RETURN v_event_id;
    END IF;
  END IF;

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

  IF NOT public.can_capture_match(p_match_id) THEN
    RAISE EXCEPTION 'Not authorized to capture match %', p_match_id
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

  IF p_assist_season_team_player_id IS NOT NULL THEN
    IF v_event_type <> 'goal' THEN
      RAISE EXCEPTION 'Assist is only allowed for goal events'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT stp.season_team_id, stp.registration_status
    INTO v_assist_st, v_assist_status
    FROM public.season_team_players stp
    WHERE stp.id = p_assist_season_team_player_id
      AND stp.organization_id = v_org;

    IF v_assist_st IS NULL THEN
      RAISE EXCEPTION 'Assist season_team_player not found in this organization'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_assist_status = 'inactive' THEN
      RAISE EXCEPTION 'Cannot record assist for an inactive player'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_assist_st IS DISTINCT FROM v_player_st THEN
      RAISE EXCEPTION 'Assist player must belong to the same team as the scorer'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.match_events (
    match_id,
    organization_id,
    season_team_player_id,
    event_type,
    minute,
    notes,
    assist_season_team_player_id,
    client_dedup_key
  ) VALUES (
    p_match_id,
    v_org,
    p_season_team_player_id,
    v_event_type,
    p_minute,
    v_notes,
    p_assist_season_team_player_id,
    v_dedup_key
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_match_event(uuid, uuid, text, integer, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_match_event(uuid, uuid, text, integer, text, uuid, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. void_match_event — officials may void within 3 minutes of creation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_match_event(
  p_event_id uuid,
  p_reason text
)
RETURNS public.match_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.match_events;
  v_season uuid;
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_can_official_void boolean;
BEGIN
  PERFORM public.__assert_season_not_archived_for_match_event(p_event_id);
  SELECT * INTO v_row
  FROM public.match_events
  WHERE id = p_event_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'match_event % does not exist', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT mt.season_id INTO v_season
  FROM public.matches mt
  WHERE mt.id = v_row.match_id;

  v_can_official_void :=
    public.is_confirmed_match_referee_or_scorekeeper(v_row.match_id)
    AND (now() - v_row.created_at) < interval '3 minutes';

  IF NOT (
    public.has_role_in_org_scoped(
      v_row.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[],
      'season',
      v_season
    )
    OR v_can_official_void
  ) THEN
    RAISE EXCEPTION 'Not authorized to void match_event %', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'match_event % is already voided', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.match_event_void', 'true', true);

  UPDATE public.match_events
  SET voided_at = now(),
      voided_by_profile_id = auth.uid(),
      void_reason = v_reason,
      updated_at = now()
  WHERE id = p_event_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.void_match_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_match_event(uuid, text) TO authenticated;
