-- Hardening: rename locals in replace_field_availability to clear plpgsql
-- shadowed-variable warnings. No signature, behavior, or security changes.

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
  v_len integer;
  v_days integer[];
  v_starts_arr time[];
  v_ends_arr time[];
  v_loop_idx integer;
  v_outer_idx integer;
  v_inner_idx integer;
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

  SELECT f.organization_id, ven.organization_id
  INTO v_org_id, v_venue_org
  FROM public.fields f
  INNER JOIN public.venues ven ON ven.id = f.venue_id
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

  v_loop_idx := 0;
  WHILE v_loop_idx < v_len LOOP
    v_elem := p_intervals -> v_loop_idx;

    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'Interval % must be an object', v_loop_idx
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT (
      v_elem ? 'day_of_week'
      AND v_elem ? 'starts_at'
      AND v_elem ? 'ends_at'
    ) THEN
      RAISE EXCEPTION 'Interval % is missing required fields', v_loop_idx
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      v_day := (v_elem ->> 'day_of_week')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid day_of_week in interval %', v_loop_idx
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
      RAISE EXCEPTION 'Invalid time format in interval %', v_loop_idx
        USING ERRCODE = 'P0001';
    END;

    IF v_ends <= v_starts THEN
      RAISE EXCEPTION 'ends_at must be after starts_at'
        USING ERRCODE = 'P0001';
    END IF;

    v_days := array_append(v_days, v_day);
    v_starts_arr := array_append(v_starts_arr, v_starts);
    v_ends_arr := array_append(v_ends_arr, v_ends);

    v_loop_idx := v_loop_idx + 1;
  END LOOP;

  -- Detect duplicates / overlaps within the payload before writing.
  IF v_len > 1 THEN
    v_outer_idx := 1;
    WHILE v_outer_idx <= v_len LOOP
      v_inner_idx := v_outer_idx + 1;
      WHILE v_inner_idx <= v_len LOOP
        IF v_days[v_outer_idx] = v_days[v_inner_idx]
           AND tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_outer_idx]),
                 ('2000-01-01'::date + v_ends_arr[v_outer_idx])
               )
             && tsrange(
                 ('2000-01-01'::date + v_starts_arr[v_inner_idx]),
                 ('2000-01-01'::date + v_ends_arr[v_inner_idx])
               )
        THEN
          RAISE EXCEPTION 'Overlapping or duplicate intervals on the same day'
            USING ERRCODE = 'P0001';
        END IF;
        v_inner_idx := v_inner_idx + 1;
      END LOOP;
      v_outer_idx := v_outer_idx + 1;
    END LOOP;
  END IF;

  DELETE FROM public.field_availability_rules
  WHERE field_id = p_field_id;

  IF v_len > 0 THEN
    v_loop_idx := 1;
    WHILE v_loop_idx <= v_len LOOP
      INSERT INTO public.field_availability_rules (
        field_id,
        organization_id,
        day_of_week,
        starts_at,
        ends_at
      ) VALUES (
        p_field_id,
        v_org_id,
        v_days[v_loop_idx],
        v_starts_arr[v_loop_idx],
        v_ends_arr[v_loop_idx]
      );
      v_loop_idx := v_loop_idx + 1;
    END LOOP;
  END IF;

  RETURN QUERY
  SELECT rule_row.*
  FROM public.field_availability_rules AS rule_row
  WHERE rule_row.field_id = p_field_id
  ORDER BY rule_row.day_of_week, rule_row.starts_at;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_field_availability(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_field_availability(uuid, jsonb)
  TO authenticated;
