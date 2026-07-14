-- Migration 017: harden match event capture (F7)
-- - Deny UPDATE/DELETE on match_events for product roles
-- - BEFORE INSERT guard: closed match + inactive player + can_capture_match
-- - RPC record_match_event for typed capture
-- - Re-create 016 functions without unused locals (db lint)

-- ---------------------------------------------------------------------------
-- A. Denegar UPDATE/DELETE de match_events en el producto
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS match_events_update_owner_or_admin ON public.match_events;
DROP POLICY IF EXISTS match_events_delete_owner_or_admin ON public.match_events;
DROP POLICY IF EXISTS match_events_update_tournament_admin ON public.match_events;
DROP POLICY IF EXISTS match_events_update_confirmed_official ON public.match_events;

REVOKE UPDATE, DELETE ON TABLE public.match_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.match_events TO authenticated;

COMMENT ON TABLE public.match_events IS
  'On-pitch events. Capture via INSERT (policies + can_capture_match) or record_match_event RPC. UPDATE/DELETE denied until disciplined reconciliation exists (F7+).';

-- ---------------------------------------------------------------------------
-- B. BEFORE INSERT: partido cerrado, jugador inactive, can_capture_match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_events_enforce_capture_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_player_status text;
BEGIN
  IF NEW.match_id IS NULL THEN
    RAISE EXCEPTION 'match_id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.status INTO v_status
  FROM public.matches m
  WHERE m.id = NEW.match_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', NEW.match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('finished', 'cancelled', 'walkover') THEN
    RAISE EXCEPTION 'Cannot record events on a closed match (%)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Authenticated product sessions must pass can_capture_match.
  -- Privileged maintenance without JWT still cannot write closed/inactive rows above.
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.can_capture_match(NEW.match_id) THEN
      RAISE EXCEPTION 'Not authorized to capture match %', NEW.match_id
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT stp.registration_status INTO v_player_status
  FROM public.season_team_players stp
  WHERE stp.id = NEW.season_team_player_id;

  IF v_player_status IS NULL THEN
    RAISE EXCEPTION 'season_team_player % does not exist', NEW.season_team_player_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_player_status = 'inactive' THEN
    RAISE EXCEPTION 'Cannot record events for an inactive player'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_events_enforce_capture_rules ON public.match_events;
CREATE TRIGGER match_events_enforce_capture_rules
  BEFORE INSERT ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.match_events_enforce_capture_rules();

