-- Migration 022: scorekeeper capture, time window, void match events
-- ADR: docs/ADR/0008-cedula-arbitral-ventana-y-correccion.md

-- ---------------------------------------------------------------------------
-- 1. season_roles: allow scorekeeper
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_roles
  DROP CONSTRAINT season_roles_role_check;

ALTER TABLE public.season_roles
  ADD CONSTRAINT season_roles_role_check CHECK (
    role IN ('tournament_admin', 'referee', 'delegate', 'scorekeeper')
  );

-- ---------------------------------------------------------------------------
-- 2. can_capture_match: scorekeeper with confirmed match_officials assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_capture_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        public.has_role_in_org(
          m.organization_id,
          ARRAY['organization_owner', 'organization_admin']::text[]
        )
        OR public.has_season_role(m.season_id, ARRAY['tournament_admin']::text[])
        OR (
          public.has_season_role(
            m.season_id,
            ARRAY['referee', 'delegate', 'scorekeeper']::text[]
          )
          AND EXISTS (
            SELECT 1
            FROM public.match_officials mo
            WHERE mo.match_id = m.id
              AND mo.profile_id = auth.uid()
              AND mo.status = 'confirmed'
              AND mo.role IN ('referee', 'delegate', 'scorekeeper')
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Capture time window (America/Mexico_City)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__match_capture_window_open(p_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starts_at timestamptz;
  v_now timestamptz := now();
  v_local_date date;
  v_window_end timestamptz;
BEGIN
  SELECT fr.starts_at INTO v_starts_at
  FROM public.matches m
  JOIN public.field_reservations fr ON fr.id = m.field_reservation_id
  WHERE m.id = p_match_id
    AND fr.status = 'confirmed'
    AND fr.reservation_type = 'match';

  IF v_starts_at IS NULL THEN
    RETURN false;
  END IF;

  v_local_date := (v_starts_at AT TIME ZONE 'America/Mexico_City')::date;
  v_window_end := (
    (v_local_date + interval '1 day')::timestamp + time '09:00:00'
  ) AT TIME ZONE 'America/Mexico_City';

  RETURN v_now >= v_starts_at AND v_now < v_window_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.__match_capture_window_bypass(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (
        public.has_role_in_org(
          m.organization_id,
          ARRAY['organization_owner', 'organization_admin']::text[]
        )
        OR public.has_season_role(m.season_id, ARRAY['tournament_admin']::text[])
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.__assert_match_capture_window(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF public.__match_capture_window_bypass(p_match_id) THEN
    RETURN;
  END IF;

  IF NOT public.__match_capture_window_open(p_match_id) THEN
    RAISE EXCEPTION 'La ventana de captura para este partido ya cerró'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. match_events void columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_events
  ADD COLUMN voided_at timestamptz,
  ADD COLUMN voided_by_profile_id uuid REFERENCES public.profiles (id),
  ADD COLUMN void_reason text;

ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_void_all_or_none_check CHECK (
    (
      voided_at IS NULL
      AND voided_by_profile_id IS NULL
      AND void_reason IS NULL
    )
    OR (
      voided_at IS NOT NULL
      AND voided_by_profile_id IS NOT NULL
      AND void_reason IS NOT NULL
    )
  );

CREATE INDEX match_events_active_idx
  ON public.match_events (match_id)
  WHERE voided_at IS NULL;

COMMENT ON COLUMN public.match_events.voided_at IS
  'When set, event is excluded from scorers/discipline summaries. Void via void_match_event RPC only.';

-- ---------------------------------------------------------------------------
-- 5. Immutability with void escape hatch (pattern team_charges)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_events_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'match_events records cannot be deleted; void instead'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF current_setting('app.match_event_void', true) = 'true' THEN
      IF OLD.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'match_event % is already voided', OLD.id
          USING ERRCODE = 'P0001';
      END IF;

      IF NEW.match_id IS DISTINCT FROM OLD.match_id
         OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
         OR NEW.season_team_player_id IS DISTINCT FROM OLD.season_team_player_id
         OR NEW.event_type IS DISTINCT FROM OLD.event_type
         OR NEW.minute IS DISTINCT FROM OLD.minute
         OR NEW.notes IS DISTINCT FROM OLD.notes
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'void_match_event may not alter original event fields'
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'match_events records are immutable; use void_match_event RPC'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_events_prevent_mutation ON public.match_events;
CREATE TRIGGER match_events_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.match_events_prevent_mutation();

-- ---------------------------------------------------------------------------
-- 6. BEFORE INSERT: capture rules + time window
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

  IF auth.uid() IS NOT NULL THEN
    IF NOT public.can_capture_match(NEW.match_id) THEN
      RAISE EXCEPTION 'Not authorized to capture match %', NEW.match_id
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM public.__assert_match_capture_window(NEW.match_id);
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

-- ---------------------------------------------------------------------------
-- 7. record_match_event: time window
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

-- ---------------------------------------------------------------------------
-- 8. update_match_result: time window (bypass for authorized roles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_match_result(
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
  v_match public.matches;
BEGIN
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_role_in_org(
      v_match.organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    OR public.has_season_role(v_match.season_id, ARRAY['tournament_admin']::text[])
  ) THEN
    RAISE EXCEPTION
      'Not authorized to update match result for match %',
      p_match_id
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

  RETURN v_match;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. void_match_event RPC (owner/admin only)
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
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  SELECT * INTO v_row
  FROM public.match_events
  WHERE id = p_event_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'match_event % does not exist', p_event_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
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
  SET
    voided_at = now(),
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

-- ---------------------------------------------------------------------------
-- 10. RLS: scorekeeper INSERT policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS match_events_insert_confirmed_official ON public.match_events;

CREATE POLICY match_events_insert_confirmed_official
  ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND m.organization_id = organization_id
        AND public.has_season_role(
          m.season_id,
          ARRAY['referee', 'delegate', 'scorekeeper']::text[]
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.match_officials mo
      WHERE mo.match_id = match_events.match_id
        AND mo.profile_id = auth.uid()
        AND mo.status = 'confirmed'
        AND mo.role IN ('referee', 'delegate', 'scorekeeper')
    )
  );

-- ---------------------------------------------------------------------------
-- 11. Read models: exclude voided events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_season_top_scorers(p_season_id uuid)
RETURNS TABLE (
  "position" integer,
  player_id uuid,
  player_name text,
  season_team_id uuid,
  team_name text,
  goals integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);

  RETURN QUERY
  WITH goals AS (
    SELECT
      p.id AS player_id,
      p.full_name AS player_name,
      st.id AS season_team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      COUNT(*)::integer AS goals
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE m.season_id = p_season_id
      AND me.event_type = 'goal'
      AND me.voided_at IS NULL
      AND m.status <> 'cancelled'
      AND st.season_id = p_season_id
    GROUP BY p.id, p.full_name, st.id, COALESCE(NULLIF(btrim(st.display_name), ''), t.name)
  ),
  ranked AS (
    SELECT
      g.*,
      RANK() OVER (ORDER BY g.goals DESC)::integer AS "position"
    FROM goals g
  )
  SELECT
    r."position",
    r.player_id,
    r.player_name,
    r.season_team_id,
    r.team_name,
    r.goals
  FROM ranked r
  ORDER BY r."position" ASC, r.player_name ASC, r.player_id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_season_discipline_summary(p_season_id uuid)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  season_team_id uuid,
  team_name text,
  yellow_cards integer,
  red_cards integer,
  active_suspensions integer,
  matches_remaining integer,
  suspension_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.__assert_season_readable(p_season_id);

  RETURN QUERY
  WITH roster AS (
    SELECT
      p.id AS player_id,
      p.full_name AS player_name,
      st.id AS season_team_id,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      stp.id AS season_team_player_id
    FROM public.season_team_players stp
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE st.season_id = p_season_id
  ),
  cards AS (
    SELECT
      me.season_team_player_id,
      COUNT(*) FILTER (WHERE me.event_type = 'yellow_card')::integer AS yellow_cards,
      COUNT(*) FILTER (WHERE me.event_type = 'red_card')::integer AS red_cards
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    WHERE m.season_id = p_season_id
      AND m.status <> 'cancelled'
      AND me.voided_at IS NULL
      AND me.event_type IN ('yellow_card', 'red_card')
    GROUP BY me.season_team_player_id
  ),
  susp AS (
    SELECT
      ds.season_team_player_id,
      COUNT(*) FILTER (WHERE ds.status = 'active')::integer AS active_suspensions,
      COALESCE(
        SUM(ds.matches_remaining) FILTER (WHERE ds.status = 'active'),
        0
      )::integer AS matches_remaining,
      CASE
        WHEN COUNT(*) FILTER (WHERE ds.status = 'active') > 0 THEN 'active'
        WHEN COUNT(*) FILTER (WHERE ds.status = 'served') > 0 THEN 'served'
        WHEN COUNT(*) FILTER (WHERE ds.status = 'waived') > 0 THEN 'waived'
        ELSE NULL
      END AS suspension_status
    FROM public.discipline_suspensions ds
    JOIN public.season_team_players stp ON stp.id = ds.season_team_player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    WHERE st.season_id = p_season_id
    GROUP BY ds.season_team_player_id
  )
  SELECT
    r.player_id,
    r.player_name,
    r.season_team_id,
    r.team_name,
    COALESCE(c.yellow_cards, 0)::integer,
    COALESCE(c.red_cards, 0)::integer,
    COALESCE(s.active_suspensions, 0)::integer,
    COALESCE(s.matches_remaining, 0)::integer,
    s.suspension_status
  FROM roster r
  LEFT JOIN cards c ON c.season_team_player_id = r.season_team_player_id
  LEFT JOIN susp s ON s.season_team_player_id = r.season_team_player_id
  WHERE COALESCE(c.yellow_cards, 0) > 0
     OR COALESCE(c.red_cards, 0) > 0
     OR COALESCE(s.active_suspensions, 0) > 0
     OR s.suspension_status IS NOT NULL
  ORDER BY
    COALESCE(s.active_suspensions, 0) DESC,
    COALESCE(s.matches_remaining, 0) DESC,
    COALESCE(c.red_cards, 0) DESC,
    COALESCE(c.yellow_cards, 0) DESC,
    r.player_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_season_scorers(
  p_organization_id uuid,
  p_season_slug text
)
RETURNS TABLE (
  "position" integer,
  player_name text,
  team_name text,
  goals integer
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
  WITH goals AS (
    SELECT
      p.full_name AS player_name,
      COALESCE(NULLIF(btrim(st.display_name), ''), t.name) AS team_name,
      COUNT(*)::integer AS goals
    FROM public.match_events me
    JOIN public.matches m ON m.id = me.match_id
    JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
    JOIN public.players p ON p.id = stp.player_id
    JOIN public.season_teams st ON st.id = stp.season_team_id
    JOIN public.teams t ON t.id = st.team_id
    WHERE m.season_id = v_season_id
      AND me.event_type = 'goal'
      AND me.voided_at IS NULL
      AND m.status <> 'cancelled'
      AND st.season_id = v_season_id
    GROUP BY p.id, p.full_name, COALESCE(NULLIF(btrim(st.display_name), ''), t.name)
  ),
  ranked AS (
    SELECT
      g.*,
      RANK() OVER (ORDER BY g.goals DESC)::integer AS "position"
    FROM goals g
  )
  SELECT
    r."position",
    r.player_name,
    r.team_name,
    r.goals
  FROM ranked r
  ORDER BY r."position" ASC, r.player_name ASC;
END;
$$;

COMMENT ON TABLE public.match_events IS
  'On-pitch events. Capture via record_match_event RPC. Void via void_match_event (owner/admin). UPDATE/DELETE denied for authenticated.';

COMMENT ON FUNCTION public.__match_capture_window_open(uuid) IS
  'True when now() is between confirmed reservation starts_at and 09:00 next calendar day (America/Mexico_City).';

COMMENT ON FUNCTION public.void_match_event(uuid, text) IS
  'Marks event voided without deleting row. Does not auto-waive discipline_suspensions. Second call fails (already voided).';
