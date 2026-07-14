-- Migration 016: fixture round-robin columns + atomic fixture/schedule RPCs
-- Extends matches with round/leg/sequence. Uses field_reservations as occupancy source.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS round_number integer,
  ADD COLUMN IF NOT EXISTS leg_number integer,
  ADD COLUMN IF NOT EXISTS sequence_in_round integer;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_round_number_positive_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_round_number_positive_check
  CHECK (round_number IS NULL OR round_number > 0);

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_leg_number_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_leg_number_check
  CHECK (leg_number IS NULL OR leg_number IN (1, 2));

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_sequence_in_round_positive_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_sequence_in_round_positive_check
  CHECK (sequence_in_round IS NULL OR sequence_in_round > 0);

CREATE UNIQUE INDEX IF NOT EXISTS matches_season_round_sequence_unique
  ON public.matches (season_id, round_number, sequence_in_round)
  WHERE round_number IS NOT NULL AND sequence_in_round IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS field_reservations_one_confirmed_per_match
  ON public.field_reservations (match_id)
  WHERE match_id IS NOT NULL
    AND status = 'confirmed'
    AND reservation_type = 'match';

COMMENT ON COLUMN public.matches.round_number IS
  'Jornada (1-based). NULL allowed for future non-league manual matches.';
COMMENT ON COLUMN public.matches.leg_number IS
  '1 = primera vuelta, 2 = segunda. NULL for future manual matches.';
COMMENT ON COLUMN public.matches.sequence_in_round IS
  'Order within a jornada. NULL for future manual matches.';

-- ---------------------------------------------------------------------------
-- create_season_round_robin_fixture
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
  v_a text;
  v_b text;
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

-- ---------------------------------------------------------------------------
-- schedule_match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_match(
  p_match_id uuid,
  p_field_id uuid,
  p_starts_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_season uuid;
  v_status text;
  v_existing_res uuid;
  v_field_active boolean;
  v_venue_active boolean;
  v_field_org uuid;
  v_duration integer;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_dow integer;
  v_start_time time;
  v_end_time time;
  v_rule_count integer;
  v_res_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL OR p_field_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Match, field and starts_at are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.season_id, m.status, m.field_reservation_id
  INTO v_org, v_season, v_status, v_existing_res
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

  IF v_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be programmed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    f.is_active,
    f.organization_id,
    v.is_active
  INTO v_field_active, v_field_org, v_venue_active
  FROM public.fields f
  JOIN public.venues v ON v.id = f.venue_id
  WHERE f.id = p_field_id;

  IF v_field_org IS NULL THEN
    RAISE EXCEPTION 'Field not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_field_org IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Field does not belong to this organization'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_field_active, false) THEN
    RAISE EXCEPTION 'Field is inactive'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_venue_active, false) THEN
    RAISE EXCEPTION 'Venue is inactive'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(sr.match_duration_minutes, 0)
      + COALESCE(sr.minimum_rest_minutes, 0)
  INTO v_duration
  FROM public.season_rules sr
  WHERE sr.season_id = v_season;

  IF v_duration IS NULL OR v_duration <= 0 THEN
    RAISE EXCEPTION 'Season match duration is not configured'
      USING ERRCODE = 'P0001';
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  v_local_start := p_starts_at AT TIME ZONE 'America/Mexico_City';
  v_local_end := v_ends_at AT TIME ZONE 'America/Mexico_City';

  IF v_local_start::date IS DISTINCT FROM v_local_end::date THEN
    RAISE EXCEPTION 'Match slot cannot cross midnight in America/Mexico_City'
      USING ERRCODE = 'P0001';
  END IF;

  v_dow := EXTRACT(DOW FROM v_local_start)::integer;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  SELECT COUNT(*) INTO v_rule_count
  FROM public.field_availability_rules far
  WHERE far.field_id = p_field_id
    AND far.day_of_week = v_dow;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION 'Field has no availability rules for this weekday'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_rule_count
  FROM public.field_availability_rules far
  WHERE far.field_id = p_field_id
    AND far.day_of_week = v_dow
    AND v_start_time >= far.starts_at
    AND v_end_time <= far.ends_at;

  IF v_rule_count = 0 THEN
    RAISE EXCEPTION 'Slot is outside field availability'
      USING ERRCODE = 'P0001';
  END IF;

  -- Prefer updating the linked reservation (atomic reschedule)
  IF v_existing_res IS NOT NULL THEN
    UPDATE public.field_reservations fr
    SET
      field_id = p_field_id,
      starts_at = p_starts_at,
      ends_at = v_ends_at,
      reservation_type = 'match',
      match_id = p_match_id,
      status = 'confirmed',
      title = COALESCE(fr.title, 'Partido')
    WHERE fr.id = v_existing_res
      AND fr.organization_id = v_org;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Existing reservation not found for match'
        USING ERRCODE = 'P0001';
    END IF;

    RETURN;
  END IF;

  -- Or revive a prior cancelled match reservation
  SELECT fr.id INTO v_res_id
  FROM public.field_reservations fr
  WHERE fr.match_id = p_match_id
    AND fr.organization_id = v_org
    AND fr.reservation_type = 'match'
  ORDER BY fr.updated_at DESC
  LIMIT 1;

  IF v_res_id IS NOT NULL THEN
    UPDATE public.field_reservations
    SET
      field_id = p_field_id,
      starts_at = p_starts_at,
      ends_at = v_ends_at,
      status = 'confirmed',
      reservation_type = 'match',
      match_id = p_match_id,
      title = COALESCE(title, 'Partido')
    WHERE id = v_res_id;

    UPDATE public.matches
    SET field_reservation_id = v_res_id
    WHERE id = p_match_id
      AND organization_id = v_org;

    RETURN;
  END IF;

  INSERT INTO public.field_reservations (
    organization_id,
    field_id,
    reservation_type,
    match_id,
    starts_at,
    ends_at,
    title,
    status
  ) VALUES (
    v_org,
    p_field_id,
    'match',
    p_match_id,
    p_starts_at,
    v_ends_at,
    'Partido',
    'confirmed'
  )
  RETURNING id INTO v_res_id;

  UPDATE public.matches
  SET field_reservation_id = v_res_id
  WHERE id = p_match_id
    AND organization_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_match(uuid, uuid, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_match(uuid, uuid, timestamptz)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- unschedule_match
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
  v_res uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Match id is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT m.organization_id, m.status, m.field_reservation_id
  INTO v_org, v_status, v_res
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

REVOKE ALL ON FUNCTION public.unschedule_match(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unschedule_match(uuid)
  TO authenticated;