-- ---------------------------------------------------------------------------
-- C. RPC record_match_event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_match_event(
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
  v_uid uuid := auth.uid();
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

REVOKE ALL ON FUNCTION public.record_match_event(uuid, uuid, text, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_match_event(uuid, uuid, text, integer, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- D. db lint cleanup: unschedule_match without unused v_res
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unschedule_match(
  p_match_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Match id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.status
  INTO v_org, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Match not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status IN ('in_progress', 'finished') THEN
    RAISE EXCEPTION 'Cannot unschedule a match that has started or finished'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.matches
  SET field_reservation_id = NULL
  WHERE id = p_match_id
    AND organization_id = v_org;

  UPDATE public.field_reservations
  SET status = 'cancelled'
  WHERE match_id = p_match_id
    AND organization_id = v_org
    AND reservation_type = 'match'
    AND status = 'confirmed';
END;
$$;

REVOKE ALL ON FUNCTION public.unschedule_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unschedule_match(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- E. db lint cleanup: create_season_round_robin_fixture without unused v_a/v_b
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_season_round_robin_fixture(
  p_season_id uuid,
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
  v_mode text;
  v_team_ids uuid[];
  v_n integer;
  v_expected integer;
  v_elem jsonb;
  v_keys text[];
  v_expected_keys text[] := ARRAY[
    'away_season_team_id',
    'home_season_team_id',
    'leg_number',
    'round_number',
    'sequence_in_round'
  ];
  v_round integer;
  v_leg integer;
  v_seq integer;
  v_home uuid;
  v_away uuid;
  v_pair text;
  v_pair_set text[] := ARRAY[]::text[];
  v_pair_counts jsonb := '{}'::jsonb;
  v_pair_homes jsonb := '{}'::jsonb;
  v_round_teams text[];
  v_round_map jsonb := '{}'::jsonb;
  v_count integer;
  v_key text;
  v_homes text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required'
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

  SELECT s.organization_id INTO v_org
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

  SELECT COUNT(*) INTO v_count
  FROM public.matches m
  WHERE m.season_id = p_season_id;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Season already has matches; regeneration is not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(st.id ORDER BY st.created_at, st.id), ARRAY[]::uuid[])
  INTO v_team_ids
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.registration_status IN ('registered', 'confirmed');

  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two eligible teams are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_expected := CASE
    WHEN v_mode = 'single' THEN v_n * (v_n - 1) / 2
    ELSE v_n * (v_n - 1)
  END;

  IF jsonb_array_length(p_matches) <> v_expected THEN
    RAISE EXCEPTION 'Fixture match count must be % for % teams in % mode',
      v_expected, v_n, v_mode
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each match must be a JSON object'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
    INTO v_keys
    FROM jsonb_object_keys(v_elem) AS k;

    IF v_keys IS DISTINCT FROM v_expected_keys THEN
      RAISE EXCEPTION 'Unexpected or missing match properties'
        USING ERRCODE = 'P0001';
    END IF;

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

    IF v_round IS NULL OR v_round <= 0 THEN
      RAISE EXCEPTION 'round_number must be > 0'
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
    IF v_seq IS NULL OR v_seq <= 0 THEN
      RAISE EXCEPTION 'sequence_in_round must be > 0'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_home IS NULL OR v_away IS NULL THEN
      RAISE EXCEPTION 'home and away season teams are required'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_home = v_away THEN
      RAISE EXCEPTION 'Home and away must be distinct'
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT (v_home = ANY (v_team_ids)) OR NOT (v_away = ANY (v_team_ids)) THEN
      RAISE EXCEPTION 'Season team is not eligible for this season'
        USING ERRCODE = 'P0001';
    END IF;

    -- Per-round one appearance
    v_key := v_round::text;
    v_round_teams := COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_round_map->v_key))
      ),
      ARRAY[]::text[]
    );
    IF v_home::text = ANY (v_round_teams) OR v_away::text = ANY (v_round_teams) THEN
      RAISE EXCEPTION 'A team cannot play twice in the same round'
        USING ERRCODE = 'P0001';
    END IF;
    v_round_teams := v_round_teams || ARRAY[v_home::text, v_away::text];
    v_round_map := jsonb_set(
      v_round_map,
      ARRAY[v_key],
      to_jsonb(v_round_teams),
      true
    );

    -- Unordered pair tracking
    IF v_home::text < v_away::text THEN
      v_pair := v_home::text || ':' || v_away::text;
    ELSE
      v_pair := v_away::text || ':' || v_home::text;
    END IF;

    v_count := COALESCE((v_pair_counts->>v_pair)::integer, 0) + 1;
    v_pair_counts := jsonb_set(
      v_pair_counts,
      ARRAY[v_pair],
      to_jsonb(v_count),
      true
    );

    v_homes := COALESCE(
      (
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_pair_homes->v_pair))
      ),
      ARRAY[]::text[]
    );
    v_homes := v_homes || ARRAY[v_home::text];
    v_pair_homes := jsonb_set(
      v_pair_homes,
      ARRAY[v_pair],
      to_jsonb(v_homes),
      true
    );

    IF NOT (v_pair = ANY (v_pair_set)) THEN
      v_pair_set := v_pair_set || ARRAY[v_pair];
    END IF;
  END LOOP;

  -- Pair coverage
  IF COALESCE(array_length(v_pair_set, 1), 0) <> (v_n * (v_n - 1) / 2) THEN
    RAISE EXCEPTION 'Fixture must include every unique pair exactly as required'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_pair IN ARRAY v_pair_set
  LOOP
    v_count := COALESCE((v_pair_counts->>v_pair)::integer, 0);
    IF v_mode = 'single' THEN
      IF v_count <> 1 THEN
        RAISE EXCEPTION 'Single mode requires each pair exactly once'
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      IF v_count <> 2 THEN
        RAISE EXCEPTION 'Double mode requires each pair exactly twice'
          USING ERRCODE = 'P0001';
      END IF;
      v_homes := ARRAY(
        SELECT jsonb_array_elements_text(v_pair_homes->v_pair)
      );
      IF array_length(v_homes, 1) <> 2 OR v_homes[1] = v_homes[2] THEN
        RAISE EXCEPTION 'Double mode requires inverted home/away for each pair'
          USING ERRCODE = 'P0001';
      END IF;
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
    'Jornada ' || (e->>'round_number')
  FROM jsonb_array_elements(p_matches) AS e
  ORDER BY (e->>'round_number')::integer, (e->>'sequence_in_round')::integer;

  RETURN QUERY
  SELECT m.*
  FROM public.matches m
  WHERE m.season_id = p_season_id
  ORDER BY m.round_number NULLS LAST, m.sequence_in_round NULLS LAST, m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb)
  TO authenticated;
