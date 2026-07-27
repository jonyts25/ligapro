-- Migration 026: groups phase for format_type = 'groups_knockout'
-- Depends on Migration 025 (knockout bracket engine). Reuses round-robin + bracket motors.

-- ---------------------------------------------------------------------------
-- season_groups
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_groups_name_not_empty_check CHECK (NULLIF(btrim(name), '') IS NOT NULL),
  CONSTRAINT season_groups_season_name_unique UNIQUE (season_id, name)
);

CREATE INDEX season_groups_season_id_idx ON public.season_groups (season_id);
CREATE INDEX season_groups_organization_id_idx ON public.season_groups (organization_id);

CREATE TRIGGER season_groups_set_updated_at
  BEFORE UPDATE ON public.season_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.season_groups_enforce_org_matches_season()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_org uuid;
BEGIN
  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'Season % does not exist', NEW.season_id USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION 'organization_id must match season organization'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_groups_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF season_id, organization_id
  ON public.season_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.season_groups_enforce_org_matches_season();

COMMENT ON TABLE public.season_groups IS
  'Competition groups for groups_knockout seasons. Distinct from season_teams.group_name (informational only).';

-- ---------------------------------------------------------------------------
-- season_teams.season_group_id — real group assignment (does not touch group_name)
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_teams
  ADD COLUMN IF NOT EXISTS season_group_id uuid REFERENCES public.season_groups (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS season_teams_season_group_id_idx
  ON public.season_teams (season_group_id)
  WHERE season_group_id IS NOT NULL;

COMMENT ON COLUMN public.season_teams.season_group_id IS
  'FK to season_groups for groups_knockout fixture/standings. NULL = unassigned.';

-- ---------------------------------------------------------------------------
-- matches.season_group_id — group-phase fixtures (knockout matches keep NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS season_group_id uuid REFERENCES public.season_groups (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matches_season_group_id_idx
  ON public.matches (season_group_id)
  WHERE season_group_id IS NOT NULL;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_group_knockout_exclusive_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_group_knockout_exclusive_check
  CHECK (
    NOT (season_group_id IS NOT NULL AND knockout_round_id IS NOT NULL)
  );

COMMENT ON COLUMN public.matches.season_group_id IS
  'Group-phase league matches; NULL for knockout bracket matches and simple-league seasons.';

-- Per-group jornada uniqueness (group A and B may both use round 1 / sequence 1)
DROP INDEX IF EXISTS public.matches_season_round_sequence_unique;

CREATE UNIQUE INDEX matches_season_round_sequence_league_unique
  ON public.matches (season_id, round_number, sequence_in_round)
  WHERE round_number IS NOT NULL
    AND sequence_in_round IS NOT NULL
    AND season_group_id IS NULL
    AND knockout_round_id IS NULL;

CREATE UNIQUE INDEX matches_season_group_round_sequence_unique
  ON public.matches (season_id, season_group_id, round_number, sequence_in_round)
  WHERE season_group_id IS NOT NULL
    AND round_number IS NOT NULL
    AND sequence_in_round IS NOT NULL
    AND knockout_round_id IS NULL;

-- ---------------------------------------------------------------------------
-- season_rules.groups_advance_per_group
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_rules
  ADD COLUMN IF NOT EXISTS groups_advance_per_group integer;

ALTER TABLE public.season_rules
  DROP CONSTRAINT IF EXISTS season_rules_groups_advance_per_group_positive_check;
ALTER TABLE public.season_rules
  ADD CONSTRAINT season_rules_groups_advance_per_group_positive_check
  CHECK (groups_advance_per_group IS NULL OR groups_advance_per_group > 0);

COMMENT ON COLUMN public.season_rules.groups_advance_per_group IS
  'How many teams advance per group into knockout (groups_knockout). Admin-defined.';

-- ---------------------------------------------------------------------------
-- set_season_groups — atomic replace of group definitions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_season_groups(
  p_season_id uuid,
  p_group_names jsonb
)
RETURNS SETOF public.season_groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_name text;
  v_names text[] := ARRAY[]::text[];
  v_seen text[] := ARRAY[]::text[];
  v_elem jsonb;
  v_idx integer := 0;
  v_group record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_group_names IS NULL OR jsonb_typeof(p_group_names) <> 'array' THEN
    RAISE EXCEPTION 'Group names must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'groups_knockout' THEN
    RAISE EXCEPTION 'Season format must be groups_knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_group_names)
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_elem) <> 'string' THEN
      RAISE EXCEPTION 'Each group name must be a JSON string (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    v_name := NULLIF(btrim(v_elem #>> '{}'), '');

    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Group name cannot be empty (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF v_name = ANY (v_seen) THEN
      RAISE EXCEPTION 'Duplicate group name in payload: %', v_name
        USING ERRCODE = 'P0001';
    END IF;

    v_seen := v_seen || v_name;
    v_names := v_names || v_name;
  END LOOP;

  FOR v_group IN
    SELECT sg.id, sg.name
    FROM public.season_groups sg
    WHERE sg.season_id = p_season_id
      AND sg.organization_id = v_org
      AND NOT (sg.name = ANY (v_names))
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_group_id = v_group.id
    ) THEN
      RAISE EXCEPTION
        'Cannot remove group % while it has matches; delete group fixtures first',
        v_group.name
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE public.season_teams st
  SET season_group_id = NULL
  FROM public.season_groups sg
  WHERE st.season_group_id = sg.id
    AND sg.season_id = p_season_id
    AND sg.organization_id = v_org
    AND NOT (sg.name = ANY (v_names));

  DELETE FROM public.season_groups sg
  WHERE sg.season_id = p_season_id
    AND sg.organization_id = v_org
    AND NOT (sg.name = ANY (v_names));

  IF COALESCE(array_length(v_names, 1), 0) > 0 THEN
    INSERT INTO public.season_groups (organization_id, season_id, name)
    SELECT v_org, p_season_id, n
    FROM unnest(v_names) AS n
    ON CONFLICT (season_id, name) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT g.*
  FROM public.season_groups g
  WHERE g.season_id = p_season_id
    AND g.organization_id = v_org
  ORDER BY g.name ASC, g.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.set_season_groups(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_season_groups(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- assign_teams_to_groups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_teams_to_groups(
  p_season_id uuid,
  p_assignments jsonb
)
RETURNS SETOF public.season_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_elem jsonb;
  v_idx integer := 0;
  v_season_team_id uuid;
  v_group_id uuid;
  v_st_season uuid;
  v_st_org uuid;
  v_group_season uuid;
  v_group_org uuid;
  v_team_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_assignments IS NULL OR jsonb_typeof(p_assignments) <> 'array' THEN
    RAISE EXCEPTION 'Assignments must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'groups_knockout' THEN
    RAISE EXCEPTION 'Season format must be groups_knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_idx := v_idx + 1;

    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each assignment must be a JSON object (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_season_team_id := (v_elem ->> 'season_team_id')::uuid;
      v_group_id := (v_elem ->> 'group_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid UUID in assignment %', v_idx USING ERRCODE = 'P0001';
    END;

    IF v_season_team_id IS NULL OR v_group_id IS NULL THEN
      RAISE EXCEPTION 'season_team_id and group_id are required (index %)', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF v_season_team_id = ANY (v_team_ids) THEN
      RAISE EXCEPTION 'Duplicate season_team_id in payload: %', v_season_team_id
        USING ERRCODE = 'P0001';
    END IF;
    v_team_ids := v_team_ids || v_season_team_id;

    SELECT st.season_id, st.organization_id
    INTO v_st_season, v_st_org
    FROM public.season_teams st
    WHERE st.id = v_season_team_id;

    IF v_st_season IS NULL THEN
      RAISE EXCEPTION 'Season team % not found', v_season_team_id USING ERRCODE = 'P0001';
    END IF;

    IF v_st_season IS DISTINCT FROM p_season_id OR v_st_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Season team % does not belong to this season/organization', v_season_team_id
        USING ERRCODE = 'P0001';
    END IF;

    SELECT sg.season_id, sg.organization_id
    INTO v_group_season, v_group_org
    FROM public.season_groups sg
    WHERE sg.id = v_group_id;

    IF v_group_season IS NULL THEN
      RAISE EXCEPTION 'Group % not found', v_group_id USING ERRCODE = 'P0001';
    END IF;

    IF v_group_season IS DISTINCT FROM p_season_id OR v_group_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Group % does not belong to this season/organization', v_group_id
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE public.season_teams st
  SET season_group_id = NULL
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.id = ANY (v_team_ids);

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_season_team_id := (v_elem ->> 'season_team_id')::uuid;
    v_group_id := (v_elem ->> 'group_id')::uuid;

    UPDATE public.season_teams st
    SET season_group_id = v_group_id
    WHERE st.id = v_season_team_id;
  END LOOP;

  RETURN QUERY
  SELECT st.*
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
  ORDER BY st.created_at ASC, st.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_teams_to_groups(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_teams_to_groups(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- __create_knockout_bracket_from_slots — shared bracket seeding (Migration 025 refactor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__create_knockout_bracket_from_slots(
  p_season_id uuid,
  p_slots jsonb,
  p_require_no_prior_matches boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_team_count integer;
  v_bracket_size integer;
  v_num_slots integer;
  v_round_id uuid;
  v_round_label text;
  v_elem jsonb;
  v_slot integer;
  v_home uuid;
  v_away uuid;
  v_slots_seen integer[] := ARRAY[]::integer[];
  v_distinct_teams integer;
BEGIN
  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'Slots payload must be a JSON array' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF p_require_no_prior_matches AND EXISTS (
    SELECT 1 FROM public.matches m WHERE m.season_id = p_season_id
  ) THEN
    RAISE EXCEPTION 'Season already has matches' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.season_knockout_rounds kr WHERE kr.season_id = p_season_id
  ) THEN
    RAISE EXCEPTION 'Season already has a knockout bracket' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(DISTINCT tid)::integer
  INTO v_team_count
  FROM (
    SELECT (e ->> 'home_season_team_id')::uuid AS tid
    FROM jsonb_array_elements(p_slots) AS e
    UNION
    SELECT (e ->> 'away_season_team_id')::uuid
    FROM jsonb_array_elements(p_slots) AS e
    WHERE e ->> 'away_season_team_id' IS NOT NULL
  ) s
  WHERE tid IS NOT NULL;

  IF v_team_count < 2 THEN
    RAISE EXCEPTION 'At least two teams are required for knockout bracket'
      USING ERRCODE = 'P0001';
  END IF;

  v_bracket_size := public.__knockout_next_power_of_two(v_team_count);
  v_num_slots := v_bracket_size / 2;

  IF jsonb_array_length(p_slots) <> v_num_slots THEN
    RAISE EXCEPTION 'Expected % bracket slots for % teams, got %',
      v_num_slots, v_team_count, jsonb_array_length(p_slots)
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_slots)
  LOOP
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Each slot must be a JSON object' USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_slot := (v_elem ->> 'bracket_slot')::integer;
      v_home := (v_elem ->> 'home_season_team_id')::uuid;
      v_away := CASE
        WHEN v_elem ->> 'away_season_team_id' IS NULL THEN NULL
        ELSE (v_elem ->> 'away_season_team_id')::uuid
      END;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid slot field types' USING ERRCODE = 'P0001';
    END;

    IF v_slot IS NULL OR v_slot <= 0 OR v_slot > v_num_slots THEN
      RAISE EXCEPTION 'bracket_slot must be between 1 and %', v_num_slots
        USING ERRCODE = 'P0001';
    END IF;

    IF v_slot = ANY (v_slots_seen) THEN
      RAISE EXCEPTION 'Duplicate bracket_slot %', v_slot USING ERRCODE = 'P0001';
    END IF;
    v_slots_seen := v_slots_seen || v_slot;

    IF v_home IS NULL THEN
      RAISE EXCEPTION 'home_season_team_id is required for slot %', v_slot
        USING ERRCODE = 'P0001';
    END IF;

    IF v_away IS NOT NULL AND v_home = v_away THEN
      RAISE EXCEPTION 'Home and away must be distinct in slot %', v_slot
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.season_teams st
      WHERE st.id = v_home AND st.season_id = p_season_id AND st.organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'Home team in slot % is not eligible', v_slot USING ERRCODE = 'P0001';
    END IF;

    IF v_away IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.season_teams st
      WHERE st.id = v_away AND st.season_id = p_season_id AND st.organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'Away team in slot % is not eligible', v_slot USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF v_slots_seen IS DISTINCT FROM (
    SELECT array_agg(i ORDER BY i)
    FROM generate_series(1, v_num_slots) AS i
  ) THEN
    RAISE EXCEPTION 'bracket_slot values must cover 1..% exactly once', v_num_slots
      USING ERRCODE = 'P0001';
  END IF;

  v_round_label := public.__knockout_round_label(v_bracket_size, 1);

  INSERT INTO public.season_knockout_rounds (
    organization_id,
    season_id,
    round_number,
    round_label,
    bracket_size,
    is_two_legs
  ) VALUES (
    v_org,
    p_season_id,
    1,
    v_round_label,
    v_bracket_size,
    false
  )
  RETURNING id INTO v_round_id;

  FOR v_elem IN
    SELECT value
    FROM jsonb_array_elements(p_slots)
    ORDER BY (value ->> 'bracket_slot')::integer
  LOOP
    v_slot := (v_elem ->> 'bracket_slot')::integer;
    v_home := (v_elem ->> 'home_season_team_id')::uuid;
    v_away := CASE
      WHEN v_elem ->> 'away_season_team_id' IS NULL THEN NULL
      ELSE (v_elem ->> 'away_season_team_id')::uuid
    END;

    INSERT INTO public.season_knockout_ties (
      organization_id,
      season_id,
      knockout_round_id,
      bracket_slot,
      home_season_team_id,
      away_season_team_id
    ) VALUES (
      v_org,
      p_season_id,
      v_round_id,
      v_slot,
      v_home,
      v_away
    );

    IF v_away IS NOT NULL THEN
      PERFORM public.__knockout_create_tie_matches(
        v_org,
        p_season_id,
        v_round_id,
        v_round_label,
        v_slot,
        v_home,
        v_away,
        false
      );
    END IF;
  END LOOP;

  SELECT COUNT(DISTINCT tid)::integer INTO v_distinct_teams
  FROM (
    SELECT (e ->> 'home_season_team_id')::uuid AS tid FROM jsonb_array_elements(p_slots) e
    UNION
    SELECT (e ->> 'away_season_team_id')::uuid FROM jsonb_array_elements(p_slots) e
    WHERE e ->> 'away_season_team_id' IS NOT NULL
  ) s;

  RETURN jsonb_build_object(
    'season_id', p_season_id,
    'round_id', v_round_id,
    'round_number', 1,
    'round_label', v_round_label,
    'bracket_size', v_bracket_size,
    'num_byes', v_bracket_size - v_distinct_teams,
    'num_slots', v_num_slots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.__create_knockout_bracket_from_slots(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;

-- Refactor create_season_knockout_bracket to use internal slots builder
CREATE OR REPLACE FUNCTION public.create_season_knockout_bracket(
  p_season_id uuid,
  p_seed_mode text DEFAULT 'random'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_team_ids uuid[];
  v_n integer;
  v_bracket_size integer;
  v_num_byes integer;
  v_num_slots integer;
  v_bye_teams uuid[];
  v_play_teams uuid[];
  v_slot integer;
  v_bye_idx integer := 1;
  v_play_idx integer := 1;
  v_home uuid;
  v_away uuid;
  v_bye_slots integer[];
  v_slots jsonb := '[]'::jsonb;
  i integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(NULLIF(btrim(p_seed_mode), ''), 'random') <> 'random' THEN
    RAISE EXCEPTION 'Only random seed mode is supported' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'knockout' THEN
    RAISE EXCEPTION 'Season format must be knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  SELECT COALESCE(array_agg(st.id ORDER BY random()), ARRAY[]::uuid[])
  INTO v_team_ids
  FROM public.season_teams st
  WHERE st.season_id = p_season_id
    AND st.organization_id = v_org
    AND st.registration_status IN ('registered', 'confirmed');

  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two eligible teams are required' USING ERRCODE = 'P0001';
  END IF;

  v_bracket_size := public.__knockout_next_power_of_two(v_n);
  v_num_byes := v_bracket_size - v_n;
  v_num_slots := v_bracket_size / 2;

  v_bye_teams := v_team_ids[1:v_num_byes];
  v_play_teams := v_team_ids[(v_num_byes + 1):v_n];

  v_bye_slots := ARRAY[]::integer[];
  FOR i IN 1..v_num_byes LOOP
    v_bye_slots := v_bye_slots || (
      (i - 1) * v_num_slots / GREATEST(v_num_byes, 1) + 1
    )::integer;
  END LOOP;

  FOR v_slot IN 1..v_num_slots LOOP
    IF v_slot = ANY (v_bye_slots) THEN
      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_bye_teams[v_bye_idx],
          'away_season_team_id', NULL
        )
      );
      v_bye_idx := v_bye_idx + 1;
    ELSE
      v_home := v_play_teams[v_play_idx];
      v_away := v_play_teams[v_play_idx + 1];
      v_play_idx := v_play_idx + 2;

      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_home,
          'away_season_team_id', v_away
        )
      );
    END IF;
  END LOOP;

  RETURN public.__create_knockout_bracket_from_slots(
    p_season_id,
    v_slots,
    true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- create_season_round_robin_fixture — optional p_group_id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_season_round_robin_fixture(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_season_round_robin_fixture(
  p_season_id uuid,
  p_mode text,
  p_matches jsonb,
  p_group_id uuid DEFAULT NULL
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
  v_group_season uuid;
  v_group_org uuid;
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

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  IF p_group_id IS NOT NULL THEN
    SELECT sg.season_id, sg.organization_id
    INTO v_group_season, v_group_org
    FROM public.season_groups sg
    WHERE sg.id = p_group_id;

    IF v_group_season IS NULL THEN
      RAISE EXCEPTION 'Group not found' USING ERRCODE = 'P0001';
    END IF;

    IF v_group_season IS DISTINCT FROM p_season_id OR v_group_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Group does not belong to this season' USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.matches m
    WHERE m.season_id = p_season_id
      AND m.season_group_id = p_group_id
      AND m.knockout_round_id IS NULL;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'Group already has matches; regeneration is not allowed'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM public.matches m
    WHERE m.season_id = p_season_id;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'Season already has matches; regeneration is not allowed'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_group_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(st.id ORDER BY st.created_at, st.id), ARRAY[]::uuid[])
    INTO v_team_ids
    FROM public.season_teams st
    WHERE st.season_id = p_season_id
      AND st.organization_id = v_org
      AND st.season_group_id = p_group_id
      AND st.registration_status IN ('registered', 'confirmed');
  ELSE
    SELECT COALESCE(array_agg(st.id ORDER BY st.created_at, st.id), ARRAY[]::uuid[])
    INTO v_team_ids
    FROM public.season_teams st
    WHERE st.season_id = p_season_id
      AND st.organization_id = v_org
      AND st.registration_status IN ('registered', 'confirmed');
  END IF;

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
    round_label,
    season_group_id
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
      WHEN p_group_id IS NOT NULL THEN
        'Jornada ' || (e->>'round_number')
      ELSE
        'Jornada ' || (e->>'round_number')
    END,
    p_group_id
  FROM jsonb_array_elements(p_matches) AS e
  ORDER BY (e->>'round_number')::integer, (e->>'sequence_in_round')::integer;

  RETURN QUERY
  SELECT m.*
  FROM public.matches m
  WHERE m.season_id = p_season_id
    AND (
      (p_group_id IS NULL AND m.season_group_id IS NULL AND m.knockout_round_id IS NULL)
      OR m.season_group_id = p_group_id
    )
  ORDER BY m.round_number NULLS LAST, m.sequence_in_round NULLS LAST, m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- __season_standings_core / get_season_standings — optional p_group_id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_season_standings(uuid);
DROP FUNCTION IF EXISTS public.__season_standings_core(uuid);

CREATE OR REPLACE FUNCTION public.__season_standings_core(
  p_season_id uuid,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE (
  "position" integer,
  season_team_id uuid,
  team_id uuid,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_win integer;
  v_points_draw integer;
  v_points_loss integer;
BEGIN
  SELECT sr.points_win, sr.points_draw, sr.points_loss
  INTO v_points_win, v_points_draw, v_points_loss
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_points_win IS NULL THEN
    RETURN;
  END IF;

  IF p_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.season_groups sg
    WHERE sg.id = p_group_id AND sg.season_id = p_season_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH teams AS (
    SELECT
      st.id AS season_team_id,
      st.team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      st.registration_status
    FROM public.season_teams st
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = p_season_id
      AND (p_group_id IS NULL OR st.season_group_id = p_group_id)
  ),
  official AS (
    SELECT
      m.id,
      m.home_season_team_id,
      m.away_season_team_id,
      m.home_score,
      m.away_score,
      m.created_at,
      fr.starts_at
    FROM public.matches m
    LEFT JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
    WHERE m.season_id = p_season_id
      AND m.knockout_round_id IS NULL
      AND (p_group_id IS NULL OR m.season_group_id = p_group_id)
      AND m.status IN ('finished', 'walkover')
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  ),
  results AS (
    SELECT
      o.home_season_team_id AS season_team_id,
      CASE
        WHEN o.home_score > o.away_score THEN 'W'
        WHEN o.home_score < o.away_score THEN 'L'
        ELSE 'D'
      END AS result,
      o.home_score AS gf,
      o.away_score AS ga,
      COALESCE(o.starts_at, o.created_at) AS sort_at,
      o.id AS match_id
    FROM official o
    UNION ALL
    SELECT
      o.away_season_team_id,
      CASE
        WHEN o.away_score > o.home_score THEN 'W'
        WHEN o.away_score < o.home_score THEN 'L'
        ELSE 'D'
      END,
      o.away_score,
      o.home_score,
      COALESCE(o.starts_at, o.created_at),
      o.id
    FROM official o
  ),
  agg AS (
    SELECT
      t.season_team_id,
      t.team_id,
      t.team_name,
      t.registration_status,
      COALESCE(COUNT(r.match_id), 0)::integer AS played,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0)::integer AS won,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0)::integer AS drawn,
      COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0)::integer AS lost,
      COALESCE(SUM(r.gf), 0)::integer AS goals_for,
      COALESCE(SUM(r.ga), 0)::integer AS goals_against,
      (
        COALESCE(SUM(r.gf), 0) - COALESCE(SUM(r.ga), 0)
      )::integer AS goal_difference,
      (
        COALESCE(COUNT(*) FILTER (WHERE r.result = 'W'), 0) * v_points_win
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'D'), 0) * v_points_draw
        + COALESCE(COUNT(*) FILTER (WHERE r.result = 'L'), 0) * v_points_loss
      )::integer AS points
    FROM teams t
    LEFT JOIN results r ON r.season_team_id = t.season_team_id
    GROUP BY t.season_team_id, t.team_id, t.team_name, t.registration_status
  ),
  form_ranked AS (
    SELECT
      r.season_team_id,
      r.result,
      ROW_NUMBER() OVER (
        PARTITION BY r.season_team_id
        ORDER BY r.sort_at DESC, r.match_id DESC
      ) AS rn
    FROM results r
  ),
  form_agg AS (
    SELECT
      fr.season_team_id,
      string_agg(
        CASE fr.result
          WHEN 'W' THEN 'G'
          WHEN 'D' THEN 'E'
          ELSE 'P'
        END,
        ''
        ORDER BY fr.rn DESC
      ) AS recent_form
    FROM form_ranked fr
    WHERE fr.rn <= 5
    GROUP BY fr.season_team_id
  ),
  ranked AS (
    SELECT
      a.*,
      COALESCE(f.recent_form, '') AS recent_form,
      RANK() OVER (
        ORDER BY a.points DESC, a.goal_difference DESC, a.goals_for DESC
      )::integer AS "position"
    FROM agg a
    LEFT JOIN form_agg f ON f.season_team_id = a.season_team_id
  )
  SELECT
    r."position",
    r.season_team_id,
    r.team_id,
    r.team_name,
    r.registration_status,
    r.played,
    r.won,
    r.drawn,
    r.lost,
    r.goals_for,
    r.goals_against,
    r.goal_difference,
    r.points,
    r.recent_form
  FROM ranked r
  ORDER BY r."position" ASC, r.team_name ASC, r.season_team_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.__season_standings_core(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_season_standings(
  p_season_id uuid,
  p_group_id uuid DEFAULT NULL
)
RETURNS TABLE (
  "position" integer,
  season_team_id uuid,
  team_id uuid,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);
  RETURN QUERY SELECT * FROM public.__season_standings_core(p_season_id, p_group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_season_standings(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_season_standings(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public: groups list + standings by group name
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_season_groups(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  group_id uuid,
  group_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sg.id, sg.name
  FROM public.season_groups sg
  WHERE sg.season_id = v_season_id
    AND sg.organization_id = p_organization_id
  ORDER BY sg.name ASC, sg.id ASC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_public_season_standings(uuid, text);

CREATE OR REPLACE FUNCTION public.get_public_season_standings(
  p_organization_id uuid,
  p_season_slug text,
  p_group_name text DEFAULT NULL
)
RETURNS TABLE (
  "position" integer,
  team_name text,
  registration_status text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  recent_form text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_group_id uuid;
BEGIN
  v_season_id := public.__resolve_public_season(p_organization_id, p_season_slug);
  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  IF NULLIF(btrim(COALESCE(p_group_name, '')), '') IS NOT NULL THEN
    SELECT sg.id INTO v_group_id
    FROM public.season_groups sg
    WHERE sg.season_id = v_season_id
      AND sg.organization_id = p_organization_id
      AND sg.name = NULLIF(btrim(p_group_name), '');

    IF v_group_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    c."position",
    c.team_name,
    c.registration_status,
    c.played,
    c.won,
    c.drawn,
    c.lost,
    c.goals_for,
    c.goals_against,
    c.goal_difference,
    c.points,
    c.recent_form
  FROM public.__season_standings_core(v_season_id, v_group_id) c;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_season_groups(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_season_groups(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_season_standings(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_season_standings(uuid, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- generate_knockout_from_groups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_knockout_from_groups(p_season_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_format text;
  v_advance integer;
  v_group_count integer;
  v_group record;
  v_standings record;
  v_advancing jsonb := '[]'::jsonb;
  v_team_count integer;
  v_bracket_size integer;
  v_num_byes integer;
  v_num_slots integer;
  v_pairings jsonb := '[]'::jsonb;
  v_slots jsonb := '[]'::jsonb;
  v_bye_teams uuid[] := ARRAY[]::uuid[];
  v_play_home uuid[] := ARRAY[]::uuid[];
  v_play_away uuid[] := ARRAY[]::uuid[];
  v_play_count integer;
  v_bye_slots integer[];
  v_slot integer;
  v_bye_idx integer := 1;
  v_play_idx integer := 1;
  v_i integer;
  v_j integer;
  v_g integer;
  v_k integer;
  v_home uuid;
  v_away uuid;
  v_team uuid;
  v_group_id uuid;
  v_pos integer;
  v_used uuid[] := ARRAY[]::uuid[];
  v_candidates uuid[];
  v_cross_ok boolean := false;
  v_pair jsonb;
  v_elem jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NULL THEN
    RAISE EXCEPTION 'Season id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.organization_id, s.format_type
  INTO v_org, v_format
  FROM public.seasons s
  WHERE s.id = p_season_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_format <> 'groups_knockout' THEN
    RAISE EXCEPTION 'Season format must be groups_knockout' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_platform_billing_active(p_season_id);

  SELECT sr.groups_advance_per_group INTO v_advance
  FROM public.season_rules sr
  WHERE sr.season_id = p_season_id;

  IF v_advance IS NULL OR v_advance <= 0 THEN
    RAISE EXCEPTION 'Configure groups_advance_per_group on season_rules first'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_group_count
  FROM public.season_groups sg
  WHERE sg.season_id = p_season_id;

  IF v_group_count < 1 THEN
    RAISE EXCEPTION 'Season has no groups configured' USING ERRCODE = 'P0001';
  END IF;

  FOR v_group IN
    SELECT sg.id, sg.name
    FROM public.season_groups sg
    WHERE sg.season_id = p_season_id
    ORDER BY sg.name ASC, sg.id ASC
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_group_id = v_group.id
        AND m.knockout_round_id IS NULL
        AND (
          m.status NOT IN ('finished', 'walkover')
          OR m.home_score IS NULL
          OR m.away_score IS NULL
        )
    ) THEN
      RAISE EXCEPTION
        'Group % has matches without final results; complete the group fixture first',
        v_group.name
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.season_teams st
      WHERE st.season_group_id = v_group.id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.season_group_id = v_group.id
        AND m.knockout_round_id IS NULL
        AND m.status IN ('finished', 'walkover')
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'Group % has no completed match results; cannot determine standings',
        v_group.name
        USING ERRCODE = 'P0001';
    END IF;

    FOR v_pos IN 1..v_advance LOOP
      SELECT c.season_team_id, c."position"
      INTO v_standings
      FROM public.__season_standings_core(p_season_id, v_group.id) c
      WHERE c."position" = v_pos
      ORDER BY c.team_name ASC, c.season_team_id ASC
      LIMIT 1;

      IF v_standings.season_team_id IS NULL THEN
        RAISE EXCEPTION
          'Group % does not have % distinct ranked teams to advance',
          v_group.name, v_advance
          USING ERRCODE = 'P0001';
      END IF;

      v_advancing := v_advancing || jsonb_build_array(
        jsonb_build_object(
          'season_team_id', v_standings.season_team_id,
          'group_id', v_group.id,
          'group_name', v_group.name,
          'position', v_pos
        )
      );
    END LOOP;
  END LOOP;

  v_team_count := jsonb_array_length(v_advancing);
  IF v_team_count < 2 THEN
    RAISE EXCEPTION 'At least two advancing teams are required for knockout'
      USING ERRCODE = 'P0001';
  END IF;

  v_g := v_group_count;
  v_k := v_advance;

  -- Cross pairing: G=2 any K, or K=1 with even G
  IF v_g = 2 THEN
    v_cross_ok := true;
    FOR v_i IN 0..0 LOOP
      FOR v_pos IN 1..v_k LOOP
        SELECT (e ->> 'season_team_id')::uuid INTO v_home
        FROM jsonb_array_elements(v_advancing) e
        WHERE (e ->> 'group_id')::uuid = (
          SELECT sg.id FROM public.season_groups sg
          WHERE sg.season_id = p_season_id
          ORDER BY sg.name ASC, sg.id ASC
          LIMIT 1 OFFSET 0
        )
          AND (e ->> 'position')::integer = v_pos;

        SELECT (e ->> 'season_team_id')::uuid INTO v_away
        FROM jsonb_array_elements(v_advancing) e
        WHERE (e ->> 'group_id')::uuid = (
          SELECT sg.id FROM public.season_groups sg
          WHERE sg.season_id = p_season_id
          ORDER BY sg.name ASC, sg.id ASC
          LIMIT 1 OFFSET 1
        )
          AND (e ->> 'position')::integer = (v_k + 1 - v_pos);

        IF v_home IS NULL OR v_away IS NULL OR v_home = v_away THEN
          v_cross_ok := false;
          EXIT;
        END IF;

        v_pairings := v_pairings || jsonb_build_array(
          jsonb_build_object('home', v_home, 'away', v_away)
        );
        v_used := v_used || v_home || v_away;
      END LOOP;
    END LOOP;
  ELSIF v_k = 1 AND v_g >= 2 AND v_g % 2 = 0 THEN
    v_cross_ok := true;
    FOR v_i IN 0..(v_g / 2 - 1) LOOP
      SELECT (e ->> 'season_team_id')::uuid INTO v_home
      FROM jsonb_array_elements(v_advancing) e
      WHERE (e ->> 'group_id')::uuid = (
        SELECT sg.id FROM public.season_groups sg
        WHERE sg.season_id = p_season_id
        ORDER BY sg.name ASC, sg.id ASC
        LIMIT 1 OFFSET v_i
      )
        AND (e ->> 'position')::integer = 1;

      SELECT (e ->> 'season_team_id')::uuid INTO v_away
      FROM jsonb_array_elements(v_advancing) e
      WHERE (e ->> 'group_id')::uuid = (
        SELECT sg.id FROM public.season_groups sg
        WHERE sg.season_id = p_season_id
        ORDER BY sg.name ASC, sg.id ASC
        LIMIT 1 OFFSET (v_i + v_g / 2)
      )
        AND (e ->> 'position')::integer = 1;

      IF v_home IS NULL OR v_away IS NULL OR v_home = v_away THEN
        v_cross_ok := false;
        EXIT;
      END IF;

      v_pairings := v_pairings || jsonb_build_array(
        jsonb_build_object('home', v_home, 'away', v_away)
      );
      v_used := v_used || v_home || v_away;
    END LOOP;
  END IF;

  IF NOT v_cross_ok OR jsonb_array_length(v_pairings) * 2 <> v_team_count THEN
    v_pairings := '[]'::jsonb;
    v_used := ARRAY[]::uuid[];

    FOR v_elem IN
      SELECT value
      FROM jsonb_array_elements(v_advancing)
      ORDER BY random()
    LOOP
      v_team := (v_elem ->> 'season_team_id')::uuid;
      v_group_id := (v_elem ->> 'group_id')::uuid;

      IF v_team = ANY (v_used) THEN
        CONTINUE;
      END IF;

      v_candidates := ARRAY[]::uuid[];
      FOR v_j IN
        SELECT (e ->> 'season_team_id')::uuid
        FROM jsonb_array_elements(v_advancing) e
        WHERE NOT ((e ->> 'season_team_id')::uuid = ANY (v_used))
          AND (e ->> 'season_team_id')::uuid <> v_team
          AND (e ->> 'group_id')::uuid IS DISTINCT FROM v_group_id
      LOOP
        v_candidates := v_candidates || v_j;
      END LOOP;

      IF COALESCE(array_length(v_candidates, 1), 0) = 0 THEN
        FOR v_j IN
          SELECT (e ->> 'season_team_id')::uuid
          FROM jsonb_array_elements(v_advancing) e
          WHERE NOT ((e ->> 'season_team_id')::uuid = ANY (v_used))
            AND (e ->> 'season_team_id')::uuid <> v_team
        LOOP
          v_candidates := v_candidates || v_j;
        END LOOP;
      END IF;

      IF COALESCE(array_length(v_candidates, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Unable to pair advancing teams' USING ERRCODE = 'P0001';
      END IF;

      v_away := v_candidates[1 + floor(random() * array_length(v_candidates, 1))::integer];
      v_pairings := v_pairings || jsonb_build_array(
        jsonb_build_object('home', v_team, 'away', v_away)
      );
      v_used := v_used || v_team || v_away;
    END LOOP;
  END IF;

  v_bracket_size := public.__knockout_next_power_of_two(v_team_count);
  v_num_byes := v_bracket_size - v_team_count;
  v_num_slots := v_bracket_size / 2;
  v_play_count := jsonb_array_length(v_pairings);

  FOR v_i IN 1..v_play_count LOOP
    v_play_home := v_play_home || (v_pairings -> (v_i - 1) ->> 'home')::uuid;
    v_play_away := v_play_away || (v_pairings -> (v_i - 1) ->> 'away')::uuid;
  END LOOP;

  FOR v_j IN
    SELECT (e ->> 'season_team_id')::uuid
    FROM jsonb_array_elements(v_advancing) e
    WHERE NOT ((e ->> 'season_team_id')::uuid = ANY (v_used))
  LOOP
    v_bye_teams := v_bye_teams || v_j;
  END LOOP;

  IF COALESCE(array_length(v_bye_teams, 1), 0) <> v_num_byes THEN
    RAISE EXCEPTION 'Internal bracket bye count mismatch' USING ERRCODE = 'P0001';
  END IF;

  v_bye_slots := ARRAY[]::integer[];
  FOR v_i IN 1..v_num_byes LOOP
    v_bye_slots := v_bye_slots || (
      (v_i - 1) * v_num_slots / GREATEST(v_num_byes, 1) + 1
    )::integer;
  END LOOP;

  FOR v_slot IN 1..v_num_slots LOOP
    IF v_slot = ANY (v_bye_slots) THEN
      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_bye_teams[v_bye_idx],
          'away_season_team_id', NULL
        )
      );
      v_bye_idx := v_bye_idx + 1;
    ELSE
      v_home := v_play_home[v_play_idx];
      v_away := v_play_away[v_play_idx];
      v_play_idx := v_play_idx + 1;

      v_slots := v_slots || jsonb_build_array(
        jsonb_build_object(
          'bracket_slot', v_slot,
          'home_season_team_id', v_home,
          'away_season_team_id', v_away
        )
      );
    END IF;
  END LOOP;

  RETURN public.__create_knockout_bracket_from_slots(
    p_season_id,
    v_slots,
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_knockout_from_groups(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_knockout_from_groups(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS — season_groups
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_groups_select_member
  ON public.season_groups FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.season_groups FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.set_season_groups(uuid, jsonb) IS
  'Atomic replace of group definitions for a groups_knockout season. Owner/admin only.';
COMMENT ON FUNCTION public.assign_teams_to_groups(uuid, jsonb) IS
  'Assign season teams to season_groups. Owner/admin only.';
COMMENT ON FUNCTION public.generate_knockout_from_groups(uuid) IS
  'Seed knockout R1 from group standings using groups_advance_per_group. Owner/admin only.';
COMMENT ON FUNCTION public.get_season_standings(uuid, uuid) IS
  'Season standings; optional p_group_id scopes to one group (excludes knockout matches).';
COMMENT ON FUNCTION public.get_public_season_standings(uuid, text, text) IS
  'Public standings; optional p_group_name for groups_knockout seasons.';
COMMENT ON FUNCTION public.create_season_round_robin_fixture(uuid, text, jsonb, uuid) IS
  'Insert round-robin fixture; optional p_group_id limits teams/matches to one group.';
