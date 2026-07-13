-- Migration 012: venues/fields is_active + availability overlap + replace RPC
-- Reuses: has_role_in_org, is_member_of, btree_gist (enabled since Migration 005)

-- ---------------------------------------------------------------------------
-- Active flags
-- ---------------------------------------------------------------------------
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- Overlap protection for habitual availability (same field + day)
-- Default timerange bounds are [) so contiguous intervals do not conflict.
-- ---------------------------------------------------------------------------
ALTER TABLE public.field_availability_rules
  DROP CONSTRAINT IF EXISTS no_overlapping_field_availability;

-- Map time-of-day onto a fixed date so we can use tsrange ([) bounds).
-- Contiguous intervals (08:00–12:00, 12:00–16:00) do not overlap.
ALTER TABLE public.field_availability_rules
  ADD CONSTRAINT no_overlapping_field_availability
  EXCLUDE USING gist (
    field_id WITH =,
    day_of_week WITH =,
    tsrange(
      ('2000-01-01'::date + starts_at),
      ('2000-01-01'::date + ends_at)
    ) WITH &&
  );

-- ---------------------------------------------------------------------------
-- replace_field_availability — atomic weekly replace
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_field_availability(
  p_field_id uuid,
  p_intervals jsonb
)
RETURNS SETOF public.field_availability_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_venue_org uuid;
  v_elem jsonb;
  v_day integer;
  v_starts time;
  v_ends time;
  v_idx integer := 0;
  v_i integer;
  v_j integer;
  v_len integer;
  v_days integer[];
  v_starts_arr time[];
  v_ends_arr time[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_field_id IS NULL THEN
    RAISE EXCEPTION 'Field id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_intervals IS NULL OR jsonb_typeof(p_intervals) <> 'array' THEN
    RAISE EXCEPTION 'Intervals must be a JSON array'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT f.organization_id, v.organization_id
  INTO v_org_id, v_venue_org
  FROM public.fields f
  INNER JOIN public.venues v ON v.id = f.venue_id
  WHERE f.id = p_field_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Field not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_org_id IS DISTINCT FROM v_venue_org THEN
    RAISE EXCEPTION 'Field and venue organization mismatch'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_org_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  v_len := jsonb_array_length(p_intervals);
  v_days := ARRAY[]::integer[];
  v_starts_arr := ARRAY[]::time[];
  v_ends_arr := ARRAY[]::time[];

  FOR v_idx IN 0 .. GREATEST(v_len - 1, -1) LOOP
    EXIT WHEN v_len = 0;
    v_elem := p_intervals -> v_idx;

    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Interval % must be an object', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT (
      v_elem ? 'day_of_week'
      AND v_elem ? 'starts_at'
      AND v_elem ? 'ends_at'
    ) THEN
      RAISE EXCEPTION 'Interval % is missing required fields', v_idx
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_day := (v_elem ->> 'day_of_week')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid day_of_week in interval %', v_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_day < 0 OR v_day > 6 THEN
      RAISE EXCEPTION 'day_of_week must be between 0 and 6'
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_starts := (v_elem ->> 'starts_at')::time;
      v_ends := (v_elem ->> 'ends_at')::time;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid time format in interval %', v_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_ends <= v_starts THEN
      RAISE EXCEPTION 'ends_at must be after starts_at'
        USING ERRCODE = 'P0001';
    END IF;

    v_days := array_append(v_days, v_day);
    v_starts_arr := array_append(v_starts_arr, v_starts);
    v_ends_arr := array_append(v_ends_arr, v_ends);
  END LOOP;

  -- Detect duplicates / overlaps within the payload before writing.
  IF v_len > 1 THEN
    FOR v_i IN 1 .. v_len LOOP
      FOR v_j IN (v_i + 1) .. v_len LOOP
        IF v_days[v_i] = v_days[v_j]
           AND tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_i]),
                 ('2000-01-01'::date + v_ends_arr[v_i])
               )
             && tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_j]),
                 ('2000-01-01'::date + v_ends_arr[v_j])
               )
        THEN
          RAISE EXCEPTION 'Overlapping or duplicate intervals on the same day'
            USING ERRCODE = 'P0001';
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  DELETE FROM public.field_availability_rules
  WHERE field_id = p_field_id;

  IF v_len > 0 THEN
    FOR v_i IN 1 .. v_len LOOP
      INSERT INTO public.field_availability_rules (
        field_id,
        organization_id,
        day_of_week,
        starts_at,
        ends_at
      ) VALUES (
        p_field_id,
        v_org_id,
        v_days[v_i],
        v_starts_arr[v_i],
        v_ends_arr[v_i]
      );
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.field_availability_rules r
  WHERE r.field_id = p_field_id
  ORDER BY r.day_of_week, r.starts_at;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_field_availability(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_field_availability(uuid, jsonb)
  TO authenticated;
