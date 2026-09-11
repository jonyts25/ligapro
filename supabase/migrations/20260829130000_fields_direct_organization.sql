-- Canchas directas bajo organización (sin jerarquía sede en el flujo de producto).
-- TODO: eliminar public.venues en una migración posterior cuando no queden dependencias.

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS address text;

UPDATE public.fields f
SET address = COALESCE(
  NULLIF(btrim(f.address), ''),
  NULLIF(btrim(v.address), '')
)
FROM public.venues v
WHERE f.venue_id = v.id;

UPDATE public.fields f
SET organization_id = v.organization_id
FROM public.venues v
WHERE f.venue_id = v.id
  AND f.organization_id IS DISTINCT FROM v.organization_id;

DROP TRIGGER IF EXISTS fields_enforce_org_matches_venue ON public.fields;
DROP FUNCTION IF EXISTS public.fields_enforce_org_matches_venue();

ALTER TABLE public.fields
  ALTER COLUMN venue_id DROP NOT NULL;

COMMENT ON COLUMN public.fields.address IS
  'Optional field location. Replaces venue grouping in the product UI.';
COMMENT ON COLUMN public.fields.venue_id IS
  'Legacy FK to venues. Nullable after org-direct fields migration; do not use in new flows.';

-- replace_field_availability: resolve org from field only
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

  SELECT f.organization_id
  INTO v_org_id
  FROM public.fields f
  WHERE f.id = p_field_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Field not found'
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

-- __schedule_match_core: field availability only (no venue active gate)
CREATE OR REPLACE FUNCTION public.__schedule_match_core(
  p_match_id uuid,
  p_field_id uuid,
  p_starts_at timestamptz,
  p_calendar_status text DEFAULT 'programado'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_season uuid;
  v_status text;
  v_existing_res uuid;
  v_field_active boolean;
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
  PERFORM public.__assert_season_not_archived_for_match(p_match_id);
  IF p_match_id IS NULL OR p_field_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'Match, field and starts_at are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_calendar_status NOT IN ('programado', 'confirmado') THEN
    RAISE EXCEPTION 'Invalid calendar_status'
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

  IF v_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled matches can be programmed'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT f.is_active, f.organization_id
  INTO v_field_active, v_field_org
  FROM public.fields f
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

  PERFORM public.__assert_field_slot_not_blocked_by_other_season(
    p_field_id,
    v_dow,
    v_start_time,
    v_end_time,
    v_season
  );

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
  ELSE
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
    ELSE
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
    END IF;
  END IF;

  UPDATE public.matches
  SET calendar_status = p_calendar_status
  WHERE id = p_match_id
    AND organization_id = v_org;
END;
$$;

-- Platform limits: count active fields without requiring active venue
CREATE OR REPLACE FUNCTION public.get_platform_organizations_subscription_limits()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  subscription_tier text,
  addon_overrides jsonb,
  active_competitions bigint,
  active_venues bigint,
  active_fields bigint,
  staff_users bigint,
  chronicles_this_month bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  v_month_start := (
    date_trunc(
      'month',
      now() AT TIME ZONE 'America/Mexico_City'
    ) AT TIME ZONE 'America/Mexico_City'
  );

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.subscription_tier,
    o.addon_overrides,
    (
      SELECT COUNT(DISTINCT c.id)::bigint
      FROM public.competitions c
      WHERE c.organization_id = o.id
        AND EXISTS (
          SELECT 1
          FROM public.seasons s
          WHERE s.competition_id = c.id
            AND s.visibility <> 'archived'
        )
    ) AS active_competitions,
    (
      SELECT COUNT(*)::bigint
      FROM public.fields f
      WHERE f.organization_id = o.id
        AND f.is_active = true
    ) AS active_venues,
    (
      SELECT COUNT(*)::bigint
      FROM public.fields f
      WHERE f.organization_id = o.id
        AND f.is_active = true
    ) AS active_fields,
    (
      SELECT COUNT(*)::bigint
      FROM public.organization_members om
      WHERE om.organization_id = o.id
        AND om.role IN ('organization_owner', 'organization_admin')
    ) AS staff_users,
    (
      SELECT COUNT(*)::bigint
      FROM public.ai_jobs aj
      WHERE aj.organization_id = o.id
        AND aj.tipo = 'cronica'
        AND aj.created_at >= v_month_start
    ) AS chronicles_this_month
  FROM public.organizations o
  ORDER BY o.name ASC, o.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_organizations_subscription_limits()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_organizations_subscription_limits()
  TO authenticated;
